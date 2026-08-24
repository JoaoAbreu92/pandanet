import { Event } from './types';

export const mockEvents: Event[] = [
    {
        id: 1,
        title: 'Happy Hour Mensal',
        description: 'Venha celebrar os aniversariantes do mês!',
        date: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
        time: '18:00',
        location: 'Terraço',
        category: 'Social',
        imageUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?w=400&q=80',
        attendees: [],
    },
    {
        id: 2,
        title: 'Workshop de React Avançado',
        description: 'Aprenda sobre Server Components e Hooks.',
        date: new Date(Date.now() + 86400000 * 5).toISOString(), // +5 days
        time: '14:00',
        location: 'Sala de Treinamento',
        category: 'Treinamento',
        imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80',
        attendees: [],
    },
    {
        id: 3,
        title: 'Reunião Geral (All-Hands)',
        description: 'Atualização trimestral de resultados.',
        date: new Date(Date.now() + 86400000 * 10).toISOString(), // +10 days
        time: '10:00',
        location: 'Auditório Principal',
        category: 'Corporativo',
        imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80',
        attendees: [],
    }
];
