import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { Poll } from '../types';
import { ChartBarIcon } from './icons';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';

const CompanyPoll: React.FC = () => {
  const { currentUser } = useAuth();
  const [allPolls, setAllPolls] = useState<Poll[]>([]);
  const [pendingPolls, setPendingPolls] = useState<Poll[]>([]);
  const [votedPolls, setVotedPolls] = useState<Poll[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [votedIndex, setVotedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchAllPolls = async () => {
    if (!currentUser?.company_id) return;
    setLoading(true);
    try {
      // Fetch active polls
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (pollsError || !pollsData) {
        setAllPolls([]);
        setPendingPolls([]);
        setVotedPolls([]);
        return;
      }

      // Fetch options and votes in parallel
      const mappedPolls = await Promise.all(
        pollsData.map(async (p: any) => {
          const { data: optionsData } = await supabase
            .from('poll_options')
            .select('*')
            .eq('poll_id', p.id);

          const { data: votesData } = await supabase
            .from('poll_votes')
            .select('*')
            .eq('poll_id', p.id);

          const userVoted = (votesData || []).some(v => v.user_id === currentUser.id);

          return {
            id: p.id,
            question: p.question,
            cover_url: p.cover_url,
            show_button: p.show_button,
            link: p.link,
            button_style: p.button_style,
            options: (optionsData || []).map(opt => ({
              id: opt.id,
              text: opt.option_text || opt.text,
              votes: (votesData || []).filter(v => v.option_id === opt.id).length
            })),
            userVoted
          };
        })
      );

      const pending = mappedPolls.filter(p => !p.userVoted);
      const voted = mappedPolls.filter(p => p.userVoted);

      setAllPolls(mappedPolls);
      setPendingPolls(pending);
      setVotedPolls(voted);
      setSelectedOption(null);
    } catch (err) {
      console.error('Error fetching polls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPolls();
  }, [currentUser?.company_id, currentUser?.id]);

  const handleVote = async (pollId: string) => {
    if (selectedOption !== null && currentUser) {
      setSubmitting(true);
      try {
        const { error } = await supabase
          .from('poll_votes')
          .insert([
            {
              poll_id: pollId,
              option_id: selectedOption,
              user_id: currentUser.id,
              company_id: currentUser.company_id
            }
          ]);

        if (error) {
          if (error.code === '23505') {
            // Already voted
            await fetchAllPolls();
            return;
          }
          throw error;
        }

        await fetchAllPolls();
      } catch (err: any) {
        console.error('Error voting:', err);
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <Card title="Enquete Rápida">
        <div className="animate-pulse h-32 bg-gray-100 dark:bg-slate-800 rounded-2xl"></div>
      </Card>
    );
  }

  // Case 1: There are pending polls to answer
  if (pendingPolls.length > 0) {
    const currentPoll = pendingPolls[0];
    return (
      <Card title="Enquete Rápida" headerAction={<ChartBarIcon className="w-5 h-5 text-gray-400" />}>
        <div className="space-y-4">
          {currentPoll.cover_url && (
            <div className="relative w-full h-32 overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 mb-2">
              <img
                src={getCleanImageUrl(currentPoll.cover_url)}
                alt="Banner da Enquete"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <h4 className="font-extrabold text-slate-850 dark:text-white text-base">
            {currentPoll.question}
          </h4>

          <div className="space-y-2.5">
            {currentPoll.options.map(option => (
              <label
                key={option.id}
                htmlFor={`poll-option-${option.id}`}
                className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                  selectedOption === option.id
                    ? 'bg-brand-primary/10 border-brand-primary dark:bg-emerald-950/20'
                    : 'border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <input
                  type="radio"
                  id={`poll-option-${option.id}`}
                  name="poll"
                  value={option.id}
                  checked={selectedOption === option.id}
                  onChange={() => setSelectedOption(option.id)}
                  className="h-4 w-4 text-brand-primary border-gray-300 focus:ring-brand-primary"
                />
                <span className="ml-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  {option.text}
                </span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 items-center justify-between pt-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {pendingPolls.length} restante{pendingPolls.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => handleVote(currentPoll.id)}
              disabled={selectedOption === null || submitting}
              className="px-6 py-2 text-xs font-black text-white bg-brand-primary hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 rounded-xl transition-all shadow-md shadow-brand-primary/10"
            >
              {submitting ? 'Enviando...' : 'Votar'}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // Case 2: User answered all polls, show results of answered polls
  if (votedPolls.length > 0) {
    // Ensure index is within range
    const safeIndex = Math.min(votedIndex, votedPolls.length - 1);
    const activeResultPoll = votedPolls[safeIndex];
    const totalVotes = activeResultPoll.options.reduce((sum, option) => sum + option.votes, 0);

    return (
      <Card title="Enquete Rápida" headerAction={<ChartBarIcon className="w-5 h-5 text-gray-400" />}>
        <div className="space-y-4">
          {activeResultPoll.cover_url && (
            <div className="relative w-full h-32 overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 mb-2">
              <img
                src={getCleanImageUrl(activeResultPoll.cover_url)}
                alt="Banner da Enquete"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex justify-between items-start gap-2">
            <h4 className="font-extrabold text-slate-850 dark:text-white text-base">
              {activeResultPoll.question}
            </h4>
            <span className="text-[9px] bg-green-500/10 text-green-600 dark:text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-500/20 whitespace-nowrap">
              Respondida
            </span>
          </div>

          <div className="space-y-3">
            {activeResultPoll.options.map(option => {
              const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(0) : 0;
              return (
                <div key={option.id} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-400">{option.text}</span>
                    <span className="text-slate-850 dark:text-white">{percentage}% ({option.votes})</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t dark:border-slate-800 pt-3">
            <span className="text-[10px] text-gray-400 font-semibold">
              Total: {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
            </span>
            
            {votedPolls.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVotedIndex(prev => Math.max(0, prev - 1))}
                  disabled={safeIndex === 0}
                  className="p-1 px-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-30 text-slate-700 dark:text-slate-300"
                >
                  Anterior
                </button>
                <span className="text-xs font-extrabold text-slate-500">
                  {safeIndex + 1}/{votedPolls.length}
                </span>
                <button
                  onClick={() => setVotedIndex(prev => Math.min(votedPolls.length - 1, prev + 1))}
                  disabled={safeIndex === votedPolls.length - 1}
                  className="p-1 px-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-30 text-slate-700 dark:text-slate-300"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
          
          {activeResultPoll.show_button && activeResultPoll.link && (
            <div className="pt-2">
              <a
                href={activeResultPoll.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full px-4 py-2 text-xs font-black text-white bg-slate-900 dark:bg-slate-800 hover:brightness-95 rounded-xl transition-all shadow-md"
              >
                Saiba mais
              </a>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Case 3: No polls active/available at all
  return (
    <Card title="Enquete Rápida" headerAction={<ChartBarIcon className="w-5 h-5 text-gray-400" />}>
      <p className="text-sm text-slate-400 text-center py-6">
        Nenhuma enquete ativa no momento.
      </p>
    </Card>
  );
};

export default CompanyPoll;