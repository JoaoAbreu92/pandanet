import React, { useState, useEffect } from 'react';
import Card from './Card';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './icons';

interface MiniCalendarProps {
  onNavigate: (page: string, context?: any) => void;
  currentUser: Employee;
  employees?: Employee[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MiniCalendar: React.FC<MiniCalendarProps> = ({ onNavigate, currentUser, employees = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventDates, setEventDates] = useState<Record<string, { categories: string[], isBday?: boolean }>>({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const fetchEventsForMonth = async () => {
      if (!currentUser?.company_id) return;
      try {
        // Buscar eventos do Supabase
        const { data: evts, error } = await supabase
          .from('events')
          .select('date, category, is_private, creator_id')
          .or(`company_id.eq.${currentUser.company_id},and(is_private.eq.true,creator_id.eq.${currentUser.id})`);

        if (error) throw error;

        const datesMap: Record<string, { categories: string[], isBday?: boolean }> = {};

        // Mapear eventos
        if (evts) {
          evts.forEach((e: any) => {
            if (e.date) {
              const dStr = e.date.split('T')[0];
              if (!datesMap[dStr]) {
                datesMap[dStr] = { categories: [] };
              }
              if (!datesMap[dStr].categories.includes(e.category)) {
                datesMap[dStr].categories.push(e.category);
              }
            }
          });
        }

        // Mapear aniversários dos funcionários
        employees.forEach((emp) => {
          if (emp.birthDate) {
            // Aniversário no ano corrente
            const bdayMonthDay = emp.birthDate.substring(5, 10); // MM-DD
            const bdayDateStr = `${year}-${bdayMonthDay}`;
            if (!datesMap[bdayDateStr]) {
              datesMap[bdayDateStr] = { categories: [] };
            }
            datesMap[bdayDateStr].isBday = true;
          }
        });

        setEventDates(datesMap);
      } catch (err) {
        console.error('Erro ao buscar eventos para o mini calendário:', err);
      }
    };

    fetchEventsForMonth();
  }, [currentUser, employees, year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Cálculo dos dias
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; dateString: string | null; isToday: boolean }[] = [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Preencher dias do mês anterior
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      dateString: null,
      isToday: false,
    });
  }

  // Preencher dias do mês atual
  for (let i = 1; i <= daysInMonth; i++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(i).padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;
    cells.push({
      day: i,
      isCurrentMonth: true,
      dateString: dateStr,
      isToday: dateStr === todayStr,
    });
  }

  // Preencher dias do próximo mês para fechar a grade (múltiplo de 7)
  const remaining = 42 - cells.length; // 6 linhas completas
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      day: i,
      isCurrentMonth: false,
      dateString: null,
      isToday: false,
    });
  }

  const handleDayClick = (dateString: string | null) => {
    if (!dateString) return;
    onNavigate('calendar', { selectedDate: dateString });
  };

  const getDotColor = (category: string) => {
    const cat = category ? category.toLowerCase() : '';
    if (cat.includes('visita') || cat.includes('reunião') || cat.includes('reuniao')) {
      return 'bg-yellow-500';
    }
    if (cat.includes('treinamento') || cat.includes('projeto')) {
      return 'bg-blue-500';
    }
    if (cat.includes('reserva') || cat.includes('aluguel')) {
      return 'bg-green-500';
    }
    if (cat.includes('social') || cat.includes('outro') || cat.includes('corporativo')) {
      return 'bg-orange-500';
    }
    if (cat.includes('aniversário') || cat.includes('aniversario')) {
      return 'bg-amber-500';
    }
    if (cat.includes('feriado')) {
      return 'bg-rose-500';
    }
    return 'bg-slate-400';
  };

  return (
    <Card 
      title="Agenda Panda"
      headerAction={
        <div className="flex items-center space-x-1">
          <button 
            type="button" 
            onClick={handlePrevMonth}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-800 dark:text-gray-250 min-w-[80px] text-center uppercase tracking-wider">
            {MONTHS[month].substring(0, 3)} / {year}
          </span>
          <button 
            type="button" 
            onClick={handleNextMonth}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Grid de dias da semana */}
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map(w => (
            <span key={w} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {w}
            </span>
          ))}
        </div>

        {/* Grid de dias do mês */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            const hasData = cell.dateString ? eventDates[cell.dateString] : null;
            const hasEvents = hasData && hasData.categories.length > 0;
            const isBday = hasData && hasData.isBday;

            return (
              <button
                key={index}
                type="button"
                disabled={!cell.isCurrentMonth}
                onClick={() => handleDayClick(cell.dateString)}
                className={`relative flex flex-col items-center justify-center h-9 w-full rounded-xl transition-all duration-200 group
                  ${!cell.isCurrentMonth 
                    ? 'text-slate-300 dark:text-slate-700 cursor-default pointer-events-none' 
                    : cell.isToday
                      ? 'bg-brand-primary text-white font-black shadow-md shadow-emerald-500/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800/80 hover:text-brand-primary font-semibold'
                  }
                `}
              >
                <span className="text-[11px]">{cell.day}</span>
                
                {/* Indicadores sob o dia */}
                {cell.isCurrentMonth && (hasEvents || isBday) && (
                  <div className="absolute bottom-1 flex gap-0.5 justify-center w-full">
                    {isBday && (
                      <span className="w-1 h-1 rounded-full bg-amber-500" title="Aniversário" />
                    )}
                    {hasEvents && hasData.categories.slice(0, 2).map((cat, idx) => (
                      <span 
                        key={idx} 
                        className={`w-1 h-1 rounded-full ${getDotColor(cat)}`} 
                        title={cat}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onNavigate('calendar')}
          className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/50 hover:border-emerald-200 dark:hover:border-emerald-800/30 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-brand-primary rounded-xl transition-all"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          Ver Agenda Completa
        </button>
      </div>
    </Card>
  );
};

export default MiniCalendar;
