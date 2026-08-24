import React, { useState } from 'react';
import Card from './Card';
import { PlusIcon, TrashIcon, XCircleIcon } from './icons';
import type { Poll } from '../types';

interface PollManagerProps {
    polls: Poll[];
    setPolls: (polls: Poll[]) => void;
}

const PollFormModal: React.FC<{
    onClose: () => void;
    onSave: (poll: Omit<Poll, 'id'>) => void;
}> = ({ onClose, onSave }) => {
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.trim() !== '');
        if (!question.trim() || validOptions.length < 2) {
            alert("A enquete precisa de uma pergunta e pelo menos duas opções.");
            return;
        }

        const pollData: Omit<Poll, 'id'> = {
            question,
            options: validOptions.map((text, index) => ({
                id: index + 1,
                text,
                votes: 0
            }))
        };
        onSave(pollData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
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
                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"
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
                                        className="flex-1 border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"
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
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Criar Enquete</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PollManager: React.FC<PollManagerProps> = ({ polls, setPolls }) => {
    const [isModalOpen, setModalOpen] = useState(false);

    const handleCreatePoll = (pollData: Omit<Poll, 'id'>) => {
        const newPoll: Poll = { ...pollData, id: Date.now() };
        // Replace existing polls or add to top (currently logic replaces or stacks, assuming single active poll usually)
        setPolls([newPoll, ...polls]); 
        setModalOpen(false);
    };

    const handleDelete = (pollId: number) => {
        if (window.confirm("Tem certeza que deseja excluir esta enquete?")) {
            setPolls(polls.filter(p => p.id !== pollId));
        }
    };

    return (
        <>
            <Card title="Gerenciar Enquetes" headerAction={
                <button onClick={() => setModalOpen(true)} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                    <PlusIcon className="w-4 h-4" />
                    <span>Nova Enquete</span>
                </button>
            }>
                <div className="space-y-4">
                    {polls.length === 0 ? (
                        <p className="text-brand-subtle-text text-sm">Nenhuma enquete ativa no momento.</p>
                    ) : (
                        polls.map(poll => (
                            <div key={poll.id} className="border rounded-lg p-4 bg-gray-50 relative">
                                <button onClick={() => handleDelete(poll.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                <h4 className="font-bold text-brand-text mb-2">{poll.question}</h4>
                                <ul className="space-y-1">
                                    {poll.options.map(opt => (
                                        <li key={opt.id} className="text-sm text-brand-subtle-text flex justify-between">
                                            <span>{opt.text}</span>
                                            <span className="font-medium">{opt.votes} votos</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-gray-400 mt-2">Total de votos: {poll.options.reduce((acc, curr) => acc + curr.votes, 0)}</p>
                            </div>
                        ))
                    )}
                </div>
            </Card>
            {isModalOpen && <PollFormModal onClose={() => setModalOpen(false)} onSave={handleCreatePoll} />}
        </>
    );
};

export default PollManager;