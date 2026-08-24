import React from 'react';
import TeamDirectory from './TeamDirectory';
import type { Employee } from '../types';

interface DirectoryPageProps {
  employees: Employee[];
}

const DirectoryPage: React.FC<DirectoryPageProps> = ({ employees }) => {
  return (
    <div className="space-y-6">
       <h1 className="text-3xl font-bold text-brand-text">Diretório de Colaboradores</h1>
      <TeamDirectory employees={employees} />
    </div>
  );
};

export default DirectoryPage;
