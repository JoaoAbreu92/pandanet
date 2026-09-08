import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import PremiumWeatherWidget from './PremiumWeatherWidget';
import QuickLinks from './QuickLinks';

interface PremiumDailyCenterProps {
    currentUser: Employee;
    employees: Employee[];
    onNavigate: (page: string, context?: any) => void;
    peopleCount: number;
    birthdayCount: number;
    awardCount: number;
    newHireCount: number;
}

interface DailyItem {
    id: string;
    kind: 'meeting' | 'reservation' | 'task' | 'project';
    title: string;
    subtitle?: string;
    time?: string;
    tomorrow?: boolean;
    priority?: string;
    page: string;
    context?: any;
}

interface FeedPreview {
    id: number;
    content: string;
    created_at: string;
    author_id: string;
    mentions: string[];
    media_url?: string | null;
    media_type?: string | null;
    likes?: number;
    authorName: string;
    authorAvatar?: string;
    mentioned: boolean;
}

const localDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const cleanText = (value: unknown, fallback = '') =>
    String(value ?? fallback)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const shortText = (value: unknown, limit = 125) => {
    const text = cleanText(value);
    return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
};

const formatFeedPost = (value: unknown, limit = 125) => {
    const original = String(value ?? '').trim();

    if (original.startsWith('[BADGE_AWARD]')) {
        try {
            const payload = JSON.parse(
                original.slice('[BADGE_AWARD]'.length)
            );

            const recipient =
                payload.recipient_name ||
                payload.employee_name ||
                'Um colaborador';

            const badge =
                payload.badge_name ||
                payload.badge?.name ||
                payload.title ||
                'um novo reconhecimento';

            return `${recipient} recebeu ${badge}. Parabéns por essa conquista!`;
        } catch {
            return 'Uma nova conquista foi reconhecida pela empresa.';
        }
    }

    if (
        original.startsWith('{') &&
        original.includes('"type":"badge_award"')
    ) {
        try {
            const payload = JSON.parse(original);

            return `${
                payload.recipient_name || 'Um colaborador'
            } recebeu ${
                payload.badge_name || 'um novo reconhecimento'
            }.`;
        } catch {
            return 'Uma nova conquista foi reconhecida pela empresa.';
        }
    }

    return shortText(original, limit);
};

const normalizeArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return value
                .split(',')
                .map(item => item.trim())
                .filter(Boolean);
        }
    }

    return [];
};

