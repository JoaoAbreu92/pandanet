import React from 'react';
import TeamDirectory from './TeamDirectory';
import type { Employee } from '../types';

interface DirectoryPageProps {
  employees: Employee[];
  onNavigate: (page: any, context?: any) => void;
}

const DirectoryPage: React.FC<DirectoryPageProps> = ({ employees, onNavigate }) => {
  return (
    <div className="space-y-6">
       <h1 className="text-3xl font-bold text-brand-text">Diretório de Colaboradores</h1>
      <TeamDirectory employees={employees} onNavigate={onNavigate} />
    </div>
  );
};

export default DirectoryPage;
