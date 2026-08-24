import React, { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';

interface StarRatingProps {
    onSubmit: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);

    const handleSubmit = () => {
        if (rating > 0) {
            onSubmit(rating);
        }
    }

    return (
        <div className="flex flex-col items-start space-y-3">
            <div className="flex items-center">
                {[...Array(5)].map((_, index) => {
                    const ratingValue = index + 1;
                    return (
                        <button
                            type="button"
                            key={index}
                            onClick={() => setRating(ratingValue)}
                            onMouseEnter={() => setHover(ratingValue)}
                            onMouseLeave={() => setHover(0)}
                            className="p-1 focus:outline-none transition-transform hover:scale-110"
                            aria-label={`Rate ${ratingValue} out of 5 stars`}
                        >
                            <StarIcon
                                className={`w-8 h-8 transition-colors duration-200 ${ratingValue <= (hover || rating)
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                    }`}
                            />
                        </button>
                    );
                })}
            </div>
            <button
                onClick={handleSubmit}
                disabled={rating === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-primary border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:bg-gray-300"
            >
                Enviar Avaliação
            </button>
        </div>
    )
}

export default StarRating;