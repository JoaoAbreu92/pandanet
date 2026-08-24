import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, TrashIcon, XCircleIcon } from './icons';
import type { Poll } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const PollFormModal: React.FC<{
    onClose: () => void;
    onSave: () => void;
    isProcessing?: boolean;
}> = ({ onClose, onSave, isProcessing }) => {
    const { currentUser } = useAuth();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        setOptions([...options, '']);
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.trim() !== '');
        if (!question.trim() || validOptions.length < 2) {
            alert("A enquete precisa de uma pergunta e pelo menos duas opções.");
            return;
        }

        if (!currentUser?.company_id) return;

        try {
            // 1. Create Poll
            const { data: poll, error: pollError } = await supabase
                .from('polls')
                .insert([{
                    question,
                    company_id: currentUser.company_id,
                    status: 'active'
                }])
                .select()
                .single();

            if (pollError) throw pollError;

            // 2. Create Options
            const optionsToInsert = validOptions.map(text => ({
                poll_id: poll.id,
                text,
                votes: 0
            }));

            const { error: optionsError } = await supabase
                .from('poll_options')
                .insert(optionsToInsert);

            if (optionsError) throw optionsError;

            onSave();
            onClose();
        } catch (err) {
            console.error('Error creating poll:', err);
            alert('Erro ao criar enquete.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" disabled={isProcessing}><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">Criar Nova Enquete</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Pergunta</label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            required
                            placeholder="Ex: Onde deve ser a festa de fim de ano?"
                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text mb-2">Opções</label>
                        <div className="space-y-2">
                            {options.map((opt, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => handleOptionChange(index, e.target.value)}
                                        placeholder={`Opção ${index + 1}`}
                                        className="flex-1 border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2"
                                    />
                                    {options.length > 2 && (
                                        <button type="button" onClick={() => removeOption(index)} className="text-red-500 hover:text-red-700">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addOption} className="mt-2 text-sm text-brand-primary font-medium hover:underline flex items-center">
                            <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Opção
                        </button>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">
                            {isProcessing ? 'Criando...' : 'Criar Enquete'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PollManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchPolls = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('polls')
                .select('*, poll_options(*)')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPolls(data || []);
        } catch (err) {
            console.error('Error fetching polls:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolls();
    }, [currentUser?.company_id]);

    const handleDelete = async (pollId: string) => {
        if (window.confirm("Tem certeza que deseja excluir esta enquete?")) {
            try {
                const { error } = await supabase
                    .from('polls')
                    .delete()
                    .eq('id', pollId);
                if (error) throw error;
                fetchPolls();
            } catch (err) {
                console.error('Error deleting poll:', err);
                alert('Erro ao excluir enquete.');
            }
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando enquetes...</div>;

    return (
        <>
            <Card title="Gerenciar Enquetes" headerAction={
                <button onClick={() => setModalOpen(true)} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                    <span>Nova Enquete</span>
                </button>
            }>
                <div className="space-y-4">
                    {polls.length === 0 ? (
                        <p className="text-brand-subtle-text text-sm py-4 text-center">Nenhuma enquete ativa no momento.</p>
                    ) : (
                        polls.map(poll => (
                            <div key={poll.id} className="border rounded-lg p-4 bg-gray-50 relative group hover:border-brand-primary transition-all">
                                <button onClick={() => handleDelete(poll.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                <h4 className="font-bold text-brand-text mb-2 pr-8">{poll.question}</h4>
                                <ul className="space-y-1">
                                    {poll.poll_options?.map((opt: any) => (
                                        <li key={opt.id} className="text-sm text-brand-subtle-text flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                                            <span>{opt.text}</span>
                                            <span className="font-medium bg-white px-2 py-0.5 rounded border text-xs">{opt.votes || 0} votos</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-400">Total de votos: {poll.poll_options?.reduce((acc: number, curr: any) => acc + (curr.votes || 0), 0)}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${poll.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {poll.status === 'active' ? 'Ativa' : 'Encerrada'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
            {isModalOpen && <PollFormModal onClose={() => setModalOpen(false)} onSave={fetchPolls} isProcessing={isProcessing} />}
        </>
    );
};

export default PollManager;