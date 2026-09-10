BEGIN;

CREATE OR REPLACE FUNCTION public.guard_calendar_event_conflict()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION USING ERRCODE = '22007', MESSAGE = 'O horário de término deve ser posterior ao horário de início.';
    END IF;

    IF NEW.creator_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
        'calendar:' || NEW.creator_id::text || ':' || COALESCE(NEW.date::text, NEW.start_time::date::text),
        0
    ));

    IF EXISTS (
        SELECT 1
        FROM public.events existing
        WHERE existing.creator_id = NEW.creator_id
          AND existing.id IS DISTINCT FROM NEW.id
          AND existing.start_time < NEW.end_time
          AND existing.end_time > NEW.start_time
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23P01', MESSAGE = 'Existe outro evento neste intervalo para o mesmo calendário.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_prevent_schedule_conflict ON public.events;
CREATE TRIGGER events_prevent_schedule_conflict
BEFORE INSERT OR UPDATE OF creator_id, start_time, end_time
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.guard_calendar_event_conflict();

CREATE OR REPLACE FUNCTION public.pandanet_reservation_duration(value text)
RETURNS interval
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    amount integer := GREATEST(COALESCE((regexp_match(COALESCE(value, ''), '[0-9]+'))[1]::integer, 1), 1);
    normalized text := lower(COALESCE(value, ''));
BEGIN
    IF normalized ~ '(semana|week)' THEN
        RETURN make_interval(days => amount * 7);
    ELSIF normalized ~ '(dia|day)' THEN
        RETURN make_interval(days => amount);
    END IF;
    RETURN make_interval(hours => amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_reservation_schedule_conflict()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    requested_start timestamp;
    requested_end timestamp;
BEGIN
    IF NEW.status NOT IN ('pending', 'approved') THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('reservation:' || NEW.item_id::text, 0));
    requested_start := NEW.start_date::timestamp + NEW.start_time::time;
    requested_end := requested_start + public.pandanet_reservation_duration(NEW.duration);

    IF EXISTS (
        SELECT 1
        FROM public.reservations existing
        WHERE existing.item_id = NEW.item_id
          AND existing.id IS DISTINCT FROM NEW.id
          AND existing.status IN ('pending', 'approved')
          AND requested_start < (
              existing.start_date::timestamp
              + existing.start_time::time
              + public.pandanet_reservation_duration(existing.duration)
              + interval '30 minutes'
          )
          AND requested_end + interval '30 minutes' > (
              existing.start_date::timestamp + existing.start_time::time
          )
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23P01',
            MESSAGE = 'Este recurso já possui uma reserva conflitante, considerando o intervalo de 30 minutos.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_prevent_schedule_conflict ON public.reservations;
CREATE TRIGGER reservations_prevent_schedule_conflict
BEFORE INSERT OR UPDATE OF item_id, start_date, start_time, duration, status
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.guard_reservation_schedule_conflict();

CREATE OR REPLACE FUNCTION public.guard_scheduling_booking_conflict()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    event_config public.scheduling_event_types%ROWTYPE;
    active_count integer;
    allow_multiple boolean;
    event_mode text;
BEGIN
    IF NEW.status IN ('rejected', 'cancelled') THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
        'scheduling:' || NEW.event_type_id::text || ':' || NEW.booking_date::text || ':' || NEW.booking_time,
        0
    ));

    SELECT * INTO event_config
    FROM public.scheduling_event_types
    WHERE id = NEW.event_type_id;

    IF NOT FOUND OR event_config.is_active IS NOT TRUE THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Agenda indisponível para novas reservas.';
    END IF;

    allow_multiple := COALESCE((event_config.requirements ->> 'allow_multiple_bookings')::boolean, false);
    event_mode := COALESCE(event_config.requirements ->> 'event_mode',
        CASE WHEN event_config.disable_time_slots THEN 'events' ELSE 'appointments' END);

    IF event_mode = 'appointments' AND NOT allow_multiple AND EXISTS (
        SELECT 1
        FROM public.scheduling_bookings existing
        WHERE existing.event_type_id = NEW.event_type_id
          AND existing.booking_date = NEW.booking_date
          AND existing.booking_time = NEW.booking_time
          AND existing.id IS DISTINCT FROM NEW.id
          AND existing.status NOT IN ('rejected', 'cancelled')
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23P01', MESSAGE = 'Este horário acabou de ser reservado. Escolha outro horário.';
    END IF;

    IF event_config.has_capacity_limit AND event_config.capacity_limit > 0 THEN
        SELECT count(*) INTO active_count
        FROM public.scheduling_bookings existing
        WHERE existing.event_type_id = NEW.event_type_id
          AND existing.id IS DISTINCT FROM NEW.id
          AND existing.status NOT IN ('rejected', 'cancelled')
          AND (
              event_mode = 'events'
              OR (existing.booking_date = NEW.booking_date AND existing.booking_time = NEW.booking_time)
          );

        IF active_count >= event_config.capacity_limit THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Não há mais vagas disponíveis para este agendamento.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scheduling_bookings_prevent_conflict ON public.scheduling_bookings;
CREATE TRIGGER scheduling_bookings_prevent_conflict
BEFORE INSERT OR UPDATE OF event_type_id, booking_date, booking_time, status
ON public.scheduling_bookings
FOR EACH ROW
EXECUTE FUNCTION public.guard_scheduling_booking_conflict();

COMMIT;
