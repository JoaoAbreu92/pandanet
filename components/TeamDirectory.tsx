import React, { useState } from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { Employee } from '../types';
import { SearchIcon } from './icons';
import { usePresence } from './PresenceContext';

interface TeamDirectoryProps {
  employees: Employee[];
}

const TeamDirectory: React.FC<TeamDirectoryProps> = ({ employees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { onlineUsers } = usePresence();

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card title="Diretório da Equipe">
        <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                type="text"
                placeholder="Buscar por nome ou equipe..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full border rounded-md bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {filteredEmployees.map(employee => (
              <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 transition-colors">
                <div className="relative">
                  <img
                    src={employee.avatarUrl}
                    alt={employee.name}
                    className={`w-10 h-10 rounded-full border-2 ${onlineUsers.has(employee.id) ? 'border-emerald-500' : 'border-gray-200'
                      }`}
                  />
                  {onlineUsers.has(employee.id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                  )}
                </div>
                    <div>
                        <p className="font-semibold text-sm text-brand-text">{employee.name}</p>
                        <p className="text-xs text-brand-subtle-text">{employee.role}, {employee.team}</p>
                    </div>
                </div>
            ))}
        </div>
    </Card>
  );
};

export default TeamDirectory;