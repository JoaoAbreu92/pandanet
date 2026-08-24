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

      const filtered = (data || []).filter(event => {
        const isInvited = (event.invited_ids || []).includes(currentUser?.id || '');
        const isAttending = (event.attendees || []).includes(currentUser?.id || '');
        const isDeclined = (event.declined || []).some((d: any) => d.userId === currentUser?.id);

        if (event.is_specific_audience) {
          return (isInvited || isAttending) && !isDeclined;
        }

        const isSocialOrPublic = ['Social', 'Corporativo', 'Treinamento', 'Evento da Empresa'].includes(event.category) || !event.invited_ids || event.invited_ids.length === 0;
        return (isSocialOrPublic || isInvited || isAttending) && !isDeclined;
      });

      setEvents(filtered);
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
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-brand-text truncate">{event.title}</h4>
                  <div className="flex items-center space-x-2 text-sm text-brand-subtle-text">
                    <span className="truncate">{event.time} - {event.location}</span>
                    {event.meeting_url && (
                      <a
                        href={event.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                        title="Participar da Reunião"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                      </a>
                    )}
                  </div>
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