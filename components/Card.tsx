import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
  hideTypeBorder?: boolean;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', headerAction, noPadding = false, hideTypeBorder = false }) => {
  return (
    <div className={`premium-card ${hideTypeBorder ? '' : 'border-t-4 border-emerald-500'} ${noPadding ? '' : 'p-6'} dark:bg-gray-800 dark:border-gray-700 ${className}`}>
      {title && (
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
          {headerAction}
        </div>
      )}
      <div className={noPadding ? '' : ''}>
        {children}
      </div>
    </div>
  );
};

export default Card;