const ActionButton: React.FC<{
    label: string;
    onClick: () => void;
    dark?: boolean;
}> = ({ label, onClick, dark }) => (
    <button
        type="button"
        onClick={onClick}
        className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wide transition-all hover:-translate-y-0.5 ${
            dark
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                : 'border-emerald-200 bg-white/70 text-emerald-700 hover:border-emerald-400 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-emerald-200'
        }`}
    >
        {label}
    </button>
);

const ItemIcon: React.FC<{ kind: DailyItem['kind'] }> = ({ kind }) => {
    const icons = {
        meeting: '👥',
        reservation: '📅',
        task: '✓',
        project: '⚑'
    };

    return (
        <span className={`daily-center-item-icon daily-center-item-icon-${kind}`}>
            {icons[kind]}
        </span>
    );
};

interface CompactWeatherData {
    temperature: number;
    apparent: number;
    code: number;
    rain: number;
    high: number;
    low: number;
    hourly: Array<{
        time: string;
        temperature: number;
        code: number;
    }>;
}

const weatherDescription = (code: number) => {
    if (code === 0) return 'Ensolarado';
    if (code <= 2) return 'Parcialmente nublado';
    if (code === 3) return 'Nublado';
    if (code <= 48) return 'Neblina';
    if (code <= 57) return 'Garoa';
    if (code <= 67) return 'Chuva';
    if (code <= 77) return 'Neve ou granizo';
    if (code <= 82) return 'Pancadas de chuva';
    if (code <= 86) return 'Pancadas de neve';
    if (code <= 99) return 'Tempestade';
    return 'Tempo variável';
};

const weatherIcon = (code: number) => {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    if (code <= 82) return '🌦️';
    if (code <= 86) return '❄️';
    if (code <= 99) return '⛈️';
    return '🌥️';
};

const CompactDailyWeather: React.FC<{
    userId: string;
}> = ({ userId }) => {
    const [weather, setWeather] =
        useState<CompactWeatherData | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(true);

    useEffect(() => {
        let active = true;

        const readStoredLocation = () => {
            const possibleKeys = [
                `pandanet_weather_location_${userId}`,
                'pandanet_weather_location',
                `weather_location_${userId}`
            ];

            for (const key of possibleKeys) {
                const raw = localStorage.getItem(key);

                if (!raw) continue;

                try {
                    const parsed = JSON.parse(raw);

                    const latitude = Number(
                        parsed.latitude ??
                        parsed.lat ??
                        parsed.coords?.latitude
                    );

                    const longitude = Number(
                        parsed.longitude ??
                        parsed.lon ??
                        parsed.lng ??
                        parsed.coords?.longitude
                    );

                    if (
                        Number.isFinite(latitude) &&
                        Number.isFinite(longitude)
                    ) {
                        return { latitude, longitude };
                    }
                } catch {
                    continue;
                }
            }

            return null;
        };

        const requestLocation = async () => {
            const stored = readStoredLocation();

            if (stored) return stored;

            return await new Promise<{
                latitude: number;
                longitude: number;
            }>((resolve) => {
                if (!navigator.geolocation) {
                    resolve({
                        latitude: -23.5505,
                        longitude: -46.6333
                    });
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    position => {
                        const location = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        };

                        localStorage.setItem(
                            `pandanet_weather_location_${userId}`,
                            JSON.stringify(location)
                        );

                        resolve(location);
                    },
                    () =>
                        resolve({
                            latitude: -23.5505,
                            longitude: -46.6333
                        }),
                    {
                        enableHighAccuracy: false,
                        timeout: 7000,
                        maximumAge: 21600000
                    }
                );
            });
        };

        const loadWeather = async () => {
            try {
                const location = await requestLocation();

                const params = new URLSearchParams({
                    latitude: String(location.latitude),
                    longitude: String(location.longitude),
                    current:
                        'temperature_2m,apparent_temperature,weather_code,precipitation_probability',
                    hourly:
                        'temperature_2m,weather_code,precipitation_probability',
                    daily:
                        'temperature_2m_max,temperature_2m_min',
                    timezone: 'auto',
                    forecast_days: '2'
                });

                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?${params}`
                );

                if (!response.ok) {
                    throw new Error(
                        `Clima indisponível: ${response.status}`
                    );
                }

                const data = await response.json();
                const currentTime = new Date(
                    data.current?.time || Date.now()
                ).getTime();

                const hourlyTimes: string[] =
                    data.hourly?.time || [];

                let startIndex = hourlyTimes.findIndex(
                    time =>
                        new Date(time).getTime() >= currentTime
                );

                if (startIndex < 0) startIndex = 0;

                const hourly = hourlyTimes
                    .slice(startIndex, startIndex + 3)
                    .map((time, offset) => {
                        const index = startIndex + offset;

                        return {
                            time: new Date(time).toLocaleTimeString(
                                'pt-BR',
                                {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }
                            ),
                            temperature: Math.round(
                                data.hourly.temperature_2m[index]
                            ),
                            code:
                                data.hourly.weather_code[index]
                        };
                    });

                if (!active) return;

                setWeather({
                    temperature: Math.round(
                        data.current.temperature_2m
                    ),
                    apparent: Math.round(
                        data.current.apparent_temperature
                    ),
                    code: data.current.weather_code,
                    rain: Math.round(
                        data.current
                            .precipitation_probability || 0
                    ),
                    high: Math.round(
                        data.daily.temperature_2m_max[0]
                    ),
                    low: Math.round(
                        data.daily.temperature_2m_min[0]
                    ),
                    hourly
                });
            } catch (error) {
                console.error(
                    '[CompactDailyWeather] Falha:',
                    error
                );
            } finally {
                if (active) setLoadingWeather(false);
            }
        };

        void loadWeather();

        const interval = window.setInterval(
            () => void loadWeather(),
            30 * 60 * 1000
        );

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [userId]);

    if (loadingWeather) {
        return (
            <div className="compact-weather-capsule compact-weather-loading">
                Organizando o clima…
            </div>
        );
    }

    if (!weather) {
        return (
            <button
                type="button"
                className="compact-weather-capsule compact-weather-loading"
                onClick={() => window.location.reload()}
            >
                Clima temporariamente indisponível
            </button>
        );
    }

    return (
        <div className="compact-weather-capsule">
            <div className="compact-weather-now">
                <span className="compact-weather-main-icon">
                    {weatherIcon(weather.code)}
                </span>

                <div>
                    <span className="compact-weather-temperature">
                        {weather.temperature}°
                    </span>

                    <span className="compact-weather-description">
                        {weatherDescription(weather.code)}
                    </span>
                </div>
            </div>

            <div className="compact-weather-details">
                <span>
                    Sensação <strong>{weather.apparent}°</strong>
                </span>
                <span>
                    Máx./mín. <strong>{weather.high}°/{weather.low}°</strong>
                </span>
                <span>
                    Chuva <strong>{weather.rain}%</strong>
                </span>
            </div>

            <div className="compact-weather-hours">
                {weather.hourly.map(hour => (
                    <div key={hour.time}>
                        <small>{hour.time}</small>
                        <span>{weatherIcon(hour.code)}</span>
                        <strong>{hour.temperature}°</strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PremiumDailyCenter: React.FC<PremiumDailyCenterProps> = ({
    currentUser,
    employees,
    onNavigate,
    peopleCount,
    birthdayCount,
    awardCount,
    newHireCount
}) => {
    const [todayItems, setTodayItems] = useState<DailyItem[]>([]);
    const [tomorrowItems, setTomorrowItems] = useState<DailyItem[]>([]);
    const [feed, setFeed] = useState<FeedPreview[]>([]);
    const [projectCount, setProjectCount] = useState(0);
    const [projectPreviews, setProjectPreviews] = useState<Array<{
        id: string;
        name: string;
        status: string;
        progress: number;
    }>>([]);
    const [loading, setLoading] = useState(true);

    const companyId = currentUser?.company_id;
    const userId = currentUser?.id;

    const employeeMap = useMemo(
        () =>
            new Map(
                employees.map(employee => [
                    employee.id,
                    {
                        name: employee.name || 'Colaborador',
                        avatar: employee.avatarUrl
                    }
                ])
            ),
        [employees]
    );

    const loadCenter = useCallback(async () => {
        if (!userId || !companyId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const afterTomorrow = new Date(today);
        afterTomorrow.setDate(afterTomorrow.getDate() + 2);

        const todayKey = localDateKey(today);
        const tomorrowKey = localDateKey(tomorrow);
        const todayStart = new Date(`${todayKey}T00:00:00`).toISOString();
        const afterTomorrowStart = new Date(
            `${localDateKey(afterTomorrow)}T00:00:00`
        ).toISOString();

        const results = await Promise.allSettled([
            supabase
                .from('personal_tasks')
                .select('id,title,date,limit_date,completed,items,notification_time')
                .eq('user_id', userId)
                .eq('completed', false)
                .or(
                    `date.eq.${todayKey},limit_date.eq.${todayKey},date.eq.${tomorrowKey},limit_date.eq.${tomorrowKey}`
                )
                .limit(12),

            supabase
                .from('tasks')
                .select('id,title,status,priority,due_date')
                .eq('company_id', companyId)
                .eq('assigned_to', userId)
                .gte('due_date', todayStart)
                .lt('due_date', afterTomorrowStart)
                .limit(12),

            supabase
                .from('events')
                .select(
                    'id,title,description,start_time,end_time,location,meeting_url,attendees,invited_ids,creator_id,is_specific_audience'
                )
                .eq('company_id', companyId)
                .gte('start_time', todayStart)
                .lt('start_time', afterTomorrowStart)
                .order('start_time', { ascending: true })
                .limit(12),

            supabase
                .from('reservations')
                .select(
                    'id,item_id,type,start_date,start_time,duration,motivo,status'
                )
                .eq('company_id', companyId)
                .eq('user_id', userId)
                .in('start_date', [todayKey, tomorrowKey])
                .limit(12),

            supabase
                .from('project_tasks')
                .select('id,project_id,title,priority,due_date,assigned_to')
                .eq('assigned_to', userId)
                .gte('due_date', todayStart)
                .lt('due_date', afterTomorrowStart)
                .limit(12),

            supabase
                .from('projects')
                .select('id,name,status,manager_id')
                .eq('company_id', companyId)
                .neq('status', 'Concluído')
                .limit(40),

            supabase
                .from('posts')
                .select(
                    'id,content,created_at,author_id,mentions,media_url,media_type,likes'
                )
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(20),

            supabase
                .from('reservation_items')
                .select('id,name,type')
                .eq('company_id', companyId)
                .limit(100)
        ]);

        const dataOf = (index: number): any[] => {
            const result = results[index];

            if (result.status !== 'fulfilled') return [];
            return result.value.data || [];
        };

        const personalTasks = dataOf(0);
        const corporateTasks = dataOf(1);
        const events = dataOf(2);
        const reservations = dataOf(3);
        const projectTasks = dataOf(4);
        const projects = dataOf(5);
        const posts = dataOf(6);
        const reservationItems = dataOf(7);

        const projectMap = new Map(
            projects.map((project: any) => [project.id, project])
        );

        const reservationMap = new Map(
            reservationItems.map((item: any) => [item.id, item])
        );

        const todayList: DailyItem[] = [];
        const tomorrowList: DailyItem[] = [];

        const addItem = (item: DailyItem) => {
            if (item.tomorrow) tomorrowList.push(item);
            else todayList.push(item);
        };

        personalTasks.forEach((task: any) => {
            const date = task.date || task.limit_date;
            const items = Array.isArray(task.items) ? task.items : [];
            const pendingItems = items.filter(
                (item: any) => !item.completed && !item.done
            ).length;

            addItem({
                id: `personal-${task.id}`,
                kind: 'task',
                title: task.title,
                subtitle:
                    pendingItems > 0
                        ? `${pendingItems} item(ns) pendente(s)`
                        : 'Tarefa pessoal agendada',
                time: task.notification_time || undefined,
                tomorrow: date === tomorrowKey,
                page: 'tasks',
                context: { taskId: task.id }
            });
        });

        corporateTasks.forEach((task: any) => {
            const date = task.due_date
                ? localDateKey(new Date(task.due_date))
                : todayKey;

            addItem({
                id: `task-${task.id}`,
                kind: 'task',
                title: task.title,
                subtitle: task.priority
                    ? `Prioridade ${task.priority}`
                    : 'Tarefa atribuída a você',
                time: task.due_date
                    ? new Date(task.due_date).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                      })
                    : undefined,
                tomorrow: date === tomorrowKey,
                priority: task.priority,
                page: 'tasks',
                context: { taskId: task.id }
            });
        });

        events.forEach((event: any) => {
            const attendees = normalizeArray(event.attendees);
            const invitedIds = normalizeArray(event.invited_ids);

            const visible =
                !event.is_specific_audience ||
                event.creator_id === userId ||
                attendees.includes(userId) ||
                invitedIds.includes(userId);

            if (!visible) return;

            const start = new Date(event.start_time);
            const eventDate = localDateKey(start);

            addItem({
                id: `event-${event.id}`,
                kind: 'meeting',
                title: event.title,
                subtitle:
                    event.location ||
                    (event.meeting_url
                        ? 'Reunião on-line'
                        : shortText(event.description, 70)),
                time: start.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                tomorrow: eventDate === tomorrowKey,
                page: 'calendar',
                context: { eventId: event.id }
            });
        });

        reservations.forEach((reservation: any) => {
            const item = reservationMap.get(reservation.item_id);

            addItem({
                id: `reservation-${reservation.id}`,
                kind: 'reservation',
                title: item?.name || reservation.type || 'Reserva',
                subtitle:
                    reservation.motivo ||
                    `${reservation.duration || ''}`.trim() ||
                    'Reserva confirmada',
                time: reservation.start_time,
                tomorrow: reservation.start_date === tomorrowKey,
                page: 'reservations',
                context: { reservationId: reservation.id }
            });
        });

        projectTasks.forEach((task: any) => {
            const project = projectMap.get(task.project_id);
            const date = task.due_date
                ? localDateKey(new Date(task.due_date))
                : todayKey;

            addItem({
                id: `project-${task.id}`,
                kind: 'project',
                title: task.title,
                subtitle: project?.name
                    ? `Projeto: ${project.name}`
                    : 'Pendência de projeto',
                time: task.due_date
                    ? new Date(task.due_date).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                      })
                    : undefined,
                tomorrow: date === tomorrowKey,
                priority: task.priority,
                page: 'projects',
                context: {
                    projectId: task.project_id,
                    taskId: task.id
                }
            });
        });

        const activeProjects = projects.filter(
            (project: any) =>
                project.manager_id === userId ||
                projectTasks.some(
                    (task: any) => task.project_id === project.id
                )
        );

        setProjectCount(activeProjects.length);

        setProjectPreviews(
            activeProjects.slice(0, 3).map(
                (project: any, index: number) => {
                    const status = String(
                        project.status || 'Em andamento'
                    );

                    const normalized =
                        status.toLowerCase();

                    const progress =
                        normalized.includes('conclu')
                            ? 100
                            : normalized.includes('revis')
                              ? 82
                              : normalized.includes('andamento')
                                ? 58
                                : normalized.includes('planej')
                                  ? 24
                                  : 38 + index * 9;

                    return {
                        id: project.id,
                        name: project.name,
                        status,
                        progress: Math.min(100, progress)
                    };
                }
            )
        );

        const sortItems = (items: DailyItem[]) =>
            items.sort((a, b) =>
                String(a.time || '99:99').localeCompare(
                    String(b.time || '99:99')
                )
            );

        setTodayItems(sortItems(todayList).slice(0, 5));
        setTomorrowItems(sortItems(tomorrowList).slice(0, 3));

        const formattedPosts: FeedPreview[] = posts.map((post: any) => {
            const author = employeeMap.get(post.author_id);
            const mentions = normalizeArray(post.mentions);

            return {
                ...post,
                mentions,
                authorName: author?.name || 'Colaborador',
                authorAvatar: author?.avatar,
                mentioned: mentions.includes(userId)
            };
        });

        formattedPosts.sort((a, b) => {
            if (a.mentioned !== b.mentioned) {
                return a.mentioned ? -1 : 1;
            }

            return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
        });

        setFeed(formattedPosts.slice(0, 3));
        setLoading(false);
    }, [companyId, employeeMap, userId]);

    useEffect(() => {
        void loadCenter();

        if (!companyId) return;

        const channel = supabase
            .channel(`premium-daily-center:${companyId}:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'posts',
                    filter: `company_id=eq.${companyId}`
                },
                () => void loadCenter()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'personal_tasks',
                    filter: `user_id=eq.${userId}`
                },
                () => void loadCenter()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [companyId, loadCenter, userId]);

    const priorityItems =
        todayItems.length > 0
            ? todayItems
            : [
                  {
                      id: 'empty',
                      kind: 'task' as const,
                      title: 'Seu dia está tranquilo',
                      subtitle:
                          'Nenhuma pendência urgente foi encontrada para hoje.',
                      page: 'tasks'
                  }
              ];

    return (
        <section className="premium-daily-shell">
            <div className="premium-daily-panda" aria-hidden="true" />

            <div className="premium-daily-main-zone">
            <div className="premium-daily-heading">
                <div>
                    <div className="premium-daily-kicker">
                        ✦ Seu dia no PandaNet
                    </div>

                    <h1>
                        {new Date().getHours() < 12
                            ? 'Bom dia'
                            : new Date().getHours() < 18
                              ? 'Boa tarde'
                              : 'Boa noite'}
                        , {currentUser.name?.trim().split(/\s+/)[0] || 'Olá'}!
                    </h1>

                    <p>
                        {new Date().toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long'
                        })}
                        . Tudo o que importa para sua rotina, em um só lugar.
                    </p>
                </div>

                <CompactDailyWeather userId={currentUser.id} />
            </div>

            <div className="premium-daily-bento">
                <article className="premium-priority-card">
                    <header>
                        <div>
                            <span className="premium-card-eyebrow">
                                Prioridades de hoje
                            </span>

                            <h2>
                                {loading
                                    ? 'Organizando seu dia…'
                                    : todayItems.length > 0
                                      ? `Você tem ${todayItems.length} compromisso(s) e pendência(s) hoje.`
                                      : 'Hoje está mais tranquilo.'}
                            </h2>
                        </div>
                    </header>

                    <div className="premium-priority-list">
                        {priorityItems.map(item => (
                            <button
                                type="button"
                                key={item.id}
                                onClick={() =>
                                    item.id !== 'empty' &&
                                    onNavigate(item.page, item.context)
                                }
                                className="premium-priority-row"
                            >
                                <ItemIcon kind={item.kind} />

                                <span className="premium-priority-copy">
                                    <span className="premium-priority-meta">
                                        {item.time || 'Hoje'}
                                        {item.priority
                                            ? ` • ${item.priority}`
                                            : ''}
                                    </span>

                                    <strong>{item.title}</strong>

                                    {item.subtitle && (
                                        <small>{item.subtitle}</small>
                                    )}
                                </span>

                                <span className="premium-row-arrow">›</span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => onNavigate('calendar')}
                        className="premium-priority-footer-button"
                    >
                        <span>Ver meu dia completo</span>
                        <span>›</span>
                    </button>
                </article>

                <article className="premium-feed-card">
                    <header>
                        <div>
                            <span className="premium-card-eyebrow">
                                Acontecendo no Feed
                            </span>
                            <h2>Fique por dentro do que importa.</h2>
                        </div>

                        <ActionButton
                            dark
                            label="Mais relevantes"
                            onClick={() => onNavigate('feed')}
                        />
                    </header>

                    <div className="premium-feed-list">
                        {loading ? (
                            <div className="premium-feed-empty">
                                Buscando publicações para você…
                            </div>
                        ) : feed.length > 0 ? (
                            feed.map((post, index) => (
                                <button
                                    type="button"
                                    key={post.id}
                                    onClick={() =>
                                        onNavigate('feed', {
                                            postId: post.id
                                        })
                                    }
                                    className={`premium-feed-preview ${
                                        post.mentioned
                                            ? 'premium-feed-mentioned'
                                            : ''
                                    } ${index === 0 ? 'premium-feed-main' : ''}`}
                                >
                                    <span className="premium-feed-avatar">
                                        {post.authorAvatar ? (
                                            <img
                                                src={post.authorAvatar}
                                                alt={post.authorName}
                                            />
                                        ) : (
                                            post.authorName
                                                .slice(0, 1)
                                                .toUpperCase()
                                        )}
                                    </span>

                                    <span className="premium-feed-copy">
                                        {post.mentioned && (
                                            <span className="premium-mentioned-label">
                                                @ Você foi mencionado
                                            </span>
                                        )}

                                        <strong>{post.authorName}</strong>

                                        <span>
                                            {formatFeedPost(post.content, index === 0 ? 170 : 90) || 'Compartilhou uma publicação.'}
                                        </span>

                                        <small>
                                            {new Date(
                                                post.created_at
                                            ).toLocaleString('pt-BR', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                            {post.likes
                                                ? ` • ${post.likes} reações`
                                                : ''}
                                        </small>
                                    </span>

                                    {post.media_url && (
                                        <span className="premium-feed-media">
                                            {post.media_type?.startsWith(
                                                'video'
                                            )
                                                ? '▶'
                                                : '▧'}
                                        </span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="premium-feed-empty">
                                Nenhuma publicação recente foi encontrada.
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onNavigate('feed')}
                        className="premium-feed-footer-button"
                    >
                        <span>Ir para o Feed</span>
                        <span>›</span>
                    </button>
                </article>

                <article className="premium-project-card">
                    <header>
                        <span className="premium-card-eyebrow">Projetos</span>

                        <ActionButton
                            label="Ver todos"
                            onClick={() => onNavigate('projects')}
                        />
                    </header>

                    <div className="premium-project-list">
                        {projectPreviews.length > 0 ? (
                            projectPreviews.map(project => (
                                <button
                                    type="button"
                                    key={project.id}
                                    onClick={() =>
                                        onNavigate('projects', {
                                            projectId: project.id
                                        })
                                    }
                                    className="premium-project-row"
                                >
                                    <span className="premium-project-row-copy">
                                        <strong>{project.name}</strong>
                                        <small>{project.status}</small>
                                    </span>

                                    <span className="premium-project-ring">
                                        <span>{project.progress}%</span>
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="premium-project-empty">
                                <span className="premium-project-number">
                                    {projectCount}
                                </span>

                                <div>
                                    <strong>
                                        Nenhum projeto pendente
                                    </strong>
                                    <p>
                                        Seus próximos projetos aparecerão aqui.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </article>

                <article className="premium-tomorrow-card">
                    <header>
                        <span className="premium-card-eyebrow">Amanhã</span>
                    </header>

                    {tomorrowItems.length > 0 ? (
                        <button
                            type="button"
                            onClick={() =>
                                onNavigate(
                                    tomorrowItems[0].page,
                                    tomorrowItems[0].context
                                )
                            }
                            className="premium-tomorrow-preview"
                        >
                            <span className="premium-tomorrow-date">
                                {tomorrowItems[0].time || 'Amanhã'}
                            </span>

                            <span>
                                <strong>{tomorrowItems[0].title}</strong>
                                <small>
                                    {tomorrowItems[0].subtitle ||
                                        'Compromisso agendado'}
                                </small>
                            </span>

                            <span>›</span>
                        </button>
                    ) : (
                        <div className="premium-tomorrow-empty">
                            Nenhuma pendência encontrada para amanhã.
                        </div>
                    )}

                    <p className="premium-reminder-note">
                        🔔 Não se preocupe: amanhã eu atualizo e aviso você
                        novamente.
                    </p>
                </article>
            </div>

                        </div>

            <div className="premium-daily-footer">
                <div className="premium-quick-links">
                    <QuickLinks
                        onNavigate={onNavigate}
                        currentUser={currentUser}
                        variant="hero"
                    />
                </div>

                <div className="premium-stat-grid">
                    {[
                        ['Pessoas', peopleCount, '◉'],
                        ['Aniversários', birthdayCount, '🎁'],
                        ['Conquistas', awardCount, '♕'],
                        ['Novos talentos', newHireCount, '✦']
                    ].map(([label, value, icon]) => (
                        <div key={String(label)} className="premium-stat-card">
                            <span>{icon}</span>
                            <strong>{value}</strong>
                            <small>{label}</small>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PremiumDailyCenter;
