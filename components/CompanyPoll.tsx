import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { Poll } from '../types';
import { ChartBarIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const CompanyPoll: React.FC = () => {
  const { profile: currentUser } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLatestPoll = async () => {
    if (!currentUser?.company_id) return;
    setLoading(true);
    try {
      // 1. Fetch latest poll
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (pollError || !pollData) {
        setPoll(null);
        return;
      }

      // 2. Fetch options
      const { data: optionsData } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', pollData.id);

      // 3. Fetch votes
      const { data: votesData } = await supabase
        .from('poll_votes')
        .select('*')
        .eq('poll_id', pollData.id);

      // 4. Check if current user has voted
      const userVote = (votesData || []).find(v => v.user_id === currentUser.id);
      if (userVote) {
        setHasVoted(true);
      }

      // 5. Map to Poll type
      const mappedPoll: Poll = {
        id: pollData.id,
        question: pollData.question,
        options: (optionsData || []).map(opt => ({
          id: opt.id,
          text: opt.option_text || opt.text, // Handle both possible column names
          votes: (votesData || []).filter(v => v.option_id === opt.id).length
        }))
      };

      setPoll(mappedPoll);
    } catch (err) {
      console.error('Error fetching latest poll:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestPoll();
  }, [currentUser?.company_id]);

  const handleVote = async () => {
    if (selectedOption !== null && poll && currentUser) {
      try {
        const { error } = await supabase
          .from('poll_votes')
          .insert([
            {
              poll_id: poll.id,
              option_id: selectedOption,
              user_id: currentUser.id
            }
          ]);

        if (error) throw error;

        setHasVoted(true);
        fetchLatestPoll(); // Refresh data
      } catch (err) {
        console.error('Error voting:', err);
        alert('Erro ao registrar voto.');
      }
    }
  };

  if (loading) return <Card title="Enquete Rápida"><div className="animate-pulse h-32 bg-gray-100 rounded-md"></div></Card>;

  if (!poll) {
    return (
      <Card title="Enquete Rápida" headerAction={<ChartBarIcon className="w-5 h-5 text-gray-400" />}>
        <p className="text-sm text-brand-subtle-text text-center py-4">Nenhuma enquete ativa no momento.</p>
      </Card>
    );
  }

  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);

  return (
    <Card title="Enquete Rápida" headerAction={<ChartBarIcon className="w-5 h-5 text-gray-400" />}>
      <p className="font-semibold text-brand-text mb-4">{poll.question}</p>
      <div className="space-y-3">
        {poll.options.map(option => {
          const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(0) : 0;
          return (
            <div key={option.id}>
              {hasVoted ? (
                <div className="w-full">
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-medium text-brand-subtle-text">{option.text}</span>
                    <span className="font-bold text-brand-text">{percentage}% ({option.votes})</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-brand-primary h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor={`poll-option-${option.id}`}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedOption === option.id ? 'bg-emerald-50 border-brand-primary' : 'border-gray-200 hover:bg-gray-50'}`}
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
                  <span className="ml-3 text-sm font-medium text-brand-text">{option.text}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
      {!hasVoted && (
        <button
          onClick={handleVote}
          disabled={selectedOption === null}
          className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:bg-gray-300 transition-colors shadow-md"
        >
          Votar
        </button>
      )}
      {hasVoted && (
        <p className="mt-4 text-center text-xs text-gray-400">Obrigado por votar! Total de {totalVotes} votos.</p>
      )}
    </Card>
  );
};

export default CompanyPoll;