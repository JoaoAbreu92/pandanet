import React, { useState, useEffect } from 'react';
import { ChatBubbleLeftRightIcon } from './icons';
import type { Poll } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const SurveysPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPolls = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            // Fetch active polls
            const { data: pollsData, error: pollsError } = await supabase
                .from('polls')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .eq('active', true);

            if (pollsError) throw pollsError;

            if (pollsData) {
                const formattedPolls: Poll[] = [];

                for (const p of pollsData) {
                    // Fetch options for each poll
                    const { data: optionsData } = await supabase
                        .from('poll_options')
                        .select('*')
                        .eq('poll_id', p.id);

                    formattedPolls.push({
                        id: p.id,
                        question: p.question,
                        options: (optionsData || []).map((o: any) => ({
                            id: o.id,
                            text: o.text,
                            votes: o.votes || 0 // Assuming votes column exists in poll_options
                        }))
                    });
                }
                setPolls(formattedPolls);
            }
        } catch (err) {
            console.error("Error fetching polls:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolls();
    }, [currentUser?.company_id]);

    const handleVote = async (pollId: string, optionId: string) => {
        if (!currentUser) return;

        // Optimistic update
        const updatedPolls = polls.map(p => {
            if (p.id === pollId) {
                return {
                    ...p,
                    options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o)
                };
            }
            return p;
        });
        setPolls(updatedPolls);

        try {
            // Check if user already voted? Requires poll_votes table check.
            // For now, simple increment in poll_options via RPC is best to avoid race conditions,
            // or just update directly.
            // Let's assume poll_votes table exists to limit 1 vote per user.

            // Check existing vote
            const { data: existingVote } = await supabase
                .from('poll_votes')
                .select('*')
                .eq('poll_id', pollId)
                .eq('user_id', currentUser.id)
                .single();

            if (existingVote) {
                alert("Você já votou nesta enquete.");
                fetchPolls(); // Revert
                return;
            }

            // Insert vote
            const { error: voteError } = await supabase
                .from('poll_votes')
                .insert({ poll_id: pollId, option_id: optionId, user_id: currentUser.id });

            if (voteError) throw voteError;

            // Increment count in poll_options (if we rely on it for display)
            // RPC increment is safer.
            const { error: incrementError } = await supabase.rpc('increment_poll_option_votes', { option_id: optionId });

            // fall back to direct update if RPC missing?
            if (incrementError) {
                // Try manual update
                const poll = polls.find(p => p.id === pollId);
                const option = poll?.options.find(o => o.id === optionId);
                if (option) {
                    await supabase.from('poll_options').update({ votes: option.votes + 1 }).eq('id', optionId);
                }
            }
        } catch (err) {
            console.error("Error voting:", err);
            fetchPolls(); // Revert
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando pesquisas...</div>;

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
                                    <button
                                        key={option.id}
                                        onClick={() => handleVote(poll.id, option.id)}
                                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-brand-primary hover:bg-emerald-50 transition-all group relative"
                                    >
                                        <div className="flex justify-between items-center z-10 relative">
                                            <span className="font-medium text-gray-700 group-hover:text-brand-primary">{option.text}</span>
                                            <span className="text-sm text-gray-400">{option.votes} votos</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden z-10 relative">
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
