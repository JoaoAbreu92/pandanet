import ModalPortal from './ui/ModalPortal';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import ConfirmModal from './ui/ConfirmModal';
import { useToast } from './ToastContext';
import { PlusIcon, PencilIcon, TrashIcon, CalendarDaysIcon, XMarkIcon, PhotoIcon } from './icons';
import type { Event, Employee } from '../types';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface EventsManagerProps {
    employees: Employee[];
}

const EventsManager: React.FC<EventsManagerProps> = ({ employees }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [filterDate, setFilterDate] = useState('');
    const [filterUserId, setFilterUserId] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const [formData, setFormData] = useState<Partial<Event>>({
        category: 'Social',
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        imageUrl: '',
        attendees: [],
        invited_ids: [],
        imageType: 'url'
    });
    const [imageFile, setImageFile] = useState<File | null>(null);

    const fetchEvents = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('date', { ascending: true });

            if (error) throw error;

            if (data) {
                const formatted: Event[] = data.map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    description: e.description,
                    date: e.date?.split('T')[0] || e.start_time?.split('T')[0],
                    time: e.start_time?.split('T')[1]?.substring(0, 5) || e.time || '09:00',
                    location: e.location || '',
                    imageUrl: getCleanImageUrl(e.image_url),
                    category: e.category || 'Social',
                    attendees: e.attendees || [],
                    invited_ids: e.invited_ids || [],
                    declined: e.declined || []
                }));
                setEvents(formatted);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [currentUser?.company_id]);
    const filteredEvents = events.filter(event => {
        if (filterDate && event.date !== filterDate) {
            return false;
        }
        if (filterUserId && !(event.invited_ids || []).includes(filterUserId) && !(event.attendees || []).includes(filterUserId)) {
            return false;
        }
        if (filterCategory && event.category !== filterCategory) {
            return false;
        }
        return true;
    });
    const handleOpenModal = (event?: Event) => {
        if (event) {
            setEditingEvent(event);
            setFormData(event);
            setImageFile(null);
        } else {
            setEditingEvent(null);
            setFormData({
                title: '', description: '', date: '', time: '', location: '', category: 'Social',
                imageUrl: '', attendees: [], invited_ids: [], imageType: 'url'
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

    const toggleInvitee = (userId: string) => {
        const currentInvitees = formData.invited_ids || [];
        if (currentInvitees.includes(userId)) {
            setFormData({ ...formData, invited_ids: currentInvitees.filter(id => id !== userId) });
        } else {
            setFormData({ ...formData, invited_ids: [...currentInvitees, userId] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;
        setIsProcessing(true);

        try {
            let uploadedImageUrl = formData.imageUrl;

            if (imageFile) {
                const fileName = `event_${Date.now()}_${imageFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('announcements-media') // Reusing for now or created separate bucket? SQL didn't create new bucket for events.
                    .upload(fileName, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('announcements-media')
                    .getPublicUrl(fileName);

                uploadedImageUrl = publicUrl;
            }

            // Map frontend fields (time/date) to DB start_time and end_time
            // Start Time = date + time
            const startTimeIso = new Date(`${formData.date}T${formData.time}:00`).toISOString();
            // Default End Time is +1 hour if not specified
            const endTimeIso = new Date(new Date(startTimeIso).getTime() + 3600000).toISOString();

            const payload = {
                company_id: currentUser.company_id,
                title: formData.title,
                description: formData.description,
                date: formData.date,
                start_time: startTimeIso,
                end_time: endTimeIso,
                location: formData.location,
                category: formData.category,
                image_url: uploadedImageUrl,
                invited_ids: formData.invited_ids || [],
                attendees: formData.attendees || []
            };

            if (editingEvent) {
                const { error } = await supabase
                    .from('events')
                    .update(payload)
                    .eq('id', editingEvent.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('events')
                    .insert([payload]);
                if (error) throw error;
            }

            await fetchEvents();
            setIsModalOpen(false);
            showToast(
                editingEvent
                    ? 'Evento atualizado com sucesso.'
                    : 'Evento criado com sucesso.',
                'success'
            );
        } catch (err: any) {
            console.error('Error saving event:', err);
            showToast(
                `Erro ao salvar evento: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (event: Event) => {
        if (isDeleting) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', event.id);

            if (error) throw error;

            await fetchEvents();
            showToast('Evento excluído com sucesso.', 'success');
        } catch (err: any) {
            console.error('Error deleting event:', err);
            showToast(
                `Erro ao excluir evento: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsDeleting(false);
            setEventToDelete(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando gerenciador de eventos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Gerenciar Eventos</h2>
                <Button
                    type="button"
                    leftIcon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => handleOpenModal()}
                >
                    Novo evento
                </Button>
            </div>

            {/* Filtros de Eventos */}
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-3">
                <Input
                    label="Filtrar por data"
                    type="date"
                    value={filterDate}
                    onChange={(event) => setFilterDate(event.target.value)}
                />
                <Select
                    label="Usuário convocado"
                    value={filterUserId}
                    onChange={(event) => setFilterUserId(event.target.value)}
                >
                    <option value="">Todos os usuários</option>
                    {employees.map(employee => (
                        <option key={employee.id} value={employee.id}>
                            {employee.name}
                        </option>
                    ))}
                </Select>
                <Select
                    label="Categoria"
                    value={filterCategory}
                    onChange={(event) => setFilterCategory(event.target.value)}
                >
                    <option value="">Todas as categorias</option>
                    <option value="Social">Social</option>
                    <option value="Comemorativo">Comemorativo</option>
                    <option value="Corporativo">Corporativo</option>
                    <option value="Treinamento">Treinamento</option>
                    <option value="Evento da Empresa">Evento da Empresa</option>
                    <option value="Outro">Outro</option>
                </Select>
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
                        {filteredEvents.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                    Nenhum evento correspondente aos filtros.
                                </td>
                            </tr>
                        ) : (
                            filteredEvents.map((event) => (
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
                                        {event.attendees?.length || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Editar evento ${event.title}`}
                                                title="Editar evento"
                                                onClick={() => handleOpenModal(event)}
                                                className="h-9 w-9"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Excluir evento ${event.title}`}
                                                title="Excluir evento"
                                                onClick={() => setEventToDelete(event)}
                                                className="h-9 w-9 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                isOpen={eventToDelete !== null}
                type="danger"
                title="Excluir evento?"
                message={eventToDelete
                    ? `O evento "${eventToDelete.title}" será removido permanentemente.`
                    : ''}
                confirmText={isDeleting ? 'Excluindo...' : 'Excluir evento'}
                cancelText="Cancelar"
                onCancel={() => {
                    if (!isDeleting) setEventToDelete(null);
                }}
                onConfirm={() => {
                    if (eventToDelete) {
                        void handleDelete(eventToDelete);
                    }
                }}
            />

            {isModalOpen && (
                <ModalPortal
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] pandanet-modal-viewport"
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="event-modal-title"
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-24px_rgba(2,6,23,0.55)] animate-in fade-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-[#101d2e]"
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10">
                            <h3 id="event-modal-title" className="text-lg font-bold text-slate-950 dark:text-white">
                                {editingEvent ? 'Editar evento' : 'Novo evento'}
                            </h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Fechar"
                                disabled={isProcessing}
                                onClick={() => setIsModalOpen(false)}
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </Button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <Input
                                label="Título"
                                type="text"
                                required
                                autoFocus
                                value={formData.title}
                                onChange={(event) => setFormData({
                                    ...formData,
                                    title: event.target.value
                                })}
                            />
                            <Textarea
                                label="Descrição"
                                required
                                rows={3}
                                value={formData.description}
                                onChange={(event) => setFormData({
                                    ...formData,
                                    description: event.target.value
                                })}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Data"
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(event) => setFormData({
                                        ...formData,
                                        date: event.target.value
                                    })}
                                />
                                <Input
                                    label="Hora"
                                    type="time"
                                    required
                                    value={formData.time}
                                    onChange={(event) => setFormData({
                                        ...formData,
                                        time: event.target.value
                                    })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Local"
                                    type="text"
                                    required
                                    value={formData.location || ''}
                                    onChange={(event) => setFormData({
                                        ...formData,
                                        location: event.target.value
                                    })}
                                />
                                <Select
                                    label="Categoria"
                                    value={formData.category || 'Social'}
                                    onChange={(event) => setFormData({
                                        ...formData,
                                        category: event.target.value as any
                                    })}
                                >
                                    <option value="Social">Social</option>
                                    <option value="Comemorativo">Comemorativo</option>
                                    <option value="Corporativo">Corporativo</option>
                                    <option value="Treinamento">Treinamento</option>
                                    <option value="Evento da Empresa">Evento da Empresa</option>
                                    <option value="Outro">Outro</option>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Imagem</label>
                                <div className="flex space-x-4 mb-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" checked={formData.imageType !== 'upload'} onChange={() => setFormData({ ...formData, imageType: 'url' })} />
                                        <span>URL</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
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
                                        {imageFile && <p className="text-xs text-green-600 mt-2">Arquivo selecionado: {imageFile.name}</p>}
                                    </div>
                                ) : (
                                    <Input
                                        label="URL da imagem"
                                        type="url"
                                        placeholder="https://..."
                                        value={formData.imageUrl || ''}
                                        onChange={(event) => setFormData({
                                            ...formData,
                                            imageUrl: event.target.value
                                        })}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Convocados / Participantes</label>
                                <div className="max-h-40 overflow-y-auto border rounded p-3 space-y-2 bg-gray-50">
                                    {(employees || []).map(emp => (
                                        <label key={emp.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-all cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="rounded text-brand-primary focus:ring-brand-primary"
                                                checked={(formData.invited_ids || []).includes(emp.id)}
                                                onChange={() => toggleInvitee(emp.id)}
                                            />
                                            <div className="flex items-center space-x-2">
                                                <img src={emp.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                                                <span className="text-sm text-gray-700 font-medium">{emp.name}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2 font-medium">Selecione os usuários que devem comparecer.</p>
                            </div>
                            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pb-2 pt-4 dark:border-white/10 dark:bg-[#101d2e]">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={isProcessing}
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={isProcessing}
                                    loadingText="Salvando..."
                                >
                                    Salvar evento
                                </Button>
                            </div>
                        </form>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default EventsManager;
