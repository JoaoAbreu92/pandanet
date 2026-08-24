import React, { useState, useEffect } from 'react';
import { ShieldCheckIcon, DocumentTextIcon, ArrowDownTrayIcon } from './icons';
import type { ResourceDocument } from '../types';
import { supabase, getCleanImageUrl, downloadFile } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

const PoliciesPage: React.FC = () => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [policies, setPolicies] = useState<ResourceDocument[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPolicies = async () => {
            if (!currentUser?.company_id) return;
            setLoading(true);
            try {
                // Fetch documents that are likely policies (e.g., category 'Políticas' or just show all relevant ones)
                // For now, let's fetch checking if category contains 'Políticas' or exact match. 
                // Since supabase easy filter is exact match, let's stick to category='Políticas' or filter client side if diverse.
                // Or maybe we treat everything in ResourceCenter as potential policy if tagged so.
                // Let's assume strict category 'Políticas' for now to distinguish.
                const { data, error } = await supabase
                    .from('policies')
                    .select('*')
                    .eq('company_id', currentUser.company_id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    const formattedPolicies: ResourceDocument[] = data.map((doc: any) => ({
                        id: doc.id,
                        title: doc.title,
                        category: doc.category,
                        type: doc.type as any,
                        url: getCleanImageUrl(doc.url),
                        updatedAt: new Date(doc.created_at).toISOString().split('T')[0]
                    }));
                    setPolicies(formattedPolicies);
                }
            } catch (error) {
                console.error('Error fetching policies:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPolicies();
    }, [currentUser?.company_id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando políticas...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <ShieldCheckIcon className="w-8 h-8 mr-2 text-brand-primary" />
                {t('policies.title')}
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {policies.length > 0 ? (
                        policies.map(policy => (
                            <div key={policy.id} className="p-4 flex items-center hover:bg-gray-50 transition-colors group">
                                <div className="bg-blue-50 p-3 rounded-lg mr-4 group-hover:bg-blue-100 transition-colors flex-shrink-0">
                                    <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 truncate">{policy.title}</h3>
                                    <p className="text-sm text-gray-500 truncate">{policy.category} • {new Date(policy.updatedAt).toLocaleDateString('pt-BR')} • {policy.type}</p>
                                </div>
                                <button
                                    onClick={() => downloadFile(policy.url, policy.title || 'documento')}
                                    className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded-lg transition-all ml-2 flex-shrink-0 cursor-pointer"
                                    title={t('policies.download')}
                                >
                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500">Nenhuma política encontrada.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PoliciesPage;
