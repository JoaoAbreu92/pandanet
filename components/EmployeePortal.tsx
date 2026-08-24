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
    XCircleIcon,
    HeartIcon,
    StarIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

interface TimeBankEntry {
    id: string;
    date: string;
    hours_changed: number;
    description: string | null;
}

interface EmployeeBenefit {
    id: string;
    name: string;
    value: number | null;
    description: string | null;
    status: string;
    start_date: string | null;
}

interface Evaluation {
    id: string;
    title: string;
    type: string;
    status: string;
    progress: number;
    score_communication: number | null;
    score_quality: number | null;
    score_teamwork: number | null;
    score_proactivity: number | null;
    feedback_text: string | null;
    created_at: string;
}

const statusConfig = {
    pending:   { label: 'Aguardando', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/30', icon: ClockIcon },
    approved:  { label: 'Aprovado',   color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/30', icon: CheckCircleIcon },
    rejected:  { label: 'Recusado',   color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-900/30', icon: XCircleIcon },
    cancelled: { label: 'Cancelado',  color: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-slate-800 dark:border-white/5', icon: XCircleIcon },
};

const EmployeePortal: React.FC = () => {
    const { profile } = useAuth();
    const [activeSection, setActiveSection] = useState<'payroll' | 'vacation' | 'documents' | 'timebank' | 'benefits' | 'performance'>('payroll');
    const [loading, setLoading] = useState(true);

    // Data states
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
    const [vacationBalance, setVacationBalance] = useState<VacationBalance | null>(null);
    const [documents, setDocuments] = useState<HRDocument[]>([]);
    const [timeBankEntries, setTimeBankEntries] = useState<TimeBankEntry[]>([]);
    const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefit[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

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
        await Promise.all([
            fetchPayslips(),
            fetchVacation(),
            fetchDocuments(),
            fetchTimeBank(),
            fetchEmployeeBenefits(),
            fetchEvaluations()
        ]);
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

    const fetchTimeBank = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('hr_time_bank')
            .select('*')
            .eq('employee_id', profile.id)
            .order('date', { ascending: false });
        if (data) setTimeBankEntries(data);
    };

    const fetchEmployeeBenefits = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('hr_employee_benefits')
            .select('*')
            .eq('employee_id', profile.id)
            .order('name');
        if (data) setEmployeeBenefits(data);
    };

    const fetchEvaluations = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('hr_evaluations')
            .select('*')
            .eq('employee_id', profile.id)
            .order('created_at', { ascending: false });
        if (data) setEvaluations(data);
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
        { key: 'timebank', label: 'Banco de Horas', icon: ClockIcon },
        { key: 'benefits', label: 'Meus Benefícios', icon: HeartIcon },
        { key: 'performance', label: 'Metas e Avaliações', icon: StarIcon },
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

                        {/* BANCO DE HORAS */}
                        {activeSection === 'timebank' && (
                            <div className="p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Banco de Horas</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Extrato acumulado e histórico de horas extras lançadas.</p>
                                    </div>
                                </div>

                                {/* Saldo Acumulado */}
                                {(() => {
                                    const totalHours = timeBankEntries.reduce((sum, e) => sum + Number(e.hours_changed), 0);
                                    const isPositive = totalHours >= 0;

                                    // Dados para o Gráfico das últimas 7 entradas
                                    const chartData = [...timeBankEntries]
                                        .slice(0, 7)
                                        .reverse()
                                        .map(e => ({
                                            data: new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                                            horas: Number(e.hours_changed)
                                        }));

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Card do Saldo */}
                                            <div className={`p-6 rounded-3xl border flex flex-col justify-between shadow-sm ${
                                                isPositive 
                                                    ? 'bg-emerald-50/55 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                                                    : 'bg-red-50/55 border-red-100 dark:bg-red-950/20 dark:border-red-900/30'
                                            }`}>
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Saldo Geral Acumulado</span>
                                                    <p className={`text-5xl font-black mt-2 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isPositive ? '+' : ''}{totalHours.toFixed(1)}h
                                                    </p>
                                                </div>
                                                <p className="text-[11px] text-gray-400 mt-4">Calculado a partir de todas as compensações e horas extras registradas no seu histórico.</p>
                                            </div>

                                            {/* Gráfico de Lançamentos */}
                                            <div className="md:col-span-2 bg-gray-50 dark:bg-slate-800/20 rounded-3xl border border-gray-100 dark:border-white/5 p-6 flex flex-col justify-between shadow-sm">
                                                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-4">Últimos Lançamentos (Horas)</h4>
                                                {chartData.length > 0 ? (
                                                    <div className="h-32 w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={chartData}>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                                                                <XAxis dataKey="data" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                                                <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                                                <Tooltip 
                                                                    contentStyle={{ 
                                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                                                        border: 'none', 
                                                                        borderRadius: '12px',
                                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                                        color: '#1E293B',
                                                                        fontSize: 10
                                                                    }} 
                                                                />
                                                                <Bar dataKey="horas" fill={isPositive ? '#10B981' : '#EF4444'} radius={[4, 4, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 py-6 text-center">Nenhum dado recente de ponto.</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Histórico Extrato */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Extrato de Lançamentos</h4>
                                    {timeBankEntries.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                                            <ClockIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">Nenhum lançamento no banco de horas registrado.</p>
                                        </div>
                                    ) : (
                                        <div className="border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
                                            {timeBankEntries.map(entry => {
                                                const change = Number(entry.hours_changed);
                                                const isAdd = change >= 0;
                                                return (
                                                    <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-800/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/20 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-xl ${isAdd ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
                                                                <ClockIcon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                                    {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                </p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500">{entry.description || 'Lançamento de banco de horas'}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`text-sm font-extrabold ${isAdd ? 'text-emerald-600 dark:text-emerald-450' : 'text-red-600 dark:text-red-400'}`}>
                                                            {isAdd ? '+' : ''}{change.toFixed(1)}h
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MEUS BENEFÍCIOS */}
                        {activeSection === 'benefits' && (
                            <div className="p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Meus Benefícios Ativos</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Benefícios corporativos atualmente concedidos a você.</p>
                                    </div>
                                </div>

                                {employeeBenefits.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                                        <HeartIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="font-medium">Nenhum benefício ativo cadastrado.</p>
                                        <p className="text-sm">Seus benefícios corporativos vinculados aparecerão aqui.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {employeeBenefits.map(benefit => (
                                            <div key={benefit.id} className="p-5 bg-white dark:bg-slate-900 border border-gray-150 dark:border-white/5 rounded-3xl shadow-sm hover:border-brand-primary transition-all flex flex-col justify-between gap-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl">
                                                            <HeartIcon className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{benefit.name}</h4>
                                                            <p className="text-xs text-gray-400 dark:text-gray-500">{benefit.description || 'Benefício ativo'}</p>
                                                        </div>
                                                    </div>
                                                    <span className="px-2.5 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                        {benefit.status}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between items-end border-t border-gray-100 dark:border-slate-800 pt-3 mt-2">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Data de Início</span>
                                                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                                            {benefit.start_date ? new Date(benefit.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                                        </p>
                                                    </div>
                                                    {benefit.value && (
                                                        <div className="text-right">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Subsídio Mensal</span>
                                                            <p className="text-base font-extrabold text-brand-primary">
                                                                R$ {benefit.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => alert('Para solicitar qualquer alteração, inclusão de dependentes ou cancelamento de benefícios, entre em contato diretamente com o gestor de RH do seu setor.')}
                                                    className="w-full mt-2 py-2 text-center text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-gray-505 dark:text-gray-300 rounded-xl transition-all border border-gray-150 dark:border-slate-800"
                                                    type="button"
                                                >
                                                    Solicitar Alteração
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* METAS E DESEMPENHO */}
                        {activeSection === 'performance' && (
                            <div className="p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Metas & Avaliação de Desempenho</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Acompanhamento do seu desenvolvimento pessoal, competências e objetivos.</p>
                                    </div>
                                </div>

                                {evaluations.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                                        <StarIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="font-medium">Nenhuma avaliação ou meta cadastrada.</p>
                                        <p className="text-sm">Suas avaliações e metas de desempenho aparecerão aqui assim que forem definidas.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Coluna 1 & 2: Metas e Feedbacks */}
                                        <div className="lg:col-span-2 space-y-6">
                                            {/* Metas Ativas */}
                                            {(() => {
                                                const metas = evaluations.filter(e => e.type === 'meta');
                                                return (
                                                    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm space-y-4">
                                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                                            <CheckCircleIcon className="w-5 h-5 text-brand-primary" />
                                                            Metas Estratégicas do Trimestre
                                                        </h4>
                                                        {metas.length === 0 ? (
                                                            <p className="text-xs text-gray-400 py-4">Nenhuma meta ativa cadastrada no momento.</p>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {metas.map(meta => (
                                                                    <div key={meta.id} className="space-y-2">
                                                                        <div className="flex justify-between items-center text-xs font-semibold">
                                                                            <span className="text-gray-700 dark:text-gray-300 font-bold">{meta.title}</span>
                                                                            <span className="text-brand-primary">{Number(meta.progress).toFixed(0)}%</span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                            <div 
                                                                                className="bg-brand-primary h-full rounded-full transition-all duration-500" 
                                                                                style={{ width: `${meta.progress}%` }}
                                                                            />
                                                                        </div>
                                                                        {meta.feedback_text && (
                                                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Nota: {meta.feedback_text}</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Feedbacks Recentes */}
                                            {(() => {
                                                const feedbacks = evaluations.filter(e => e.type === 'feedback');
                                                return (
                                                    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm space-y-4">
                                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                                            <DocumentIcon className="w-5 h-5 text-blue-500" />
                                                            Feedbacks e Orientações Individuais
                                                        </h4>
                                                        {feedbacks.length === 0 ? (
                                                            <p className="text-xs text-gray-400 py-4">Nenhum feedback lançado recentemente.</p>
                                                        ) : (
                                                            <div className="divide-y divide-gray-100 dark:divide-slate-800">
                                                                {feedbacks.map(f => (
                                                                    <div key={f.id} className="py-4 first:pt-0 last:pb-0">
                                                                        <div className="flex justify-between items-center text-xs mb-2">
                                                                            <span className="font-bold text-gray-700 dark:text-gray-250">{f.title}</span>
                                                                            <span className="text-gray-400">{new Date(f.created_at).toLocaleDateString('pt-BR')}</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic bg-gray-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800">
                                                                            "{f.feedback_text}"
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Coluna 3: Gráfico de Competências / Notas */}
                                        {(() => {
                                            const competencia = evaluations.find(e => e.type === 'competencia');
                                            if (!competencia) return (
                                                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex items-center justify-center text-center">
                                                    <p className="text-xs text-gray-400 py-8">Nenhuma avaliação de competências do gestor lançada ainda.</p>
                                                </div>
                                            );

                                            const radarData = [
                                                { name: 'Comunicação', nota: Number(competencia.score_communication || 0) },
                                                { name: 'Qualidade', nota: Number(competencia.score_quality || 0) },
                                                { name: 'Equipe', nota: Number(competencia.score_teamwork || 0) },
                                                { name: 'Proatividade', nota: Number(competencia.score_proactivity || 0) }
                                            ];

                                            return (
                                                <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-white/5 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                                            <StarIcon className="w-5 h-5 text-amber-500" />
                                                            Competências ({competencia.title})
                                                        </h4>
                                                        <p className="text-[10px] text-gray-400 leading-tight">Nota de desempenho atribuída pelo gestor (escala de 1 a 5).</p>
                                                    </div>

                                                    <div className="h-56 w-full flex items-center justify-center my-4">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={radarData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                                                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                                                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                                                <Tooltip />
                                                                <Bar dataKey="nota" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>

                                                    {competencia.feedback_text && (
                                                        <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-[11px] text-gray-650 dark:text-gray-300 leading-relaxed italic mt-2">
                                                            "{competencia.feedback_text}"
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
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
