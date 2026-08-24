import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CalendarDaysIcon, XMarkIcon, PhotoIcon } from './icons';
import type { Event, Employee } from '../types';

interface EventsManagerProps {
    events: Event[];
    setEvents: (events: Event[]) => void;
    employees: Employee[];
}

const EventsManager: React.FC<EventsManagerProps> = ({ events, setEvents, employees }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [formData, setFormData] = useState<Partial<Event>>({
        category: 'Social',
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        imageUrl: '',
        attendees: [],
        invitees: [],
        imageType: 'url'
    });
    const [imageFile, setImageFile] = useState<File | null>(null);

    const handleOpenModal = (event?: Event) => {
        if (event) {
            setEditingEvent(event);
            setFormData(event);
            setImageFile(null);
        } else {
            setEditingEvent(null);
            setFormData({
                title: '', description: '', date: '', time: '', location: '', category: 'Social',
                imageUrl: '', attendees: [], invitees: [], imageType: 'url'
            });
            setImageFile(null);
        }
        setIsModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleInvitee = (userId: number) => {
        const currentInvitees = formData.invitees || [];
        if (currentInvitees.includes(userId)) {
            setFormData({ ...formData, invitees: currentInvitees.filter(id => id !== userId) });
        } else {
            setFormData({ ...formData, invitees: [...currentInvitees, userId] });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingEvent) {
            setEvents(events.map(ev => ev.id === editingEvent.id ? { ...ev, ...formData } as Event : ev));
        } else {
            const newEvent: Event = {
                id: Date.now(),
                attendees: [],
                ...formData as Event
            };
            setEvents([...events, newEvent]);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: number) => {
        if (confirm('Tem certeza que deseja excluir este evento?')) {
            setEvents(events.filter(ev => ev.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Gerenciar Eventos</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Novo Evento
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Local</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confirmados</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                    Nenhum evento criado ainda.
                                </td>
                            </tr>
                        ) : (
                            events.map((event) => (
                                <tr key={event.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0">
                                                <img className="h-10 w-10 rounded-lg object-cover" src={event.imageUrl || "https://via.placeholder.com/150"} alt="" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{event.title}</div>
                                                <div className="text-sm text-gray-500 truncate max-w-xs">{event.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{new Date(event.date).toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-500">{event.time} • {event.location}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {event.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {event.attendees.length}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenModal(event)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(event.id)} className="text-red-600 hover:text-red-900">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-bold text-gray-900">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Título</label>
                                <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Descrição</label>
                                <textarea required rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Data</label>
                                    <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Hora</label>
                                    <input type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Local</label>
                                    <input type="text" required value={formData.location || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Categoria</label>
                                    <select value={formData.category || 'Social'} onChange={e => setFormData({ ...formData, category: e.target.value as any })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border">
                                        <option>Social</option>
                                        <option>Corporativo</option>
                                        <option>Treinamento</option>
                                        <option>Outro</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Imagem</label>
                                <div className="flex space-x-4 mb-2">
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" checked={formData.imageType !== 'upload'} onChange={() => setFormData({ ...formData, imageType: 'url' })} />
                                        <span>URL</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" checked={formData.imageType === 'upload'} onChange={() => setFormData({ ...formData, imageType: 'upload' })} />
                                        <span>Upload</span>
                                    </label>
                                </div>

                                {formData.imageType === 'upload' ? (
                                    <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-50">
                                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="event-image-upload" />
                                        <label htmlFor="event-image-upload" className="cursor-pointer flex flex-col items-center">
                                            <PhotoIcon className="w-8 h-8 text-gray-400 mb-2" />
                                            <span className="text-sm text-gray-500">Clique para enviar imagem</span>
                                        </label>
                                        {formData.imageUrl && <p className="text-xs text-green-600 mt-2">Imagem carregada!</p>}
                                    </div>
                                ) : (
                                    <input className="w-full border p-2 rounded" placeholder="URL da Imagem" value={formData.imageUrl || ''} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} />
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Convocados / Participantes</label>
                                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                                    {(employees || []).map(emp => (
                                        <label key={emp.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded">
                                            <input
                                                type="checkbox"
                                                checked={(formData.invitees || []).includes(emp.id)}
                                                onChange={() => toggleInvitee(emp.id)}
                                            />
                                            <span className="text-sm">{emp.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Selecione os usuários que devem comparecer.</p>
                            </div>
                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventsManager;
