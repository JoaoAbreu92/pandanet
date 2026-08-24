import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { 
    DocumentIcon, 
    CalendarIcon, 
    BanknotesIcon, 
    ArrowDownTrayIcon,
    PlusIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';

interface Payslip {
    id: string;
    month: string;
    reference_date: string;
    available_at: string;
    file_url: string | null;
    file_name: string | null;
    gross_salary: number | null;
    net_salary: number | null;
}

interface VacationRequest {
    id: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    notes: string | null;
    response_notes: string | null;
    created_at: string;
}

interface VacationBalance {
    available_days: number;
    taken_days: number;
    year: number;
}

interface HRDocument {
    id: string;
    name: string;
    description: string | null;
    file_url: string;
    file_name: string | null;
    category: string;
}

const statusConfig = {
    pending:   { label: 'Aguardando', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/30', icon: ClockIcon },
    approved:  { label: 'Aprovado',   color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/30', icon: CheckCircleIcon },
    rejected:  { label: 'Recusado',   color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-900/30', icon: XCircleIcon },
    cancelled: { label: 'Cancelado',  color: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-slate-800 dark:border-white/5', icon: XCircleIcon },
};

const EmployeePortal: React.FC = () => {
    const { profile } = useAuth();
    const [activeSection, setActiveSection] = useState<'payroll' | 'vacation' | 'documents'>('payroll');
    const [loading, setLoading] = useState(true);

    // Data states
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
    const [vacationBalance, setVacationBalance] = useState<VacationBalance | null>(null);
    const [documents, setDocuments] = useState<HRDocument[]>([]);

    // Vacation request form
    const [showVacationForm, setShowVacationForm] = useState(false);
    const [vacForm, setVacForm] = useState({ start_date: '', end_date: '', notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Admin upload
    const isAdmin = profile?.isAdmin || (profile?.permissions as any)?.isCompanyAdmin;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPayslip, setUploadingPayslip] = useState(false);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        if (profile?.id) fetchAll();
    }, [profile?.id]);

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([fetchPayslips(), fetchVacation(), fetchDocuments()]);
        setLoading(false);
    };

    const fetchPayslips = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('hr_payslips')
            .select('*')
            .eq('employee_id', profile.id)
            .order('reference_date', { ascending: false });
        if (data) setPayslips(data);
    };

    const fetchVacation = async () => {
        if (!profile?.id || !profile?.company_id) return;

        const [{ data: reqs }, { data: bal }] = await Promise.all([
            supabase.from('hr_vacation_requests')
                .select('*')
                .eq('employee_id', profile.id)
                .order('created_at', { ascending: false }),
            supabase.from('hr_vacation_balance')
                .select('*')
                .eq('employee_id', profile.id)
                .eq('year', new Date().getFullYear())
                .maybeSingle()
        ]);

        if (reqs) setVacationRequests(reqs);
        setVacationBalance(bal || { available_days: 0, taken_days: 0, year: new Date().getFullYear() });
    };

    const fetchDocuments = async () => {
        if (!profile?.company_id) return;
        const { data } = await supabase
            .from('hr_documents')
            .select('*')
            .eq('company_id', profile.company_id)
            .eq('is_public', true)
            .order('category')
            .order('name');
        if (data) setDocuments(data);
    };

    const calcVacationDays = () => {
        if (!vacForm.start_date || !vacForm.end_date) return 0;
        const start = new Date(vacForm.start_date);
        const end = new Date(vacForm.end_date);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return diff > 0 ? diff : 0;
    };

    const submitVacationRequest = async () => {
        if (!profile?.id || !profile?.company_id) return;
        const days = calcVacationDays();
        if (days <= 0) { showToast('Selecione datas válidas.', 'error'); return; }
        setSubmitting(true);
        try {
            const { error } = await supabase.from('hr_vacation_requests').insert({
                company_id: profile.company_id,
                employee_id: profile.id,
                start_date: vacForm.start_date,
                end_date: vacForm.end_date,
                days_requested: days,
                notes: vacForm.notes || null,
                status: 'pending'
            });
            if (error) throw error;
            showToast('Solicitação enviada com sucesso!');
            setShowVacationForm(false);
            setVacForm({ start_date: '', end_date: '', notes: '' });
            fetchVacation();
        } catch (e: any) {
            showToast(e.message || 'Erro ao enviar solicitação.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelVacationRequest = async (id: string) => {
        if (!confirm('Cancelar esta solicitação?')) return;
        const { error } = await supabase
            .from('hr_vacation_requests')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .eq('employee_id', profile!.id);
        if (!error) { showToast('Solicitação cancelada.'); fetchVacation(); }
    };

    const downloadFile = async (url: string, fileName: string) => {
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.target = '_blank';
            link.click();
        } catch {
            showToast('Erro ao baixar arquivo.', 'error');
        }
    };

    // Admin: upload payslip
    const handlePayslipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.company_id || !profile?.id) return;
        
        setUploadingPayslip(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `payslips/${profile.company_id}/${profile.id}/${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('hr-files').upload(path, file);
            if (uploadErr) throw uploadErr;

            const { data: { publicUrl } } = supabase.storage.from('hr-files').getPublicUrl(path);

            const now = new Date();
            const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

            await supabase.from('hr_payslips').insert({
                company_id: profile.company_id,
                employee_id: profile.id,
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                reference_date: now.toISOString().split('T')[0],
                file_url: publicUrl,
                file_name: file.name,
                created_by: profile.id
            });

            showToast('Holerite enviado com sucesso!');
            fetchPayslips();
        } catch (e: any) {
            showToast(e.message || 'Erro ao enviar holerite.', 'error');
        } finally {
            setUploadingPayslip(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const navItems = [
        { key: 'payroll', label: 'Holerites', icon: BanknotesIcon },
        { key: 'vacation', label: 'Férias', icon: CalendarIcon },
        { key: 'documents', label: 'Documentos', icon: DocumentIcon },
    ] as const;

    const pendingDays = vacationRequests
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + r.days_requested, 0);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-primary border-t-transparent" />
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-xl text-white font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {toast.msg}
                </div>
            )}

            <header className="flex flex-wrap justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meu RH</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Gestão de documentos e benefícios de {profile?.name}.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {vacationBalance && vacationBalance.available_days > 0 && (
                        <span className="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full text-sm font-bold">
                            🏖️ Saldo Férias: {vacationBalance.available_days} dias
                        </span>
                    )}
                    {pendingDays > 0 && (
                        <span className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-full text-sm font-bold">
                            ⏳ Em análise: {pendingDays} dias
                        </span>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar */}
                <aside className="lg:col-span-1 space-y-2">
                    {navItems.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveSection(key)}
                            className={`w-full flex items-center p-4 rounded-2xl transition-all ${
                                activeSection === key
                                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-100 dark:border-white/5'
                            }`}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            <span className="font-bold">{label}</span>
                        </button>
                    ))}
                </aside>

                {/* Main Content */}
                <main className="lg:col-span-3">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">

                        {/* HOLERITES */}
                        {activeSection === 'payroll' && (
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Histórico de Pagamentos</h3>
                                    {isAdmin && (
                                        <>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingPayslip}
                                                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-60"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                                {uploadingPayslip ? 'Enviando...' : 'Enviar Holerite'}
                                            </button>
                                            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg" hidden onChange={handlePayslipUpload} />
                                        </>
                                    )}
                                </div>

                                {payslips.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                                        <BanknotesIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="font-medium">Nenhum holerite disponível ainda.</p>
                                        <p className="text-sm">Os holerites aparecerão aqui quando forem disponibilizados pelo RH.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {payslips.map(pay => (
                                            <div key={pay.id} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-white/5 group hover:border-brand-primary transition-colors">
                                                <div className="flex items-center space-x-4">
                                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                                                        <BanknotesIcon className="w-6 h-6 text-brand-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white">{pay.month}</p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Disponibilizado em: {new Date(pay.available_at).toLocaleDateString('pt-BR')}
                                                        </p>
                                                        {pay.net_salary && (
                                                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                                Líquido: R$ {pay.net_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {pay.file_url && (
                                                    <button
                                                        onClick={() => downloadFile(pay.file_url!, pay.file_name || pay.month)}
                                                        className="p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                                                        title="Baixar holerite"
                                                    >
                                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FÉRIAS */}
                        {activeSection === 'vacation' && (
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gestão de Férias</h3>
                                    <button
                                        onClick={() => setShowVacationForm(v => !v)}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                        Solicitar Férias
                                    </button>
                                </div>

                                {/* Saldo Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="p-5 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                        <p className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">Dias Disponíveis</p>
                                        <p className="text-4xl font-black text-emerald-800 dark:text-emerald-300">{vacationBalance?.available_days ?? 0}</p>
                                    </div>
                                    <div className="p-5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                        <p className="text-amber-700 dark:text-amber-400 font-medium text-sm">Em Análise</p>
                                        <p className="text-4xl font-black text-amber-800 dark:text-amber-300">{pendingDays}</p>
                                    </div>
                                    <div className="p-5 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <p className="text-blue-700 dark:text-blue-400 font-medium text-sm">Dias Gozados {new Date().getFullYear()}</p>
                                        <p className="text-4xl font-black text-blue-800 dark:text-blue-300">{vacationBalance?.taken_days ?? 0}</p>
                                    </div>
                                </div>

                                {/* Formulário de Solicitação */}
                                {showVacationForm && (
                                    <div className="mb-6 p-6 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-200 dark:border-white/5">
                                        <h4 className="font-bold text-gray-800 dark:text-white mb-4">Nova Solicitação de Férias</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">Data de Início</label>
                                                <input
                                                    type="date"
                                                    value={vacForm.start_date}
                                                    onChange={e => setVacForm(f => ({ ...f, start_date: e.target.value }))}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">Data de Término</label>
                                                <input
                                                    type="date"
                                                    value={vacForm.end_date}
                                                    onChange={e => setVacForm(f => ({ ...f, end_date: e.target.value }))}
                                                    min={vacForm.start_date || new Date().toISOString().split('T')[0]}
                                                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">Observações (opcional)</label>
                                                <textarea
                                                    value={vacForm.notes}
                                                    onChange={e => setVacForm(f => ({ ...f, notes: e.target.value }))}
                                                    rows={2}
                                                    placeholder="Alguma informação adicional?"
                                                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                                                />
                                            </div>
                                        </div>
                                        {calcVacationDays() > 0 && (
                                            <p className="mt-3 text-sm font-semibold text-brand-primary">
                                                Total: {calcVacationDays()} dias solicitados
                                            </p>
                                        )}
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={submitVacationRequest}
                                                disabled={submitting || calcVacationDays() <= 0}
                                                className="px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-60"
                                            >
                                                {submitting ? 'Enviando...' : 'Confirmar Solicitação'}
                                            </button>
                                            <button
                                                onClick={() => setShowVacationForm(false)}
                                                className="px-5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Lista de Solicitações */}
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Histórico de Solicitações</h4>
                                {vacationRequests.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                                        <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Nenhuma solicitação de férias encontrada.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {vacationRequests.map(req => {
                                            const cfg = statusConfig[req.status];
                                            const Icon = cfg.icon;
                                            return (
                                                <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <div className="flex items-center gap-4">
                                                        <div>
                                                            <p className="font-bold text-gray-900 dark:text-white text-sm">
                                                                {new Date(req.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(req.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{req.days_requested} dias · Solicitado em {new Date(req.created_at).toLocaleDateString('pt-BR')}</p>
                                                            {req.response_notes && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{req.response_notes}"</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
                                                            <Icon className="w-3 h-3" />
                                                            {cfg.label}
                                                        </span>
                                                        {req.status === 'pending' && (
                                                            <button
                                                                onClick={() => cancelVacationRequest(req.id)}
                                                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DOCUMENTOS */}
                        {activeSection === 'documents' && (
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Documentos de RH</h3>

                                {documents.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                                        <DocumentIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="font-medium">Nenhum documento disponível ainda.</p>
                                        <p className="text-sm">Os documentos de RH aparecerão aqui quando forem publicados.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {['general', 'policies', 'benefits', 'contracts'].map(cat => {
                                            const catDocs = documents.filter(d => d.category === cat);
                                            if (catDocs.length === 0) return null;
                                            const catLabels: Record<string, string> = {
                                                general: 'Geral', policies: 'Políticas', benefits: 'Benefícios', contracts: 'Contratos'
                                            };
                                            return (
                                                <div key={cat}>
                                                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-4">{catLabels[cat]}</p>
                                                    <div className="space-y-2">
                                                        {catDocs.map(doc => (
                                                            <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors group">
                                                                <div className="flex items-center space-x-3">
                                                                    <DocumentIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-brand-primary transition-colors" />
                                                                    <div>
                                                                        <p className="font-medium text-gray-700 dark:text-gray-200 text-sm">{doc.name}</p>
                                                                        {doc.description && <p className="text-xs text-gray-400 dark:text-gray-500">{doc.description}</p>}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => downloadFile(doc.file_url, doc.file_name || doc.name)}
                                                                    className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                                                                    title="Baixar documento"
                                                                >
                                                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default EmployeePortal;
