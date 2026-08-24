import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, XCircleIcon } from './icons';
import type { FormSubmission, FormStatus } from '../types';
import { useLanguage } from './LanguageContext';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const VacationRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { startDate: string, endDate: string, reason: string, sectorManager: string, employeeManager: string }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const { t } = useLanguage();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [sectorManager, setSectorManager] = useState('');
    const [employeeManager, setEmployeeManager] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ startDate, endDate, reason, sectorManager, employeeManager });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">{t('forms.vacation')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.manager_sector')}</label>
                            <input type="text" value={sectorManager} onChange={e => setSectorManager(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.manager_employee')}</label>
                            <input type="text" value={employeeManager} onChange={e => setEmployeeManager(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.start_date')}</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.end_date')}</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.reason')}</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1 w-full border-gray-355 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">{t('generic.cancel')}</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : t('forms.submit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LeaveRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { startDate: string, endDate: string, reason: string, sectorManager: string, employeeManager: string, attachmentFile: File | null }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const { t } = useLanguage();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [sectorManager, setSectorManager] = useState('');
    const [employeeManager, setEmployeeManager] = useState('');
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ startDate, endDate, reason, sectorManager, employeeManager, attachmentFile });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">Solicitação de Ausência / Folga</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.manager_sector')}</label>
                            <input type="text" value={sectorManager} onChange={e => setSectorManager(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.manager_employee')}</label>
                            <input type="text" value={employeeManager} onChange={e => setEmployeeManager(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.start_date')}</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">{t('forms.end_date')}</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Motivo da Ausência / Justificativa</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required className="mt-1 w-full border-gray-355 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Atestado Médico / Comprovante (Imagem ou PDF)</label>
                        <input type="file" accept="image/*,application/pdf" onChange={e => e.target.files && setAttachmentFile(e.target.files[0])} className="mt-1 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                        {attachmentFile && <p className="text-[10px] text-gray-500 mt-1 italic">Arquivo selecionado: {attachmentFile.name}</p>}
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">{t('generic.cancel')}</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : t('forms.submit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EpiRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { items: string, size: string, reason: string }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const [items, setItems] = useState('');
    const [size, setSize] = useState('');
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ items, size, reason });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">Solicitação de EPI</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Equipamentos Necessários</label>
                        <input type="text" value={items} onChange={e => setItems(e.target.value)} required placeholder="Ex: Bota de Segurança, Luvas Térmicas, Óculos" className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Tamanho / Especificação (se aplicável)</label>
                        <input type="text" value={size} onChange={e => setSize(e.target.value)} placeholder="Ex: Tamanho 40, CA específico" className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Motivo / Justificativa</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required placeholder="Ex: Desgaste do equipamento anterior, novo setor" className="mt-1 w-full border-gray-355 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Cancelar</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const UniformRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { items: string, size: string, quantity: number, reason: string }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const [items, setItems] = useState('');
    const [size, setSize] = useState('M');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ items, size, quantity, reason });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">Solicitação de Uniforme</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Peça de Uniforme</label>
                            <select value={items} onChange={e => setItems(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2">
                                <option value="">Selecione...</option>
                                <option value="Camiseta Polo">Camiseta Polo</option>
                                <option value="Camisa Social">Camisa Social</option>
                                <option value="Calça Jeans">Calça Jeans</option>
                                <option value="Calça Brim">Calça Brim</option>
                                <option value="Jaqueta / Casaco">Jaqueta / Casaco</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Tamanho</label>
                            <select value={size} onChange={e => setSize(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2">
                                <option value="PP">PP</option>
                                <option value="P">P</option>
                                <option value="M">M</option>
                                <option value="G">G</option>
                                <option value="GG">GG</option>
                                <option value="XG">XG</option>
                                <option value="38">38</option>
                                <option value="40">40</option>
                                <option value="42">42</option>
                                <option value="44">44</option>
                                <option value="46">46</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Quantidade</label>
                        <input type="number" min="1" max="5" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Motivo da Solicitação</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required placeholder="Ex: Substituição por desgaste, nova contratação" className="mt-1 w-full border-gray-355 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Cancelar</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DocRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { docType: string, reason: string }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const [docType, setDocType] = useState('');
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ docType, reason });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">Solicitação de Documento</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Tipo de Documento</label>
                        <select value={docType} onChange={e => setDocType(e.target.value)} required className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2">
                            <option value="">Selecione...</option>
                            <option value="Declaração de Trabalho">Declaração de Trabalho</option>
                            <option value="Carta de Apresentação">Carta de Apresentação</option>
                            <option value="Histórico de Rendimentos">Histórico de Rendimentos</option>
                            <option value="Cópia de Contrato de Trabalho">Cópia de Contrato de Trabalho</option>
                            <option value="Outros">Outros (especificar nas observações)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Finalidade / Observações</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required placeholder="Ex: Apresentar na faculdade, abertura de conta bancária, etc." className="mt-1 w-full border-gray-355 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Cancelar</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DataChangeRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { address: string, phone: string, maritalStatus: string, observations: string }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [observations, setObservations] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ address, phone, maritalStatus, observations });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">Solicitação de Alteração de Dados</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Novo Endereço Completo</label>
                        <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, Número, Bairro, Cidade - UF, CEP" className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Novo Telefone / Celular</label>
                            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Estado Civil</label>
                            <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2">
                                <option value="">Selecione...</option>
                                <option value="Solteiro(a)">Solteiro(a)</option>
                                <option value="Casado(a)">Casado(a)</option>
                                <option value="Divorciado(a)">Divorciado(a)</option>
                                <option value="Viúvo(a)">Viúvo(a)</option>
                                <option value="União Estável">União Estável</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Outras Observações / Mudanças</label>
                        <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} placeholder="Descreva qualquer outra alteração cadastral necessária..." className="mt-1 w-full border-gray-355 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Cancelar</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const RefundRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { reason: string, amount: string, pixKey: string, pixType: string, attachmentFile: File | null }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const { t } = useLanguage();
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixType, setPixType] = useState('CPF');
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ reason, amount, pixKey, pixType, attachmentFile });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-655"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text dark:text-white mb-4">Solicitação de Reembolso</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Motivo do Reembolso</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={3} placeholder="Descreva a despesa (ex: Alimentação em viagem de trabalho, combustível, etc.)" className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Valor (R$)</label>
                        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0,00" className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Tipo de Chave PIX</label>
                            <select value={pixType} onChange={e => setPixType(e.target.value)} className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2">
                                <option value="CPF">CPF</option>
                                <option value="CNPJ">CNPJ</option>
                                <option value="E-mail">E-mail</option>
                                <option value="Telefone">Telefone</option>
                                <option value="Chave Aleatória">Chave Aleatória</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Chave PIX para Devolução</label>
                            <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} required placeholder="Informe sua chave PIX..." className="mt-1 w-full border-gray-350 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Comprovante / Recibo (Upload)</label>
                        <input type="file" accept="image/*,.pdf" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} required className="mt-1 w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-emerald-600" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Cancelar</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FormsPage: React.FC = () => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isVacationModalOpen, setVacationModalOpen] = useState(false);
    const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
    const [isEpiModalOpen, setEpiModalOpen] = useState(false);
    const [isUniformModalOpen, setUniformModalOpen] = useState(false);
    const [isDocModalOpen, setDocModalOpen] = useState(false);
    const [isDataChangeModalOpen, setDataChangeModalOpen] = useState(false);
    const [isRefundModalOpen, setRefundModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchSubmissions = async () => {
        if (!currentUser?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('form_submissions')
                .select('*')
                .eq('requester_id', currentUser.id)
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            setSubmissions((data || []).map(s => ({
                id: s.id,
                requesterId: s.requester_id,
                requesterName: currentUser.name || '',
                requesterAvatarUrl: currentUser.avatarUrl || '',
                formType: s.form_type,
                status: s.status as FormStatus,
                submittedAt: s.submitted_at,
                startDate: s.start_date,
                endDate: s.end_date,
                reason: s.reason,
                sectorManager: s.sector_manager,
                employeeManager: s.employee_manager,
                attachment_url: s.attachment_url,
                attachment_name: s.attachment_name
            })));
        } catch (err) {
            console.error('Error fetching submissions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, [currentUser?.id]);

    const uploadAttachment = async (file: File): Promise<{ url: string; name: string } | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
            const filePath = `${currentUser?.company_id}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('hr-files')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('hr-files')
                .getPublicUrl(filePath);

            return { url: publicUrl, name: file.name };
        } catch (err) {
            console.error('Error uploading file:', err);
            return null;
        }
    };

    const handleVacationRequest = async (data: { startDate: string, endDate: string, reason: string, sectorManager: string, employeeManager: string }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de Férias',
                    status: 'Pendente',
                    start_date: data.startDate,
                    end_date: data.endDate,
                    reason: data.reason,
                    sector_manager: data.sectorManager,
                    employee_manager: data.employeeManager
                }]);

            if (error) throw error;

            setVacationModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting form:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLeaveRequest = async (data: { startDate: string, endDate: string, reason: string, sectorManager: string, employeeManager: string, attachmentFile: File | null }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            let uploaded = null;
            if (data.attachmentFile) {
                uploaded = await uploadAttachment(data.attachmentFile);
            }

            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de Ausência',
                    status: 'Pendente',
                    start_date: data.startDate,
                    end_date: data.endDate,
                    reason: data.reason,
                    sector_manager: data.sectorManager,
                    employee_manager: data.employeeManager,
                    attachment_url: uploaded?.url || null,
                    attachment_name: uploaded?.name || null
                }]);

            if (error) throw error;

            setLeaveModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting form:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEpiRequest = async (data: { items: string, size: string, reason: string }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de EPI',
                    status: 'Pendente',
                    reason: `Itens: ${data.items}${data.size ? ` | Tam: ${data.size}` : ''} | Justificativa: ${data.reason}`
                }]);

            if (error) throw error;

            setEpiModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting EPI request:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUniformRequest = async (data: { items: string, size: string, quantity: number, reason: string }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de Uniforme',
                    status: 'Pendente',
                    reason: `Peça: ${data.items} | Tam: ${data.size} | Qtd: ${data.quantity} | Justificativa: ${data.reason}`
                }]);

            if (error) throw error;

            setUniformModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting Uniform request:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDocRequest = async (data: { docType: string, reason: string }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de Documento',
                    status: 'Pendente',
                    reason: `Tipo: ${data.docType} | Finalidade: ${data.reason}`
                }]);

            if (error) throw error;

            setDocModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting Document request:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDataChangeRequest = async (data: { address: string, phone: string, maritalStatus: string, observations: string }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            const details = [];
            if (data.address) details.push(`Endereço: ${data.address}`);
            if (data.phone) details.push(`Telefone: ${data.phone}`);
            if (data.maritalStatus) details.push(`Estado Civil: ${data.maritalStatus}`);
            if (data.observations) details.push(`Obs: ${data.observations}`);

            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Alteração Cadastral',
                    status: 'Pendente',
                    reason: details.join(' | ') || 'Solicitação de alteração de dados cadastrais.'
                }]);

            if (error) throw error;

            setDataChangeModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting Data Change request:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRefundRequest = async (data: { reason: string, amount: string, pixKey: string, pixType: string, attachmentFile: File | null }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            let uploaded = null;
            if (data.attachmentFile) {
                uploaded = await uploadAttachment(data.attachmentFile);
            }

            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de Reembolso',
                    status: 'Pendente',
                    reason: `Motivo: ${data.reason} | Valor: R$ ${data.amount} | PIX (${data.pixType}): ${data.pixKey}`,
                    attachment_url: uploaded?.url || null,
                    attachment_name: uploaded?.name || null
                }]);

            if (error) throw error;

            setRefundModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting Refund request:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: FormStatus) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400';
            case 'Aprovado': return 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400';
            case 'Rejeitado': return 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Carregando formulários...</div>;

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-brand-text dark:text-white">{t('forms.title')}</h1>
                <Card title={t('forms.available')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div onClick={() => setVacationModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">{t('forms.vacation')}</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">{t('forms.vacation_desc')}</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>

                        <div onClick={() => setRefundModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">Solicitação de Reembolso</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">Solicite reembolso de despesas corporativas anexando o comprovante e chave PIX.</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>
                        
                        <div onClick={() => setLeaveModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">Ausência / Folga</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">Solicite folgas ou envie atestados médicos diretamente ao RH.</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>

                        <div onClick={() => setEpiModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">Solicitação de EPI</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">Solicite Equipamentos de Proteção Individual necessários para sua função.</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>

                        <div onClick={() => setUniformModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">Solicitação de Uniforme</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">Solicite novas peças de uniforme ou substituições por tamanho/desgaste.</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>

                        <div onClick={() => setDocModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">Solicitação de Documentos</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">Solicite declarações de trabalho, cópias de contratos ou outros documentos ao RH.</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>

                        <div onClick={() => setDataChangeModalOpen(true)} className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-300 cursor-pointer transition-colors text-center group flex flex-col justify-between h-56">
                            <div>
                                <h3 className="font-bold text-lg text-brand-text dark:text-white group-hover:text-brand-primary transition-colors">{t('forms.data_change')}</h3>
                                <p className="text-sm text-brand-subtle-text dark:text-gray-400 mt-1">{t('forms.data_change_desc')}</p>
                            </div>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md font-bold">
                                <PlusIcon className="w-4 h-4" />
                                <span>Solicitar</span>
                            </button>
                        </div>
                    </div>
                </Card>

                <Card title={t('forms.my_requests')}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-550 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-900 border-b dark:border-white/5">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Tipo</th>
                                    <th scope="col" className="px-6 py-3">Período / Detalhes</th>
                                    <th scope="col" className="px-6 py-3">Data</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400 dark:text-gray-550 italic">Nenhuma solicitação encontrada.</td>
                                    </tr>
                                ) : (
                                    submissions.map(sub => (
                                        <tr key={sub.id} className="bg-white dark:bg-slate-900 border-b dark:border-white/5 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap flex items-center">
                                                {sub.formType}
                                                {sub.attachment_url && (
                                                    <a href={sub.attachment_url} target="_blank" rel="noreferrer" className="ml-2 inline-block px-1.5 py-0.5 text-[9px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded font-bold hover:bg-emerald-50">Comprovante 📎</a>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {sub.startDate ? new Date(sub.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''}
                                                {sub.endDate ? ` - ${new Date(sub.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}
                                                {!sub.startDate && sub.reason ? <span className="text-xs text-slate-500 line-clamp-1">{sub.reason}</span> : ''}
                                            </td>
                                            <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            {isVacationModalOpen && <VacationRequestModal onClose={() => setVacationModalOpen(false)} onSubmit={handleVacationRequest} submitting={submitting} />}
            {isRefundModalOpen && <RefundRequestModal onClose={() => setRefundModalOpen(false)} onSubmit={handleRefundRequest} submitting={submitting} />}
            {isLeaveModalOpen && <LeaveRequestModal onClose={() => setLeaveModalOpen(false)} onSubmit={handleLeaveRequest} submitting={submitting} />}
            {isEpiModalOpen && <EpiRequestModal onClose={() => setEpiModalOpen(false)} onSubmit={handleEpiRequest} submitting={submitting} />}
            {isUniformModalOpen && <UniformRequestModal onClose={() => setUniformModalOpen(false)} onSubmit={handleUniformRequest} submitting={submitting} />}
            {isDocModalOpen && <DocRequestModal onClose={() => setDocModalOpen(false)} onSubmit={handleDocRequest} submitting={submitting} />}
            {isDataChangeModalOpen && <DataChangeRequestModal onClose={() => setDataChangeModalOpen(false)} onSubmit={handleDataChangeRequest} submitting={submitting} />}
        </>
    );
};

export default FormsPage;
