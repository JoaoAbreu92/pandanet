import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { CRMTask } from '../types';
import toast from 'react-hot-toast';
import { XMarkIcon, PaperClipIcon } from '../components/icons';

interface CRMTaskFormProps {
    onClose: () => void;
    onSave: () => void;
    initialData?: Partial<CRMTask>;
}

const CRMTaskForm: React.FC<CRMTaskFormProps> = ({ onClose, onSave, initialData }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [relatedItems, setRelatedItems] = useState<any[]>([]);
    const [loadingRelated, setLoadingRelated] = useState(false);

    const [formData, setFormData] = useState<Partial<CRMTask>>({
        company_id: currentUser?.company_id || '',
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        is_public: false,
        is_billable: false,
        hourly_rate: 0,
        start_date: new Date().toISOString().split('T')[0],
        due_date: '',
        assigned_to: [],
        followers: [],
        tags: [],
        rel_type: '',
        rel_id: '',
        ...initialData
    });

    const [currentTag, setCurrentTag] = useState('');

    useEffect(() => {
        const fetchEmployees = async () => {
            if (!currentUser?.company_id) return;
            const { data } = await supabase
                .from('users')
                .select('id, full_name, avatar_url')
                .eq('company_id', currentUser.company_id)
                .order('full_name');
            if (data) setEmployees(data);
        };
        fetchEmployees();
    }, [currentUser?.company_id]);

    useEffect(() => {
        const fetchRelatedItems = async () => {
            if (!formData.rel_type || !currentUser?.company_id) {
                setRelatedItems([]);
                return;
            }

            setLoadingRelated(true);
            try {
                const tableMap: any = {
                    project: { table: 'crm_projects', label: 'name' },
                    invoice: { table: 'crm_invoices', label: 'subject' },
                    customer: { table: 'crm_customers', label: 'name' },
                    proposal: { table: 'crm_proposals', label: 'subject' },
                    lead: { table: 'crm_leads', label: 'name' },
                    estimate: { table: 'crm_estimates', label: 'subject' },
                    subscription: { table: 'crm_subscriptions', label: 'subject' },
                    contract: { table: 'crm_contracts', label: 'subject' }
                };

                const config = tableMap[formData.rel_type];
                if (!config) {
                    setRelatedItems([]);
                    return;
                }

                const { data, error } = await supabase
                    .from(config.table)
                    .select(`id, ${config.label}`)
                    .eq('company_id', currentUser.company_id);

                if (error) throw error;
                setRelatedItems((data as any[]).map(item => ({
                    id: item.id,
                    label: item[config.label] || 'Sem título'
                })));
            } catch (error) {
                console.error('Error fetching related items:', error);
            } finally {
                setLoadingRelated(false);
            }
        };

        fetchRelatedItems();
    }, [formData.rel_type, currentUser?.company_id]);

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && currentTag.trim()) {
            e.preventDefault();
            if (!formData.tags?.includes(currentTag.trim())) {
                setFormData({ ...formData, tags: [...(formData.tags || []), currentTag.trim()] });
            }
            setCurrentTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tagToRemove) });
    };

    const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions).map(opt => opt.value);
        setFormData({ ...formData, assigned_to: selectedOptions });
    };

    const handleFollowerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions).map(opt => opt.value);
        setFormData({ ...formData, followers: selectedOptions });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.title || !formData.start_date) {
                toast.error('Preencha os campos obrigatórios (*)');
                setLoading(false);
                return;
            }

            const taskData = {
                ...formData,
                created_by: currentUser?.id
            };

            if (initialData?.id) {
                const { error } = await supabase.from('crm_tasks').update(taskData).eq('id', initialData.id);
                if (error) throw error;
                toast.success('Tarefa atualizada com sucesso!');
            } else {
                const { error } = await supabase.from('crm_tasks').insert([taskData]);
                if (error) throw error;
                toast.success('Tarefa criada com sucesso!');
            }

            onSave();
        } catch (error: any) {
            console.error('Error saving task:', error);
            toast.error('Erro ao salvar tarefa: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-slate-800">
                <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        {initialData?.id ? 'Editar tarefa' : 'Adicionar nova tarefa'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Top Checkboxes & Attachment */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.is_public}
                                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Público</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.is_billable}
                                    onChange={(e) => setFormData({ ...formData, is_billable: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Faturável</span>
                            </label>
                        </div>
                        <button type="button" className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors group">
                            <PaperClipIcon className="w-4 h-4 group-hover:-rotate-12 transition-transform" />
                            Anexar arquivos
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                <span className="text-red-500 mr-1">*</span>Assunto
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Taxa horária</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.hourly_rate}
                                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 dark:border-slate-800 pb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    <span className="text-red-500 mr-1">*</span>Data de início
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Data de vencimento</label>
                                <input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Prioridade</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                >
                                    <option value="low">Baixo</option>
                                    <option value="medium">Médio</option>
                                    <option value="high">Alto</option>
                                    <option value="urgent">Urgente</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Relacionado a</label>
                                <select
                                    value={formData.rel_type}
                                    onChange={(e) => setFormData({ ...formData, rel_type: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors"
                                >
                                    <option value="">Nada selecionado</option>
                                    <option value="project">Projeto</option>
                                    <option value="invoice">Fatura</option>
                                    <option value="customer">Cliente</option>
                                    <option value="proposal">Proposta</option>
                                    <option value="lead">Lead</option>
                                    <option value="estimate">Estimativa</option>
                                    <option value="subscription">Assinatura</option>
                                    <option value="contract">Contrato</option>
                                </select>
                            </div>

                            {formData.rel_type && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Selecionar {
                                            {
                                                project: 'Projeto',
                                                invoice: 'Fatura',
                                                customer: 'Cliente',
                                                proposal: 'Proposta',
                                                lead: 'Lead',
                                                estimate: 'Estimativa',
                                                subscription: 'Assinatura',
                                                contract: 'Contrato'
                                            }[formData.rel_type] || 'Item'
                                        }
                                    </label>
                                    <select
                                        value={formData.rel_id}
                                        onChange={(e) => setFormData({ ...formData, rel_id: e.target.value })}
                                        disabled={loadingRelated}
                                        className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors disabled:opacity-50"
                                    >
                                        <option value="">{loadingRelated ? 'Carregando...' : 'Nenhum selecionado'}</option>
                                        {relatedItems.map(item => (
                                            <option key={item.id} value={item.id}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Cessionários</label>
                                <select
                                    multiple
                                    value={formData.assigned_to}
                                    onChange={handleAssigneeChange}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors min-h-[100px]"
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">Segure Ctrl (Windows) ou Cmd (Mac) para selecionar múltiplos.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Seguidores</label>
                                <select
                                    multiple
                                    value={formData.followers}
                                    onChange={handleFollowerChange}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 focus:ring-0 transition-colors min-h-[100px]"
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Etiquetas
                            </label>
                            <div className="flex flex-wrap items-center gap-2 min-h-[46px] bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-1.5 focus-within:border-blue-500 transition-colors">
                                {formData.tags?.map((tag, index) => (
                                    <span key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600 shadow-sm">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 p-0.5 rounded transition-colors text-gray-400">
                                            <XMarkIcon className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={currentTag}
                                    onChange={(e) => setCurrentTag(e.target.value)}
                                    onKeyDown={handleAddTag}
                                    placeholder={formData.tags?.length ? "" : "Pressione Enter para adicionar..."}
                                    className="flex-1 min-w-[120px] bg-transparent border-none text-sm focus:ring-0 px-2 text-gray-700 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Descrição da tarefa</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={5}
                                placeholder="Adicionar descrição"
                                className="w-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:border-blue-500 focus:ring-0 transition-colors resize-y"
                            />
                        </div>

                    </div>
                    
                    <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 focus:ring-2 focus:ring-gray-200 transition-all"
                        >
                            Fechar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-sm font-bold shadow-lg disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                            ) : (
                                'Salvar'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CRMTaskForm;
