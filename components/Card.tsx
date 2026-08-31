import React from 'react';
interface CardProps { title?: string; children: React.ReactNode; className?: string; headerAction?: React.ReactNode; noPadding?: boolean; hideTypeBorder?: boolean; icon?: React.ReactNode; }

const Card: React.FC<CardProps> = ({ title, children, className = '', headerAction, noPadding = false, hideTypeBorder = false, icon }) => (
  <section className={`premium-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)] transition-[border-color,box-shadow,transform] dark:border-white/10 dark:bg-slate-900/80 ${hideTypeBorder ? '' : 'border-t-slate-200 dark:border-t-white/10'} ${className}`}>
    {title && <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">{icon && <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">{icon}</span>}<h3 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">{title}</h3></div>
      {headerAction && <div className="flex flex-wrap items-center gap-2">{headerAction}</div>}
    </header>}
    <div className={noPadding ? '' : 'p-5 sm:p-6'}>{children}</div>
  </section>
);
export default Card;
