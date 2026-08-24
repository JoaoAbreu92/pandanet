import React, { useState } from 'react';
import type { Ticket, TicketPriority, Employee } from '../types';
import { PhotoIcon, VideoCameraIcon, XCircleIcon } from './icons';

interface TicketFormProps {
    onSubmit: (ticket: any) => void;
    onCancel: () => void;
    allEmployees: Employee[];
    currentUser: Employee;
    departments: any[];
}

const TicketForm: React.FC<TicketFormProps> = ({ onSubmit, onCancel, allEmployees, currentUser, departments }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TicketPriority>('Média');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [assignedTo, setAssignedTo] = useState<string>('');
    const [mediaFiles, setMediaFiles] = useState<{ file: File; url: string; type: 'image' | 'video' }[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const videoInputRef = React.useRef<HTMLInputElement>(null);

    // Pre-select TI department if exists
    React.useEffect(() => {
        if (departments.length > 0 && !departmentId) {
            const tiDept = departments.find(d => d.name.trim().toUpperCase() === 'TI');
            if (tiDept) setDepartmentId(tiDept.id);
        }
    }, [departments, departmentId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            alert('Por favor, preencha o título e a descrição.');
            return;
        }
        onSubmit({
            title,
            description,
            priority,
            department_id: departmentId || null,
            assigned_to_id: assignedTo || null,
            mediaFiles: mediaFiles.map(m => m.file),
            mediaType: mediaFiles.length > 0 ? mediaFiles[0].type : null
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (type === 'video') {
            const file = files[0] as File;
            if (file.size > 10 * 1024 * 1024) {
                alert('O vídeo deve ter no máximo 10MB.');
                return;
            }
            setMediaFiles([{ file, url: URL.createObjectURL(file), type: 'video' }]);
        } else {
            const remaining = 4 - mediaFiles.filter(m => m.type === 'image').length;
            const toAdd = files.slice(0, remaining).map(file => ({
                file: file as File,
                url: URL.createObjectURL(file as File),
                type: 'image' as const
            }));
            setMediaFiles(prev => {
                const currentImages = prev.filter(m => m.type === 'image');
                if (currentImages.length + toAdd.length > 4) {
                    alert('Você pode adicionar no máximo 4 fotos.');
                    return prev;
                }
                // Se adicionar imagem, remove vídeo se houver
                return [...currentImages, ...toAdd];
            });
        }
    };

    const removeFile = (index: number) => {
        setMediaFiles(prev => prev.filter((_, i) => i !== index));
    };

    const technicians = allEmployees.filter(e => {
        if (!departmentId) return true;

        // Get the selected department name to use as fallback check for team
        const selectedDept = departments.find(d => d.id === departmentId);
        const deptName = selectedDept?.name.toUpperCase();

        // Check department_id or team/role as fallback
        return (e as any).department_id === departmentId ||
            (deptName && e.team?.toUpperCase() === deptName) ||
            (deptName === 'TI' && (e.role?.includes('Técnico') || e.team === 'TI'));
    });

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-brand-text">Departamento Destino</label>
                    <select
                        value={departmentId}
                        onChange={(e) => {
                            setDepartmentId(e.target.value);
                            setAssignedTo('');
                        }}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option value="">Selecione um Departamento</option>
                        {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-brand-text">Prioridade</label>
                    <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as TicketPriority)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option>Baixa</option>
                        <option>Média</option>
                        <option>Alta</option>
                        <option>Urgente</option>
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="title" className="block text-sm font-medium text-brand-text">Título</label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm bg-white text-brand-text"
                    required
                />
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-brand-text">Descrição</label>
                <textarea
                    id="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm bg-white text-brand-text"
                    required
                ></textarea>
            </div>
            {((departmentId && technicians.length > 0) || (!departmentId && allEmployees.length > 0)) && (
                <div>
                    <label htmlFor="assignedTo" className="block text-sm font-medium text-brand-text">
                        {departmentId ? 'Direcionar para Pessoa Específica (Opcional)' : 'Mencionar Pessoa (Opcional)'}
                    </label>
                    <select
                        id="assignedTo"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option value="">{departmentId ? 'Qualquer Pessoa do Setor' : 'Selecione uma Pessoa'}</option>
                        {technicians.map(user => (
                            <option key={user.id} value={user.id}>{user.name} {user.team ? `(${user.team})` : ''}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-sm font-medium text-brand-text">Anexar Mídia (Opcional)</label>
                <p className="text-xs text-brand-subtle-text mb-2">Adicione fotos (max 4) ou 1 vídeo (max 10MB) para ajudar a descrever o problema.</p>
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={mediaFiles.some(m => m.type === 'video') || mediaFiles.filter(m => m.type === 'image').length >= 4}
                        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <PhotoIcon className="w-5 h-5 text-emerald-500" />
                        <span>Foto</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={mediaFiles.length > 0}
                        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <VideoCameraIcon className="w-5 h-5 text-blue-500" />
                        <span>Vídeo</span>
                    </button>
                </div>
                <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={(e) => handleFileChange(e, 'image')} />
                <input type="file" ref={videoInputRef} hidden accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />

                {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        {mediaFiles.map((media, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
                                {media.type === 'image' ? (
                                    <img src={media.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <video src={media.url} className="w-full h-full object-cover" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeFile(idx)}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                    Cancelar
                </button>
                <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-all shadow-md">
                    Enviar Chamado
                </button>
            </div>
        </form>
    );
};

export default TicketForm;