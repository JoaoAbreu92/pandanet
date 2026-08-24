import React from 'react';
import { Employee } from '../types';

interface OrgChartPageProps {
  employees: Employee[];
}

const OrgChartPage: React.FC<OrgChartPageProps> = ({ employees }) => {
    // Basic grouping by team for a simple visual hierarchy
    const teams = Array.from(new Set(employees.map(e => e.team || 'Geral')));

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">Organograma Corporativo</h1>
                <p className="text-gray-500 mt-2">Visualize a estrutura hierárquica e conexões do time.</p>
            </header>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 overflow-x-auto min-h-[600px]">
                <div className="flex flex-col items-center space-y-12">
                    {/* Founder / CEO Level (Mocked for visual) */}
                    <div className="flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full border-4 border-brand-primary p-1">
                            <img src="https://ui-avatars.com/api/?name=Diretoria&background=10b981&color=fff" className="w-full h-full rounded-full object-cover" alt="Diretoria" />
                        </div>
                        <div className="mt-4 text-center">
                            <p className="font-bold text-gray-900 text-lg">Diretoria Executiva</p>
                            <p className="text-brand-primary font-medium text-sm">Administração Central</p>
                        </div>
                        <div className="w-px h-12 bg-gray-200 mt-4"></div>
                    </div>

                    <div className="relative">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gray-200"></div>
                        <div className="pt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {teams.map(team => {
                                const teamLead = employees.find(e => e.team === team && (e.role?.toLowerCase().includes('gerente') || e.role?.toLowerCase().includes('coordenador')));
                                const teamMembers = employees.filter(e => e.team === team && e.id !== teamLead?.id);

                                return (
                                    <div key={team} className="flex flex-col items-center">
                                        <div className="w-px h-12 bg-gray-200 -mt-12"></div>
                                        <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 w-full text-center hover:border-brand-primary transition-colors">
                                            <h3 className="font-bold text-gray-900 mb-4 bg-white py-1 px-3 rounded-full inline-block text-xs uppercase tracking-wider">{team}</h3>
                                            
                                            {teamLead && (
                                                <div className="mb-4">
                                                    <img src={teamLead.avatarUrl} className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-brand-primary shadow-sm" alt="" />
                                                    <p className="font-bold text-gray-900 text-sm">{teamLead.name}</p>
                                                    <p className="text-xs text-gray-500 uppercase">{teamLead.role}</p>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap justify-center gap-2">
                                                {teamMembers.slice(0, 5).map(member => (
                                                    <img key={member.id} src={member.avatarUrl} title={member.name} className="w-8 h-8 rounded-full border border-white hover:z-10 transition-transform hover:scale-110" alt="" />
                                                ))}
                                                {teamMembers.length > 5 && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 border border-white">
                                                        +{teamMembers.length - 5}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrgChartPage;
