import React, { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    UserCircleIcon,
    UserGroupIcon,
    PencilSquareIcon,
    DocumentTextIcon,
    BanknotesIcon,
    CurrencyDollarIcon,
    PaperAirplaneIcon,
    TicketIcon,
    ChartPieIcon,
    LockClosedIcon,
    FolderIcon,
    CheckCircleIcon,
    LifebuoyIcon,
    PaperClipIcon,
    ShieldCheckIcon,
    BellIcon,
    MapPinIcon,
    ChevronDownIcon,
    BuildingOfficeIcon,
    PhoneIcon,
    GlobeAltIcon,
    IdentificationIcon,
    ArrowPathIcon,
    ArrowTrendingUpIcon
} from '../components/icons';
import { supabase } from '../supabaseClient';
import { CRMCustomer } from '../types';
import { useToast } from './ToastContext';

interface CRMCustomerDetailProps {
    customer: CRMCustomer;
    onClose: () => void;
    onUpdate: () => void;
}

const CRMCustomerDetail: React.FC<CRMCustomerDetailProps> = ({ customer, onClose, onUpdate }) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CRMCustomer>(customer);
    
    // Additional data states
    const [invoices, setInvoices] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        setFormData(customer);
        fetchRelatedData();
    }, [customer]);

    const fetchRelatedData = async () => {
        if (!customer.id) return;
        try {
            setLoadingData(true);
            const [invRes, projRes, taskRes] = await Promise.all([
                supabase.from('crm_invoices').select('*').eq('customer_id', customer.id),
                supabase.from('crm_projects').select('*').eq('customer_id', customer.id),
                supabase.from('crm_tasks').select('*').eq('customer_id', customer.id)
            ]);

            setInvoices(invRes.data || []);
            setProjects(projRes.data || []);
            setTasks(taskRes.data || []);
        } catch (error) {
            console.error('Error fetching customer related data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('crm_customers')
                .update({
                    name: formData.name,
                    vat: formData.vat,
                    phone: formData.phone,
                    website: formData.website,
                    groups: formData.groups,
                    currency: formData.currency,
                    default_language: formData.default_language,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    country: formData.country,
                    billing_address: formData.billing_address,
                    shipping_address: formData.shipping_address,
                    status: formData.status
                })
                .eq('id', customer.id);

            if (error) throw error;
            showToast('Cliente atualizado com sucesso');
            onUpdate();
        } catch (error) {
            console.error('Error updating customer:', error);
            showToast('Erro ao atualizar cliente', 'error');
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Perfil', icon: UserCircleIcon },
        { id: 'contacts', label: 'Contatos', icon: UserGroupIcon },
        { id: 'notes', label: 'Notas', icon: PencilSquareIcon },
        { id: 'invoices', label: 'Faturas', icon: BanknotesIcon, count: invoices.length },
        { id: 'proposals', label: 'Propostas', icon: PaperAirplaneIcon },
        { id: 'estimates', label: 'Estimativas', icon: ArrowTrendingUpIcon },
        { id: 'projects', label: 'Projetos', icon: FolderIcon, count: projects.length },
        { id: 'tasks', label: 'Tarefas', icon: CheckCircleIcon, count: tasks.length },
        { id: 'files', label: 'Arquivos', icon: PaperClipIcon },
    ];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90dvh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <BuildingOfficeIcon className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                #{customer.id.slice(0, 5)} {customer.name}
                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Detalhes do Cliente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors group">
                        <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 border-r border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/50 overflow-y-auto no-scrollbar">
                        <div className="p-4 space-y-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${activeTab === tab.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`} />
                                        <span className={`text-xs font-bold ${activeTab === tab.id ? 'text-white' : 'text-gray-600 dark:text-slate-300'}`}>{tab.label}</span>
                                    </div>
                                    {tab.count !== undefined && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-8 no-scrollbar">
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                {/* Navigation Internal Tabs */}
                                <div className="flex border-b border-gray-100 dark:border-slate-800 mb-6">
                                    <button className="px-6 py-3 text-xs font-bold border-b-2 border-blue-500 text-blue-500">Customer Details</button>
                                    <button className="px-6 py-3 text-xs font-bold border-b-2 border-transparent text-gray-400 hover:text-gray-600">Billing & Shipping</button>
                                    <button className="px-6 py-3 text-xs font-bold border-b-2 border-transparent text-gray-400 hover:text-gray-600">Customer Admins</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Company</label>
                                        <input 
                                            type="text" 
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">VAT Number</label>
                                        <input 
                                            type="text" 
                                            value={formData.vat || ''}
                                            onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                                        <input 
                                            type="text" 
                                            value={formData.phone || ''}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Website</label>
                                        <div className="relative">
                                            <GlobeAltIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                            <input 
                                                type="text" 
                                                value={formData.website || ''}
                                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</label>
                                        <textarea 
                                            rows={4}
                                            value={formData.address || ''}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        ></textarea>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">City</label>
                                        <input 
                                            type="text" 
                                            value={formData.city || ''}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">State</label>
                                        <input 
                                            type="text" 
                                            value={formData.state || ''}
                                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Zip Code</label>
                                        <input 
                                            type="text" 
                                            value={formData.zip || ''}
                                            onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Country</label>
                                        <select 
                                            value={formData.country || ''}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        >
                                            <option value="Brasil">Brasil</option>
                                            <option value="United States">United States</option>
                                            <option value="Paraguay">Paraguay</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                        {(activeTab === 'invoices') && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Faturas do Cliente</h3>
                                {loadingData ? (
                                    <div className="flex justify-center p-12"><ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" /></div>
                                ) : invoices.length > 0 ? (
                                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 dark:bg-slate-800 font-bold text-gray-400">
                                                <tr>
                                                    <th className="px-4 py-3">#</th>
                                                    <th className="px-4 py-3">Valor</th>
                                                    <th className="px-4 py-3">Vencimento</th>
                                                    <th className="px-4 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                                {invoices.map(inv => (
                                                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-4 py-3 font-bold text-blue-500">{inv.id.slice(0,6)}</td>
                                                        <td className="px-4 py-3 font-bold">{Number(inv.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        <td className="px-4 py-3 text-gray-500">{new Date(inv.duedate).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                                {inv.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-center py-12 text-gray-400">Nenhuma fatura encontrada.</p>
                                )}
                            </div>
                        )}

                        {(activeTab === 'projects') && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Projetos Ativos</h3>
                                {loadingData ? (
                                    <div className="flex justify-center p-12"><ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" /></div>
                                ) : projects.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {projects.map(proj => (
                                            <div key={proj.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-gray-700 dark:text-slate-200">{proj.name}</h4>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-600 uppercase">{proj.status}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2">{proj.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-12 text-gray-400">Nenhum projeto encontrado.</p>
                                )}
                            </div>
                        )}

                        {(activeTab === 'tasks') && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Tarefas do Cliente</h3>
                                {loadingData ? (
                                    <div className="flex justify-center p-12"><ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" /></div>
                                ) : tasks.length > 0 ? (
                                    <div className="space-y-2">
                                        {tasks.map(task => (
                                            <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-blue-200 transition-colors">
                                                <div className={`p-2 rounded-lg ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`text-xs font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-slate-200'}`}>{task.name}</p>
                                                    <p className="text-[10px] text-gray-400">Prioridade: {task.priority}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-12 text-gray-400">Nenhuma tarefa encontrada.</p>
                                )}
                            </div>
                        )}

                        {['profile', 'invoices', 'projects', 'tasks'].includes(activeTab) === false && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 animate-in fade-in zoom-in duration-300">
                                <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center">
                                    {tabs.find(t => t.id === activeTab)?.icon && React.createElement(tabs.find(t => t.id === activeTab)!.icon, { className: "w-10 h-10 text-gray-300" })}
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-gray-600 dark:text-slate-300">Módulo em construção</h3>
                                    <p className="text-sm">A aba {tabs.find(t => t.id === activeTab)?.label} estará disponível em breve.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-slate-800/50">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl font-bold text-sm bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/10 flex items-center gap-2"
                    >
                        {loading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CRMCustomerDetail;
