import React, { useState } from 'react';
import Card from './Card';
import { SparklesIcon, PlusIcon } from './icons';
import type { Recognition, Employee } from '../types';
import RecognitionModal from './RecognitionModal';

interface RecognitionWallProps {
    recognitions?: Recognition[];
    employees?: Employee[];
    currentUser?: Employee;
    onAddRecognition?: (rec: Recognition) => void;
}

const RecognitionCard: React.FC<{ recognition: Recognition }> = ({ recognition }) => {
    const valueColors: { [key: string]: string } = {
        'Trabalho em Equipe': 'bg-blue-100 text-blue-800',
        'Inovação': 'bg-purple-100 text-purple-800',
        'Foco no Cliente': 'bg-green-100 text-green-800',
        'Qualidade': 'bg-yellow-100 text-yellow-800',
    };

    return (
        <div className="flex-shrink-0 w-72 bg-white p-4 rounded-lg shadow-md border space-y-3">
            <div className="flex items-center">
                <img src={recognition.toAvatar} alt={recognition.to} className="w-10 h-10 rounded-full z-10" />
                <img src={recognition.fromAvatar} alt={recognition.from} className="w-10 h-10 rounded-full -ml-4" />
                <div className="ml-3">
                    <p className="font-semibold text-sm text-brand-text">{recognition.to}</p>
                    <p className="text-xs text-brand-subtle-text">Reconhecido por {recognition.from}</p>
                </div>
            </div>
            <p className="text-sm text-brand-subtle-text italic">"{recognition.message}"</p>
            <div className="pt-2">
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${valueColors[recognition.value] || 'bg-gray-100 text-gray-800'}`}>
                    #{recognition.value.replace(' ', '')}
                </span>
            </div>
        </div>
    );
};

const RecognitionWall: React.FC<RecognitionWallProps> = ({ recognitions = [], employees = [], currentUser, onAddRecognition }) => {
    const [showModal, setShowModal] = useState(false);

    const handleRecognitionSubmit = (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'>) => {
        if (onAddRecognition && currentUser) {
            const newRec: Recognition = {
                id: Date.now().toString(),
                from: currentUser.name,
                fromAvatar: currentUser.avatarUrl,
                ...data
            };
            onAddRecognition(newRec);
        }
    };

    return (
        <>
            <Card title="Mural de Reconhecimento" headerAction={
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!currentUser}
                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>Reconhecer</span>
                </button>
            }>
                {recognitions.length > 0 ? (
                    <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4">
                        {recognitions.map(rec => (
                            <RecognitionCard key={rec.id} recognition={rec} />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500 italic">
                        Nenhum reconhecimento ainda. Seja o primeiro a reconhecer um colega!
                    </div>
                )}
            </Card>

            {currentUser && (
                <RecognitionModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleRecognitionSubmit}
                    employees={employees}
                    currentUserId={currentUser.id}
                />
            )}
        </>
    );
};

export default RecognitionWall;