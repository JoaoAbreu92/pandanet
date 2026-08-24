import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', headerAction }) => {
  return (
    <div className={`bg-white rounded-lg shadow-lg border-t-4 border-brand-primary p-6 transition-all duration-300 hover:shadow-xl dark:bg-gray-800 dark:border-brand-primary ${className}`}>
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
        {headerAction}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
};

export default Card;