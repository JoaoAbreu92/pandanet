import React from 'react';
import { ChatBubbleLeftRightIcon } from './icons';
import type { Poll } from '../types';

interface SurveysPageProps {
    polls: Poll[];
}

const SurveysPage: React.FC<SurveysPageProps> = ({ polls }) => {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <ChatBubbleLeftRightIcon className="w-8 h-8 mr-2 text-brand-primary" />
                Pesquisas de Clima e Opinião
            </h1>

            {polls.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm text-center">
                    <p className="text-gray-500">Nenhuma pesquisa ativa no momento.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {polls.map(poll => (
                        <div key={poll.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-800">{poll.question}</h3>
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Ativa</span>
                            </div>
                            <div className="space-y-3">
                                {poll.options.map(option => (
                                    <button key={option.id} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-brand-primary hover:bg-emerald-50 transition-all group">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-gray-700 group-hover:text-brand-primary">{option.text}</span>
                                            <span className="text-sm text-gray-400">{option.votes} votos</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="bg-brand-primary h-full transition-all duration-500"
                                                style={{ width: `${(option.votes / Math.max(1, poll.options.reduce((a, b) => a + b.votes, 0))) * 100}%` }}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SurveysPage;
