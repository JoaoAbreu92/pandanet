import React, { useState } from 'react';
import { 
    XMarkIcon, 
    PlusIcon, 
    ChevronDownIcon,
    BuildingOfficeIcon,
    BanknotesIcon,
    GlobeAltIcon,
    MapPinIcon,
    PhoneIcon,
    GlobeAsiaAustraliaIcon,
    IdentificationIcon
} from '../components/icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const CRMNewCustomerForm: React.FC<{ onClose: () => void; onSuccess?: () => void }> = ({ onClose, onSuccess }) => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'details' | 'billing'>('details');
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        company: '',
        vat: '',
        phone: '',
        website: '',
        groups: [] as string[],
        currency: 'BRL',
        language: 'Portuguese',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: 'Brasil',
        billing_address: {
            address: '',
            city: '',
            state: '',
            zip: '',
            country: 'Brasil'
        },
        shipping_address: {
            address: '',
            city: '',
            state: '',
            zip: '',
            country: 'Brasil'
        }
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('crm_customers')
                .insert([{
                    company_id: currentUser.company_id,
                    name: formData.company,
                    vat: formData.vat,
                    phone: formData.phone,
                    website: formData.website,
                    groups: formData.groups,
                    currency: formData.currency,
                    default_language: formData.language,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    country: formData.country,
                    billing_address: formData.billing_address,
                    shipping_address: formData.shipping_address,
                    status: 'active'
                }]);

            if (error) throw error;

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Erro ao salvar cliente. Verifique o console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Adicionar novo cliente</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="flex bg-gray-50/50 dark:bg-slate-800/50 px-6 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
                    <button 
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'details' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
                    >
                        Detalhes do cliente
                    </button>
                    <button 
                        onClick={() => setActiveTab('billing')}
                        className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'billing' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
                    >
                        Faturamento e Envio
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                    {activeTab === 'details' ? (
                        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5"><span className="text-red-500 mr-1">*</span>Empresa</label>
                                    <div className="relative">
                                        <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.company}
                                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Ex: Nome da Empresa Ltda"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Número de IVA / CNPJ</label>
                                    <div className="relative">
                                        <IdentificationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input 
                                            type="text" 
                                            value={formData.vat}
                                            onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="00.000.000/0001-00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Telefone</label>
                                    <div className="relative">
                                        <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input 
                                            type="tel" 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="+55 (11) 99999-9999"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Site</label>
                                    <div className="relative">
                                        <GlobeAltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input 
                                            type="url" 
                                            value={formData.website}
                                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="https://www.empresa.com.br"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Grupos</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <select
                                                value={formData.groups[0] || ''}
                                                onChange={(e) => setFormData({ ...formData, groups: e.target.value ? [e.target.value] : [] })}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                            >
                                                <option value="">Nada selecionado</option>
                                                <option value="Alto orçamento">Alto orçamento</option>
                                                <option value="Atacadista">Atacadista</option>
                                                <option value="VIP">VIP</option>
                                            </select>
                                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                        <button type="button" className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-gray-500">
                                            <PlusIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Moeda</label>
                                    <div className="relative">
                                        <BanknotesIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <select
                                            value={formData.currency}
                                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        >
                                            <option value="BRL">BRL - Real</option>
                                            <option value="USD">USD - Dólar</option>
                                            <option value="EUR">EUR - Euro</option>
                                        </select>
                                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Idioma padrão</label>
                                    <div className="relative">
                                        <GlobeAsiaAustraliaIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <select
                                            value={formData.language}
                                            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        >
                                            <option value="Portuguese">Português</option>
                                            <option value="English">Inglês</option>
                                            <option value="Spanish">Espanhol</option>
                                        </select>
                                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Endereço</label>
                                    <textarea
                                        rows={3}
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none no-scrollbar"
                                        placeholder="Rua, número, complemento..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Cidade</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Estado</label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Código postal</label>
                                    <input
                                        type="text"
                                        value={formData.zip}
                                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">País</label>
                                    <div className="relative">
                                        <select
                                            value={formData.country}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        >
                                            <option value="Brasil">Brasil</option>
                                            <option value="Portugal">Portugal</option>
                                            <option value="Estados Unidos">Estados Unidos</option>
                                        </select>
                                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            {/* Billing Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pb-2 border-b border-gray-50 dark:border-slate-800">
                                    <BanknotesIcon className="w-5 h-5 text-blue-500" />
                                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">Faturamento</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Endereço de Faturamento</label>
                                            <textarea
                                                rows={2}
                                                value={formData.billing_address.address}
                                                onChange={(e) => setFormData({ ...formData, billing_address: { ...formData.billing_address, address: e.target.value } })}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                            ></textarea>
                                    </div>
                                        <input
                                            type="text"
                                            placeholder="Cidade"
                                            value={formData.billing_address.city}
                                            onChange={(e) => setFormData({ ...formData, billing_address: { ...formData.billing_address, city: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Estado"
                                            value={formData.billing_address.state}
                                            onChange={(e) => setFormData({ ...formData, billing_address: { ...formData.billing_address, state: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="CEP"
                                            value={formData.billing_address.zip}
                                            onChange={(e) => setFormData({ ...formData, billing_address: { ...formData.billing_address, zip: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="País"
                                            value={formData.billing_address.country}
                                            onChange={(e) => setFormData({ ...formData, billing_address: { ...formData.billing_address, country: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                </div>
                            </div>

                            {/* Shipping Section */}
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-50 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <MapPinIcon className="w-5 h-5 text-emerald-500" />
                                        <h3 className="font-bold text-gray-800 dark:text-white text-sm">Envio</h3>
                                    </div>
                                        <button
                                            onClick={() => setFormData({ ...formData, shipping_address: { ...formData.billing_address } })}
                                            className="text-[10px] font-bold text-blue-500 uppercase tracking-wider hover:underline"
                                        >Copiar faturamento</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Endereço de Envio</label>
                                            <textarea
                                                rows={2}
                                                value={formData.shipping_address.address}
                                                onChange={(e) => setFormData({ ...formData, shipping_address: { ...formData.shipping_address, address: e.target.value } })}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                            ></textarea>
                                    </div>
                                        <input
                                            type="text"
                                            placeholder="Cidade"
                                            value={formData.shipping_address.city}
                                            onChange={(e) => setFormData({ ...formData, shipping_address: { ...formData.shipping_address, city: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Estado"
                                            value={formData.shipping_address.state}
                                            onChange={(e) => setFormData({ ...formData, shipping_address: { ...formData.shipping_address, state: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="CEP"
                                            value={formData.shipping_address.zip}
                                            onChange={(e) => setFormData({ ...formData, shipping_address: { ...formData.shipping_address, zip: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="País"
                                            value={formData.shipping_address.country}
                                            onChange={(e) => setFormData({ ...formData, shipping_address: { ...formData.shipping_address, country: e.target.value } })}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 text-sm outline-none"
                                        />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50/50 dark:bg-slate-800/20">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all border border-gray-200 dark:border-slate-700"
                    >
                        Salvar e criar contato
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-8 py-2.5 rounded-xl font-bold text-sm bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/10"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CRMNewCustomerForm;
