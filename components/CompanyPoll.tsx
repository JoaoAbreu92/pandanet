import React, { useState, useEffect } from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { Poll } from '../types';
import { ChartBarIcon } from './icons';

interface CompanyPollProps {
  poll: Poll | null;
}

const CompanyPoll: React.FC<CompanyPollProps> = ({ poll: initialPoll }) => {
  const [poll, setPoll] = useState<Poll | null>(initialPoll);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    setPoll(initialPoll);
    setHasVoted(false);
    setSelectedOption(null);
  }, [initialPoll]);

  if (!poll) {
    return (
      <Card title="Enquete Rápida" headerAction={<ChartBarIcon className="w-5 h-5 text-gray-400" />}>
         <p className="text-sm text-brand-subtle-text text-center py-4">Nenhuma enquete ativa no momento.</p>
      </Card>
    );
  }

  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);

  const handleVote = () => {
    if (selectedOption !== null && poll) {
      const newOptions = poll.options.map(option =>
        option.id === selectedOption ? { ...option, votes: option.votes + 1 } : option
      );
      setPoll({ ...poll, options: newOptions });
      setHasVoted(true);
    }
  };

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
                    <span className="font-bold text-brand-text">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
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
          className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:bg-gray-300"
        >
          Votar
        </button>
      )}
    </Card>
  );
};

export default CompanyPoll;