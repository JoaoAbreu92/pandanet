import React from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { UpcomingEvent } from '../types';
import { CalendarIcon } from './icons';

const events: UpcomingEvent[] = [
  { id: '1', title: 'Reunião Geral Trimestral', date: 'AGO 02', time: '10:00', location: 'Virtual' },
  { id: '2', title: 'Sincronia do Time de Design', date: 'AGO 05', time: '14:00', location: 'Sala 301' },
  { id: '3', title: 'Piquenique de Verão', date: 'AGO 15', time: '12:00', location: 'Parque Central' },
];

const UpcomingEvents: React.FC = () => {
  return (
    <Card title="Próximos Eventos" headerAction={<button className="text-sm font-medium text-brand-primary hover:underline">Ver todos</button>}>
      <div className="space-y-4">
        {events.map(event => (
          <div key={event.id} className="flex items-center space-x-4">
            <div className="flex-shrink-0 text-center bg-emerald-50 p-3 rounded-lg">
              <p className="text-sm font-bold text-brand-primary">{event.date.split(' ')[0]}</p>
              <p className="text-xl font-bold text-brand-primary">{event.date.split(' ')[1]}</p>
            </div>
            <div>
              <h4 className="font-semibold text-brand-text">{event.title}</h4>
              <p className="text-sm text-brand-subtle-text">{event.time} - {event.location}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default UpcomingEvents;