import React from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { QuickLink } from '../types';
// FIX: Update icon imports for consistency and correctness.
import { FolderIcon, CalendarIcon, UsersIcon, Cog6ToothIcon } from './icons';

interface QuickLinksProps {
  onNavigate: (page: string) => void;
}

// FIX: Corrected page links and updated icons for consistency.
const links: QuickLink[] = [
  { label: 'Formulários RH', icon: <FolderIcon className="w-7 h-7" />, page: 'forms' },
  { label: 'Painel de T.I.', icon: <Cog6ToothIcon className="w-7 h-7" />, page: 'ti-dashboard' },
  { label: 'Diretório de Pessoas', icon: <UsersIcon className="w-7 h-7" />, page: 'directory' },
  { label: 'Agendar Evento', icon: <CalendarIcon className="w-7 h-7" />, page: 'calendar' },
];

const QuickLinks: React.FC<QuickLinksProps> = ({ onNavigate }) => {
  return (
    <Card title="Links Rápidos">
      <div className="grid grid-cols-2 gap-4">
        {links.map((link) => (
          <a
            key={link.label}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(link.page);
            }}
            className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-emerald-50 transition-colors duration-200 group"
          >
            <div className="text-brand-primary group-hover:text-emerald-600 mb-2">
              {link.icon}
            </div>
            <span className="text-sm font-semibold text-brand-subtle-text group-hover:text-emerald-800 text-center">{link.label}</span>
          </a>
        ))}
      </div>
    </Card>
  );
};

export default QuickLinks;