
import React, { useState } from 'react';
import type { Employee, Recognition } from '../types';
import { XMarkIcon } from './icons';

interface RecognitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'> & { toUserId: string }) => void;
    employees: Employee[];
    currentUserId: string;
}

const RecognitionModal: React.FC<RecognitionModalProps> = ({ isOpen, onClose, onSubmit, employees, currentUserId }) => {
    const [selectedUserId, setSelectedUserId] = useState('');
    const [message, setMessage] = useState('');
    const [value, setValue] = useState<Recognition['value']>('Trabalho em Equipe');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedUser = employees.find(emp => emp.id === selectedUserId);
        if (!selectedUser) return;

        onSubmit({
            to: selectedUser.name,
            toAvatar: selectedUser.avatarUrl,
            toUserId: selectedUser.id,
            message,
            value
        });
        onClose();
        // Reset form
        setSelectedUserId('');
        setMessage('');
        setValue('Trabalho em Equipe');
    };

    // Filter out current user from selection list
    const availableEmployees = employees.filter(emp => emp.id !== currentUserId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="font-bold text-lg text-gray-800">Reconhecer Colega</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quem você quer reconhecer?</label>
                        <select
                            required
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring focus:ring-brand-primary/20 py-2.5 px-3 bg-white"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                        >
                            <option value="">Selecione um colega...</option>
                            {availableEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor Demononstrado</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Trabalho em Equipe', 'Inovação', 'Foco no Cliente', 'Qualidade'].map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setValue(v as any)}
                                    className={`text-sm py-2 px-3 rounded-md border transition-colors ${value === v ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                        <textarea
                            required
                            placeholder="Descreva o motivo do reconhecimento..."
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring focus:ring-brand-primary/20 py-2 px-3 min-h-[100px] resize-none"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!selectedUserId || !message}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Enviar Reconhecimento
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RecognitionModal;
