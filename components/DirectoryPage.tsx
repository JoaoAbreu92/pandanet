import React from 'react';
import TeamDirectory from './TeamDirectory';
import type { Employee } from '../types';

interface DirectoryPageProps {
  employees: Employee[];
  onNavigate: (page: any, context?: any) => void;
  onImpersonateUser?: (employee: Employee) => void;
  initialSearch?: string;
}

const DirectoryPage: React.FC<DirectoryPageProps> = ({ employees, onNavigate, onImpersonateUser, initialSearch = '' }) => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-text font-brand">Diretório de Colaboradores</h1>
      <TeamDirectory employees={employees} onNavigate={onNavigate} onImpersonateUser={onImpersonateUser} initialSearch={initialSearch} />
    </div>
  );
};

export default DirectoryPage;
