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
    <div className={`premium-card ${noPadding ? '' : 'p-6'} dark:bg-slate-800 dark:border-slate-700 ${className}`}>
      {title && (
        <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3 dark:border-slate-800/60">
          <div className="flex items-center space-x-2.5">
            {icon && <span className="text-brand-primary">{icon}</span>}
            <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 tracking-tight">{title}</h3>
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