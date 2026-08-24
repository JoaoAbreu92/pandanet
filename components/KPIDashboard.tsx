import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { 
    ChartBarIcon, 
    ArrowTrendingUpIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

interface KPI {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  category: string;
  period: string;
  powerbi_url?: string;
}

const KPIDashboard: React.FC = () => {
    const { profile } = useAuth();
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchKPIs = async () => {
            if (!profile?.company_id) return;
            const { data, error } = await supabase
                .from('kpis')
                .select('*')
                .eq('company_id', profile.company_id);
            
            if (data) setKpis(data);
            setLoading(false);
        };
        fetchKPIs();
    }, [profile?.company_id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Iniciando indicadores...</div>;

    const mainKPI = kpis.find(k => k.powerbi_url);

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard de Performance</h1>
                    <p className="text-gray-500 mt-2">Visão geral de metas e resultados organizacionais.</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold">Resumo Geral</span>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map(kpi => {
                    const percentage = Math.min(Math.round((kpi.current / kpi.target) * 100), 100);
                    return (
                        <div key={kpi.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-gray-50 rounded-2xl">
                                    <ChartBarIcon className="w-5 h-5 text-brand-primary" />
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${percentage >= 100 ? 'bg-green-50 text-green-600' : 'bg-brand-primary/10 text-brand-primary'}`}>
                                    {percentage}% da Meta
                                </span>
                            </div>
                            <h3 className="text-gray-500 text-sm font-medium mb-1">{kpi.name}</h3>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-2xl font-black text-gray-900">{kpi.current}{kpi.unit}</span>
                                <span className="text-xs text-gray-400">/ {kpi.target}{kpi.unit}</span>
                            </div>
                            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-primary transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider">{kpi.period}</p>
                        </div>
                    );
                })}
            </div>

            {/* Power BI Integration / Main Chart Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden h-full min-h-[500px]">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Análise Detalhada (Power BI)</h3>
                            <ArrowTrendingUpIcon className="w-5 h-5 text-brand-primary" />
                        </div>
                        {mainKPI?.powerbi_url ? (
                            <iframe 
                                title="KPI Dashboard" 
                                width="100%" 
                                height="450" 
                                src={mainKPI.powerbi_url} 
                                frameBorder="0" 
                                allowFullScreen={true}
                                className="w-full h-[450px]"
                            ></iframe>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-20 text-center opacity-40">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                    <ChartBarIcon className="w-10 h-10 text-gray-300" />
                                </div>
                                <p className="text-gray-500 font-medium">Nenhum dashboard interativo vinculado. <br/>Adicione uma URL do Power BI na gestão de KPIs.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-brand-primary rounded-[32px] p-8 text-white shadow-xl shadow-brand-primary/20">
                        <CheckCircleIcon className="w-12 h-12 mb-6 opacity-80" />
                        <h3 className="text-xl font-bold mb-2">Desempenho Corporativo</h3>
                        <p className="text-white/80 text-sm leading-relaxed mb-6">Seu time está 12% acima da média do último trimestre.</p>
                    </div>

                    <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center">
                            <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-amber-500" />
                            Alertas de Sistema
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center p-4 bg-gray-50 rounded-2xl">
                                <div className="w-2 h-2 rounded-full bg-amber-500 mr-3"></div>
                                <span className="text-sm text-gray-700">Meta de Atendimento está em 88%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KPIDashboard;
