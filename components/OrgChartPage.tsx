
import React from 'react';
import { Employee } from '../types';

interface OrgChartPageProps {
  employees: Employee[];
}

const OrgChartPage: React.FC<OrgChartPageProps> = ({ employees }) => {
    // build tree structure
    const buildOrgTree = (managerId: string | null = null): any[] => {
        return employees
            .filter(e => (managerId === null ? !e.reports_to : e.reports_to === managerId))
            .map(e => ({
                ...e,
                subordinates: buildOrgTree(e.id)
            }));
    };

    const treeData = buildOrgTree();

    const renderNode = (node: any) => (
        <div key={node.id} className="flex flex-col items-center">
            <div className="bg-white border-2 border-emerald-100 rounded-2xl p-4 shadow-sm hover:border-emerald-500 transition-all min-w-[180px] text-center z-10 relative">
                <img src={node.avatarUrl} className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-emerald-50 shadow-sm" alt="" />
                <p className="font-bold text-gray-900 text-sm">{node.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{node.role}</p>
                <div className="mt-1">
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{node.team}</span>
                </div>
            </div>

            {node.subordinates.length > 0 && (
                <>
                    <div className="w-px h-8 bg-emerald-200"></div>
                    <div className="relative pt-8 flex gap-8">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] h-px bg-emerald-200"></div>
                        {node.subordinates.map((sub: any) => (
                            <div key={sub.id} className="relative">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-emerald-200"></div>
                                {renderNode(sub)}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="max-w-full mx-auto space-y-8 p-4 bg-gray-50/30 min-h-screen">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Organograma Corporativo</h1>
                    <p className="text-gray-500 mt-1 font-medium italic">Estrutura oficial de hierarquia e gestão.</p>
                </div>
                <div className="flex items-center gap-2 text-xs bg-white border border-gray-100 px-4 py-2 rounded-2xl shadow-sm">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 font-bold">Atualizado em Tempo Real</span>
                </div>
            </header>

            <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-12 overflow-auto min-h-[700px] flex justify-center custom-scrollbar">
                <div className="inline-block pt-8">
                    {treeData.length > 0 ? (
                        <div className="flex gap-16">
                            {treeData.map(rootNode => renderNode(rootNode))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <p className="text-lg font-bold">Nenhum dado de hierarquia encontrado.</p>
                            <p className="text-sm">Defina as relações de gestor no painel Admin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrgChartPage;
