import React from 'react';
import { SparklesIcon, PlusIcon } from './icons';
import type { Recognition } from '../types';

interface RecognitionWidgetProps {
    recognitions: Recognition[];
    onRecognize: () => void;
}

const RecognitionWidget: React.FC<RecognitionWidgetProps> = ({ recognitions, onRecognize }) => {
    // Show last 3, sort safely (newer first)
    const recentRecognitions = [...recognitions].sort((a, b) => {
        // Simple comparison if IDs are strings, or try numeric if they are numbers
        if (!isNaN(Number(a.id)) && !isNaN(Number(b.id))) {
            return Number(b.id) - Number(a.id);
        }
        return b.id.toString().localeCompare(a.id.toString());
    }).slice(0, 3);

    return (
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 text-sm uppercase flex items-center">
                    <SparklesIcon className="w-5 h-5 mr-2 text-amber-500" />
                    Mural
                </h3>
                <button onClick={onRecognize} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md hover:bg-amber-200 font-medium">
                    + Novo
                </button>
            </div>

            <div className="space-y-4">
                {recentRecognitions.map(rec => (
                    <div key={rec.id} className="bg-gray-50 rounded-lg p-3 relative group">
                        <div className="flex items-start space-x-2 mb-2">
                            <img src={rec.toAvatar} alt={rec.to} className="w-8 h-8 rounded-full border-2 border-white" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">{rec.to}</p>
                                <p className="text-[10px] text-gray-500 truncate">De: {rec.from}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 italic line-clamp-3 mb-2">"{rec.message}"</p>
                        <span className="inline-block px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-semibold text-gray-500">
                            #{rec.value}
                        </span>
                    </div>
                ))}
            </div>

            {recognitions.length > 3 && (
                <button className="w-full mt-3 text-xs text-brand-primary hover:underline text-center">
                    Ver todos
                </button>
            )}
        </div>
    );
};

export default RecognitionWidget;
