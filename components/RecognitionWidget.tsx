import React from 'react';
import { SparklesIcon, TrashIcon } from './icons';
import type { Recognition, Employee } from '../types';
import { supabase } from '../supabaseClient';

interface RecognitionWidgetProps {
    recognitions: Recognition[];
    onRecognize: () => void;
    currentUser: Employee;
    onDelete?: () => void;
}

const RecognitionWidget: React.FC<RecognitionWidgetProps> = ({ recognitions, onRecognize, currentUser, onDelete }) => {
    // Show last 3, sort safely (newer first)
    const recentRecognitions = [...recognitions].sort((a, b) => {
        if (!isNaN(Number(a.id)) && !isNaN(Number(b.id))) {
            return Number(b.id) - Number(a.id);
        }
        return b.id.toString().localeCompare(a.id.toString());
    }).slice(0, 3);

    const handleRemove = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este reconhecimento?')) return;
        try {
            const { error } = await supabase.from('recognitions').delete().eq('id', id);
            if (error) throw error;
            if (onDelete) onDelete();
        } catch (err) {
            console.error('Erro ao remover:', err);
            alert('Não foi possível remover o reconhecimento.');
        }
    };

    const isAuthorized = (rec: Recognition) => {
        return rec.fromId === currentUser.id || currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin';
    };

    return (
        <div className="premium-card bg-white dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm uppercase flex items-center">
                    <SparklesIcon className="w-5 h-5 mr-2 text-amber-500" />
                    Mural
                </h3>
                <button onClick={onRecognize} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md hover:bg-amber-200 font-medium">
                    + Novo
                </button>
            </div>

            <div className="space-y-4">
                {recentRecognitions.map(rec => (
                    <div key={rec.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 relative group transition-all">
                        <div className="flex items-start space-x-2 mb-2">
                            <img src={rec.toAvatar} alt={rec.to} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 object-cover" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{rec.to}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">De: {rec.from}</p>
                            </div>
                            {isAuthorized(rec) && (
                                <button
                                    onClick={() => handleRemove(rec.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-3 mb-2">"{rec.message}"</p>
                        <span className="inline-block px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                            #{rec.value}
                        </span>
                    </div>
                ))}
            </div>

            {recentRecognitions.length === 0 && (
                <p className="text-[11px] text-gray-400 text-center py-4 italic">Nenhum reconhecimento ainda.</p>
            )}

            {recognitions.length > 3 && (
                <button className="w-full mt-3 text-xs text-brand-primary hover:underline text-center">
                    Ver todos
                </button>
            )}
        </div>
    );
};

export default RecognitionWidget;
