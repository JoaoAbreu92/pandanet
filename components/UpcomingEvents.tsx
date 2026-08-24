import React, { useState, useEffect } from 'react';
import Card from './Card';
import { CalendarIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const UpcomingEvents: React.FC = () => {
  const { profile: currentUser } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpcomingEvents = async () => {
    if (!currentUser?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(3);

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching upcoming events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingEvents();
  }, [currentUser?.company_id]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const month = months[date.getMonth()];
    const day = date.getDate().toString().padStart(2, '0');
    return { day, month };
  };

  if (loading) return <Card title="Próximos Eventos"><div className="animate-pulse space-y-4">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-md"></div>)}</div></Card>;

  return (
    <Card title="Próximos Eventos" headerAction={<button className="text-sm font-medium text-brand-primary hover:underline">Ver todos</button>}>
      <div className="space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-brand-subtle-text text-center py-4">Nenhum evento próximo.</p>
        ) : (
          events.map(event => {
            const { day, month } = formatDate(event.date);
            return (
              <div key={event.id} className="flex items-center space-x-4">
                <div className="flex-shrink-0 text-center bg-emerald-50 p-3 rounded-lg min-w-[60px]">
                  <p className="text-xs font-bold text-brand-primary uppercase">{month}</p>
                  <p className="text-xl font-bold text-brand-primary leading-tight">{day}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-brand-text truncate max-w-[150px]">{event.title}</h4>
                  <p className="text-sm text-brand-subtle-text truncate max-w-[150px]">{event.time} - {event.location}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default UpcomingEvents;