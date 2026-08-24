import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
  hideTypeBorder?: boolean;
  icon?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', headerAction, noPadding = false, hideTypeBorder = false, icon }) => {
  return (
    <div className={`premium-card ${hideTypeBorder ? '' : 'border-t-4 border-emerald-500'} ${noPadding ? '' : 'p-6'} dark:bg-slate-800 dark:border-slate-700 ${className}`}>
      {title && (
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            {icon}
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          </div>
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