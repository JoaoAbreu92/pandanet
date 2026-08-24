import React, { useState } from 'react';
import Card from './Card';
import type { Employee } from '../types';
import { SearchIcon, XCircleIcon } from './icons';
import { usePresence } from './PresenceContext';
import { useAuth } from './AuthContext';

interface TeamDirectoryProps {
  employees: Employee[];
    onNavigate?: (page: any, context?: any) => void;
}

const EmployeeDetailsModal: React.FC<{ employee: Employee; onClose: () => void }> = ({ employee, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>

                <div className="flex items-center space-x-4 mb-6">
                    <img src={employee.avatarUrl} alt={employee.name} className="w-20 h-20 rounded-full border-2 border-brand-primary object-cover" />
                    <div>
                        <h3 className="text-xl font-bold text-brand-text">{employee.name}</h3>
                        <p className="text-brand-subtle-text">{employee.role}</p>
                        <p className="text-sm text-gray-400">{employee.team}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Email</p>
                            <p className="text-sm text-brand-text">{employee.email}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Telefone</p>
                            <p className="text-sm text-brand-text">{employee.phone || 'Não informado'}</p>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="font-bold text-brand-text mb-3">Dados Confidenciais</h4>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase">RG</p>
                                <p className="text-sm font-medium text-brand-text">{employee.rg || 'Não informado'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase">CPF</p>
                                <p className="text-sm font-medium text-brand-text">{employee.cpf || 'Não informado'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase">Estado Civil</p>
                                <p className="text-sm font-medium text-brand-text">{employee.marital_status || 'Não informado'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase">Escolaridade</p>
                                <p className="text-sm font-medium text-brand-text">{employee.education_level || 'Não informado'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-bold text-gray-700 text-sm">Contato de Emergência</h4>
                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Nome</p>
                                <p className="text-sm text-brand-text">{employee.emergency_contact_name || 'Não informado'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Telefone</p>
                                <p className="text-sm text-brand-text">{employee.emergency_contact_phone || 'Não informado'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Plano de Saúde</p>
                            <p className="text-sm text-brand-text">{employee.health_insurance || 'Não informado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Tipo Sanguíneo</p>
                            <p className="text-sm font-bold text-red-600">{employee.blood_type || 'Não informado'}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md font-bold hover:bg-gray-200 transition-colors">Fechar</button>
                </div>
            </div>
        </div>
    );
};

const TeamDirectory: React.FC<TeamDirectoryProps> = ({ employees, onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { onlineUsers } = usePresence();
    const { profile } = useAuth();

    const canViewDetails = profile?.is_admin || profile?.permissions?.viewEmployeeDetails;

    const handleAction = (page: string, context: any) => {
        if (page === 'profile-details') {
            setSelectedEmployee(context.employee);
            return;
        }

        if (onNavigate) {
            onNavigate(page as any, context);
        } else {
            // Fallback if onNavigate not provided
            const query = context.conversationId ? `?conversation=${context.conversationId}` : '';
            window.location.href = `/${page}${query}`;
        }
    };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
      <>
          <Card title="Funcionários">
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
            {filteredEmployees.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum colaborador encontrado</p>
            ) : (
                filteredEmployees.map(employee => (
                    <div key={employee.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200 group">
                        <div className="flex items-center space-x-3 flex-1">
                            <div className="relative">
                                <img
                                    src={employee.avatarUrl}
                                    alt={employee.name}
                                    className={`w-12 h-12 rounded-full border-2 object-cover ${
                                        onlineUsers.has(employee.id) ? 'border-emerald-500' : 'border-gray-200'
                                    }`}
                                />
                                {onlineUsers.has(employee.id) && (
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-brand-text truncate">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text truncate">{employee.role}</p>
                                <p className="text-xs text-gray-400">{employee.team}</p>
                            </div>
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleAction('messages', { conversationId: employee.id })}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                title="Enviar mensagem"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => {
                                    if (canViewDetails) {
                                        handleAction('profile-details', { employee });
                                    } else {
                                        handleAction('profile', { id: employee.id });
                                    }
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                title={canViewDetails ? "Ver detalhes" : "Ver perfil"}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </button>
                            {employee.phone && (
                                <a
                                    href={`tel:${employee.phone}`}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                    title={`Ligar: ${employee.phone}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    </Card>

          {selectedEmployee && (
              <EmployeeDetailsModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
          )}
      </>
  );
};

export default TeamDirectory;