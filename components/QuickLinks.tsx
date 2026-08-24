import React from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { QuickLink, Employee } from '../types';
// FIX: Update icon imports for consistency and correctness.
import { FolderIcon, CalendarIcon, UsersIcon, Cog6ToothIcon } from './icons';

interface QuickLinksProps {
  onNavigate: (page: string) => void;
}

interface QuickLinksProps {
  onNavigate: (page: string) => void;
  currentUser: Employee;
}

const QuickLinks: React.FC<QuickLinksProps> = ({ onNavigate, currentUser }) => {
  const links: QuickLink[] = [
    { label: 'Formulários RH', icon: <FolderIcon className="w-7 h-7" />, page: 'forms', permission: 'viewForms' },
    { label: 'Painel de T.I.', icon: <Cog6ToothIcon className="w-7 h-7" />, page: 'ti-dashboard', permission: 'viewTiDashboard' },
    { label: 'Diretório de Pessoas', icon: <UsersIcon className="w-7 h-7" />, page: 'directory', permission: 'viewDirectory' },
    { label: 'Agendar Evento', icon: <CalendarIcon className="w-7 h-7" />, page: 'calendar', permission: 'viewCalendar' },
  ].filter(link => {
    if (currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin') return true;
    return (currentUser.permissions as any)[link.permission] === true;
  }) as QuickLink[];

  return (
    <Card title="Links Rápidos">
      <div className="grid grid-cols-2 gap-4">
        {links.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => onNavigate(link.page)}
            className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-600 transition-colors duration-200 group"
          >
            <div className="text-brand-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mb-2">
              {link.icon}
            </div>
            <span className="text-sm font-semibold text-brand-subtle-text dark:text-gray-200 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 text-center">{link.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default QuickLinks;