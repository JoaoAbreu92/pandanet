import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import {
    CalendarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from './icons';

interface PremiumHeroCalendarProps {
    onNavigate: (page: string, context?: any) => void;
    currentUser: Employee;
    employees?: Employee[];
}

type DayInfo = {
    categories: string[];
    birthdays: number;
};

type CalendarCell = {
    day: number;
    currentMonth: boolean;
    dateString: string | null;
    today: boolean;
};

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const PremiumHeroCalendar: React.FC<PremiumHeroCalendarProps> = ({
    onNavigate,
    currentUser,
    employees = []
}) => {
    const [displayDate, setDisplayDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [daysInfo, setDaysInfo] = useState<Record<string, DayInfo>>({});
    const [loading, setLoading] = useState(true);

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    useEffect(() => {
        let cancelled = false;

        const loadMonth = async () => {
            if (!currentUser?.company_id) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const { data, error } = await supabase
                    .from('events')
                    .select('date, category, is_private, creator_id')
                    .or(
                        `company_id.eq.${currentUser.company_id},and(is_private.eq.true,creator_id.eq.${currentUser.id})`
                    );

                if (error) throw error;

                const mapped: Record<string, DayInfo> = {};

                (data || []).forEach((event: any) => {
                    if (!event.date) return;

                    const dateString = event.date.split('T')[0];

                    if (!mapped[dateString]) {
                        mapped[dateString] = {
                            categories: [],
                            birthdays: 0
                        };
                    }

                    if (
                        event.category &&
                        !mapped[dateString].categories.includes(event.category)
                    ) {
                        mapped[dateString].categories.push(event.category);
                    }
                });

                employees.forEach(employee => {
                    if (!employee.birthDate) return;

                    const monthDay = employee.birthDate.substring(5, 10);
                    const dateString = year + '-' + monthDay;

                    if (!mapped[dateString]) {
                        mapped[dateString] = {
                            categories: [],
                            birthdays: 0
                        };
                    }

                    mapped[dateString].birthdays += 1;
                });

                if (!cancelled) setDaysInfo(mapped);
            } catch (error) {
                console.error(
                    'Erro ao carregar calendário premium:',
                    error
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadMonth();

        return () => {
            cancelled = true;
        };
    }, [
        currentUser?.company_id,
        currentUser?.id,
        employees,
        year,
        month
    ]);

    const today = new Date();
    const todayString =
        today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

    const cells = useMemo<CalendarCell[]>(() => {
        const result: CalendarCell[] = [];
        const firstWeekday = new Date(year, month, 1).getDay();
        const previousMonthDays = new Date(year, month, 0).getDate();
        const monthDays = new Date(year, month + 1, 0).getDate();

        for (let index = firstWeekday - 1; index >= 0; index -= 1) {
            result.push({
                day: previousMonthDays - index,
                currentMonth: false,
                dateString: null,
                today: false
            });
        }

        for (let day = 1; day <= monthDays; day += 1) {
            const dateString =
                year + '-' +
                String(month + 1).padStart(2, '0') + '-' +
                String(day).padStart(2, '0');

            result.push({
                day,
                currentMonth: true,
                dateString,
                today: dateString === todayString
            });
        }

        let nextDay = 1;

        while (result.length < 42) {
            result.push({
                day: nextDay,
                currentMonth: false,
                dateString: null,
                today: false
            });
            nextDay += 1;
        }

        return result;
    }, [year, month, todayString]);

    const monthSummary = useMemo(() => {
        const prefix =
            year + '-' + String(month + 1).padStart(2, '0') + '-';

        let eventDays = 0;
        let todayEvents = 0;

        Object.entries(daysInfo).forEach(([date, info]) => {
            if (!date.startsWith(prefix)) return;

            if (info.categories.length > 0) {
                eventDays += 1;
            }

            if (date === todayString) {
                todayEvents = info.categories.length;
            }
        });

        return { eventDays, todayEvents };
    }, [daysInfo, year, month]);

    const openDay = (dateString: string | null) => {
        if (!dateString) return;

        onNavigate('calendar', {
            selectedDate: dateString
        });
    };

    return (
        <section className="relative overflow-hidden rounded-[1.6rem] border border-emerald-200/80 bg-gradient-to-br from-white/90 via-emerald-50/80 to-cyan-50/70 dark:border-white/10 dark:from-white/10 dark:via-white/[0.07] dark:to-cyan-400/[0.06] p-4 shadow-[0_24px_50px_-36px_rgba(34,211,238,0.8)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -left-14 -top-14 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />

            <div className="relative flex items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.19em] text-cyan-700 dark:text-cyan-200">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Agenda Panda
                    </div>
                    <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                        {MONTHS[month]} {year}
                    </h3>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() =>
                            setDisplayDate(
                                new Date(year, month - 1, 1)
                            )
                        }
                        className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 transition hover:bg-white/20 hover:text-white"
                        aria-label="Mês anterior"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setDisplayDate(
                                new Date(
                                    new Date().getFullYear(),
                                    new Date().getMonth(),
                                    1
                                )
                            )
                        }
                        className="rounded-xl border border-slate-200 bg-white/80 px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 transition hover:bg-white/20"
                    >
                        Hoje
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setDisplayDate(
                                new Date(year, month + 1, 1)
                            )
                        }
                        className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 transition hover:bg-white/20 hover:text-white"
                        aria-label="Próximo mês"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="relative mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_112px]">
                <div>
                    <div className="grid grid-cols-7">
                        {WEEKDAYS.map((weekday, index) => (
                            <span
                                key={weekday + index}
                                className="pb-1.5 text-center text-[9px] font-black text-slate-500 dark:text-slate-400"
                            >
                                {weekday}
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((cell, index) => {
                            const info = cell.dateString
                                ? daysInfo[cell.dateString]
                                : null;
                            const hasEvents =
                                Boolean(info?.categories.length);
                            const hasBirthday =
                                Boolean(info?.birthdays);

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    disabled={!cell.currentMonth}
                                    onClick={() =>
                                        openDay(cell.dateString)
                                    }
                                    className={
                                        'relative flex h-8 items-center justify-center rounded-xl text-[10px] font-black transition ' +
                                        (!cell.currentMonth
                                            ? 'cursor-default text-slate-300 dark:text-white/15'
                                            : cell.today
                                                ? 'bg-emerald-400 text-slate-950 shadow-[0_0_18px_rgba(52,211,153,0.55)]'
                                                : 'text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-white/15 dark:hover:text-white')
                                    }
                                >
                                    {cell.day}

                                    {cell.currentMonth &&
                                        cell.dateString &&
                                        cell.dateString < todayString &&
                                        !cell.today && (
                                        <span
                                            className="absolute right-1 top-0.5 text-[10px] font-black text-rose-500/80 dark:text-rose-400"
                                            title="Dia encerrado"
                                        >
                                            ×
                                        </span>
                                    )}

                                    {cell.currentMonth &&
                                        (hasEvents || hasBirthday) && (
                                        <span className="absolute bottom-1 flex gap-0.5">
                                            {hasEvents && (
                                                <i className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_5px_rgba(103,232,249,0.8)]" />
                                            )}
                                            {hasBirthday && (
                                                <i className="h-1 w-1 rounded-full bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.8)]" />
                                            )}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="flex flex-row gap-2 sm:flex-col">
                    <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white/65 p-3 dark:border-white/10 dark:bg-slate-950/20">
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Dias com eventos
                        </span>
                        <p className="mt-1 text-2xl font-black text-cyan-700 dark:text-cyan-200">
                            {loading ? '—' : monthSummary.eventDays}
                        </p>
                    </div>

                    <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white/65 p-3 dark:border-white/10 dark:bg-slate-950/20">
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Eventos hoje
                        </span>
                        <p className="mt-1 text-2xl font-black text-violet-600 dark:text-violet-200">
                            {loading ? '—' : monthSummary.todayEvents}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => onNavigate('calendar')}
                        className="flex flex-1 items-center justify-center rounded-2xl border border-emerald-300/70 bg-emerald-100/80 dark:border-emerald-300/20 dark:bg-emerald-400/15 p-3 text-center text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-400/25"
                    >
                        Abrir agenda
                    </button>
                </aside>
            </div>
        </section>
    );
};

export default PremiumHeroCalendar;
