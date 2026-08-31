import ModalPortal from './ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { supabase, getCleanImageUrl, downloadFile, getSignedStorageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';
import HRCalculatorAI from './HRCalculatorAI';

interface VacationRequest {
  id: string; employee_id: string; start_date: string; end_date: string;
  days_requested: number; status: string; notes: string | null; response_notes: string | null;
  created_at: string; profiles?: { full_name: string; avatar_url: string | null };
}
interface Employee { id: string; full_name: string; avatar_url: string | null; email: string; department_id?: string | null; }

const HRManager: React.FC = () => {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'vacation' | 'balance' | 'documents' | 'payslips' | 'timebank' | 'benefits' | 'performance'>('vacation');
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Balance state
  const [selEmployee, setSelEmployee] = useState('');
  const [balYear, setBalYear] = useState(new Date().getFullYear());
  const [availDays, setAvailDays] = useState(30);
  const [takenDays, setTakenDays] = useState(0);
  const [savingBalance, setSavingBalance] = useState(false);

  // Documents state
  const [docs, setDocs] = useState<any[]>([]);
  const [docForm, setDocForm] = useState({ name: '', description: '', category: 'general', is_public: true });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  // Document targeting
  const [docTargetType, setDocTargetType] = useState<'all' | 'users' | 'departments'>('all');
  const [docTargetUsers, setDocTargetUsers] = useState<string[]>([]);
  const [docTargetDepts, setDocTargetDepts] = useState<string[]>([]);
  const [departments, setDepartments] = useState<{id: string; name: string}[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [docShowDeptFilter, setDocShowDeptFilter] = useState(false);
  const [docSelectedDeptFilter, setDocSelectedDeptFilter] = useState('');

  // Payslips state
  const [payslips, setPayslips] = useState<any[]>([]);
  const [psEmployee, setPsEmployee] = useState('');
  const [psFile, setPsFile] = useState<File | null>(null);
  const [psMonth, setPsMonth] = useState('');
  const [psNet, setPsNet] = useState('');
  const [uploadingPs, setUploadingPs] = useState(false);
  const psInputRef = useRef<HTMLInputElement>(null);

  // Viewer state
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [viewingSignedUrl, setViewingSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const prepareViewingUrl = async () => {
      if (!viewingDocUrl) {
        if (active) setViewingSignedUrl(null);
        return;
      }

      try {
        const signed = await getSignedStorageUrl(viewingDocUrl);
        if (active) setViewingSignedUrl(signed);
      } catch (err) {
        console.error('Erro ao preparar visualização segura:', err);
        if (active) setViewingSignedUrl(null);
      }
    };

    prepareViewingUrl();

    return () => {
      active = false;
    };
  }, [viewingDocUrl]);
  const [viewingDocName, setViewingDocName] = useState<string | null>(null);

  // Novo: Banco de Horas Admin State
  const [timeBankEntries, setTimeBankEntries] = useState<any[]>([]);
  const [tbEmployee, setTbEmployee] = useState('');
  const [tbDate, setTbDate] = useState(new Date().toISOString().split('T')[0]);
  const [tbHours, setTbHours] = useState('');
  const [tbDesc, setTbDesc] = useState('');
  const [savingTb, setSavingTb] = useState(false);

  // Novo: Benefícios Admin State
  const [employeeBenefits, setEmployeeBenefits] = useState<any[]>([]);
  const [ebEmployee, setEbEmployee] = useState('');
  const [ebName, setEbName] = useState('');
  const [ebValue, setEbValue] = useState('');
  const [ebDesc, setEbDesc] = useState('');
  const [ebStartDate, setEbStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingEb, setSavingEb] = useState(false);
  const [ebTargetType, setEbTargetType] = useState<'all' | 'users' | 'departments'>('all');
  const [ebTargetUsers, setEbTargetUsers] = useState<string[]>([]);
  const [ebTargetDepts, setEbTargetDepts] = useState<string[]>([]);
  const [ebUserSearch, setEbUserSearch] = useState('');
  const [ebShowDeptFilter, setEbShowDeptFilter] = useState(false);
  const [ebSelectedDeptFilter, setEbSelectedDeptFilter] = useState('');

  // Novo: Metas/Desempenho Admin State
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [evEmployee, setEvEmployee] = useState('');
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<'meta' | 'feedback' | 'competencia'>('feedback');
  const [evStatus, setEvStatus] = useState<'pendente' | 'em_progresso' | 'concluido'>('em_progresso');
  const [evProgress, setEvProgress] = useState('0');
  const [evComm, setEvComm] = useState('5');
  const [evQual, setEvQual] = useState('5');
  const [evTeam, setEvTeam] = useState('5');
  const [evProact, setEvProact] = useState('5');
  const [evFeedbackText, setEvFeedbackText] = useState('');
  const [savingEv, setSavingEv] = useState(false);
  const [competencies, setCompetencies] = useState<string[]>([]);
  const [newCompetency, setNewCompetency] = useState('');
  const [showCompetenciesModal, setShowCompetenciesModal] = useState(false);
  const [customScores, setCustomScores] = useState<Record<string, string>>({});
  const [evTargetType, setEvTargetType] = useState<'all' | 'users' | 'departments'>('all');
  const [evTargetUsers, setEvTargetUsers] = useState<string[]>([]);
  const [evTargetDepts, setEvTargetDepts] = useState<string[]>([]);
  const [evUserSearch, setEvUserSearch] = useState('');
  const [evShowDeptFilter, setEvShowDeptFilter] = useState(false);
  const [evSelectedDeptFilter, setEvSelectedDeptFilter] = useState('');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  const fetchCompetencies = async () => {
    if (!profile?.company_id) return;
    const { data, error } = await supabase
      .from('companies')
      .select('competencies')
      .eq('id', profile.company_id)
      .single();
    if (data && data.competencies) {
      setCompetencies(data.competencies);
      // Initialize scores
      const initialScores: Record<string, string> = {};
      data.competencies.forEach((c: string) => {
        initialScores[c] = '10';
      });
      setCustomScores(initialScores);
    }
  };

  useEffect(() => { if (profile?.company_id) { fetchAll(); } }, [profile?.company_id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchRequests(),
      fetchEmployees(),
      fetchDocuments(),
      fetchPayslips(),
      fetchTimeBank(),
      fetchEmployeeBenefits(),
      fetchEvaluations(),
      fetchCompetencies(),
      fetchDepartments()
    ]);
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments')
      .select('id, name')
      .eq('company_id', profile!.company_id!)
      .order('name');
    if (data) setDepartments(data);
  };

  const fetchRequests = async () => {
    const { data } = await supabase.from('hr_vacation_requests')
      .select('*, profiles:employee_id(full_name, avatar_url)')
      .eq('company_id', profile!.company_id!)
      .order('created_at', { ascending: false });
    if (data) setRequests(data as any);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('profiles')
      .select('id, full_name, avatar_url, email, department_id')
      .eq('company_id', profile!.company_id!);
    if (data) setEmployees(data);
  };

  const fetchDocuments = async () => {
    const { data } = await supabase.from('hr_documents')
      .select('*').eq('company_id', profile!.company_id!).order('category').order('name');
    if (data) setDocs(data);
  };

  const fetchPayslips = async () => {
    const { data } = await supabase.from('hr_payslips')
      .select('*, profiles:employee_id(full_name)')
      .eq('company_id', profile!.company_id!)
      .order('reference_date', { ascending: false });
    if (data) setPayslips(data as any);
  };

  const fetchTimeBank = async () => {
    const { data } = await supabase.from('hr_time_bank')
      .select('*, profiles:employee_id(full_name)')
      .eq('company_id', profile!.company_id!)
      .order('date', { ascending: false });
    if (data) setTimeBankEntries(data);
  };

  const fetchEmployeeBenefits = async () => {
    const { data } = await supabase.from('hr_employee_benefits')
      .select('*, profiles:employee_id(full_name)')
      .eq('company_id', profile!.company_id!)
      .order('name');
    if (data) setEmployeeBenefits(data);
  };

  const fetchEvaluations = async () => {
    const { data } = await supabase.from('hr_evaluations')
      .select('*, profiles:employee_id(full_name)')
      .eq('company_id', profile!.company_id!)
      .order('created_at', { ascending: false });
    if (data) setEvaluations(data);
  };

  const saveTimeBank = async () => {
    if (!tbEmployee || !tbHours) { showToast('Selecione o funcionário e insira a quantidade de horas.', false); return; }
    setSavingTb(true);
    const { error } = await supabase.from('hr_time_bank').insert({
      company_id: profile!.company_id!,
      employee_id: tbEmployee,
      date: tbDate,
      hours_changed: parseFloat(tbHours),
      description: tbDesc || null,
      created_by: profile!.id
    });
    setSavingTb(false);
    if (error) { showToast('Erro ao salvar horas.', false); }
    else {
      showToast('Lançamento de horas salvo!');
      setTbHours(''); setTbDesc('');
      fetchTimeBank();
    }
  };

  const deleteTimeBank = async (id: string) => {
    if (!confirm('Excluir este lançamento de horas?')) return;
    const { error } = await supabase.from('hr_time_bank').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir.', false); }
    else { showToast('Lançamento excluído.'); fetchTimeBank(); }
  };

  const saveEmployeeBenefit = async () => {
    if (!ebName) { showToast('Insira o nome do benefício.', false); return; }

    // Resolve target employees
    let targetEmployeeIds: string[] = [];
    if (ebTargetType === 'all') {
      targetEmployeeIds = employees.map(e => e.id);
    } else if (ebTargetType === 'departments') {
      targetEmployeeIds = employees
        .filter(e => e.department_id && ebTargetDepts.includes(e.department_id))
        .map(e => e.id);
    } else if (ebTargetType === 'users') {
      targetEmployeeIds = ebTargetUsers;
    }

    if (targetEmployeeIds.length === 0) {
      showToast('Selecione pelo menos um colaborador para vincular o benefício.', false);
      return;
    }

    setSavingEb(true);
    const rows = targetEmployeeIds.map(empId => ({
      company_id: profile!.company_id!,
      employee_id: empId,
      name: ebName,
      value: ebValue ? parseFloat(ebValue) : null,
      description: ebDesc || null,
      start_date: ebStartDate || null,
      status: 'ativo'
    }));

    const { error } = await supabase.from('hr_employee_benefits').insert(rows);
    setSavingEb(false);
    if (error) {
      showToast('Erro ao salvar benefício.', false);
    } else {
      showToast('Benefício vinculado com sucesso!');
      setEbName(''); setEbValue(''); setEbDesc('');
      setEbTargetUsers([]); setEbTargetDepts([]); setEbTargetType('all');
      fetchEmployeeBenefits();
    }
  };

  const deleteEmployeeBenefit = async (id: string) => {
    if (!confirm('Excluir este benefício do funcionário?')) return;
    const { error } = await supabase.from('hr_employee_benefits').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir.', false); }
    else { showToast('Benefício excluído.'); fetchEmployeeBenefits(); }
  };

  const addCompetency = async () => {
    if (!newCompetency.trim()) return;
    if (competencies.length >= 10) { showToast('Máximo de 10 competências atingido.', false); return; }
    if (competencies.includes(newCompetency.trim())) { showToast('Esta competência já existe.', false); return; }
    
    const updated = [...competencies, newCompetency.trim()];
    const { error } = await supabase
      .from('companies')
      .update({ competencies: updated })
      .eq('id', profile!.company_id!);
      
    if (error) {
      showToast('Erro ao salvar competência: ' + error.message, false);
    } else {
      setCompetencies(updated);
      setNewCompetency('');
      setCustomScores(prev => ({ ...prev, [newCompetency.trim()]: '10' }));
      showToast('Competência adicionada!');
    }
  };

  const removeCompetency = async (comp: string) => {
    const updated = competencies.filter(c => c !== comp);
    const { error } = await supabase
      .from('companies')
      .update({ competencies: updated })
      .eq('id', profile!.company_id!);
      
    if (error) {
      showToast('Erro ao remover competência: ' + error.message, false);
    } else {
      setCompetencies(updated);
      showToast('Competência removida!');
    }
  };

  const saveEvaluation = async () => {
    if (!evTitle) { showToast('Insira o título.', false); return; }

    // Resolve target employees
    let targetEmployeeIds: string[] = [];
    if (evTargetType === 'all') {
      targetEmployeeIds = employees.map(e => e.id);
    } else if (evTargetType === 'departments') {
      targetEmployeeIds = employees
        .filter(e => e.department_id && evTargetDepts.includes(e.department_id))
        .map(e => e.id);
    } else if (evTargetType === 'users') {
      targetEmployeeIds = evTargetUsers;
    }

    if (targetEmployeeIds.length === 0) {
      showToast('Selecione pelo menos um colaborador para cadastrar a avaliação/meta.', false);
      return;
    }

    setSavingEv(true);
    const isCustom = competencies.length > 0;

    const rows = targetEmployeeIds.map(empId => ({
      company_id: profile!.company_id!,
      employee_id: empId,
      title: evTitle,
      type: evType,
      status: evStatus,
      progress: evType === 'meta' ? parseFloat(evProgress) : 0,
      score_communication: (evType === 'competencia' && !isCustom) ? parseFloat(evComm) : null,
      score_quality: (evType === 'competencia' && !isCustom) ? parseFloat(evQual) : null,
      score_teamwork: (evType === 'competencia' && !isCustom) ? parseFloat(evTeam) : null,
      score_proactivity: (evType === 'competencia' && !isCustom) ? parseFloat(evProact) : null,
      custom_scores: (evType === 'competencia' && isCustom) ? customScores : {},
      feedback_text: evFeedbackText || null,
      created_by: profile!.id
    }));

    const { error } = await supabase.from('hr_evaluations').insert(rows);
    setSavingEv(false);
    if (error) {
      showToast('Erro ao salvar avaliação.', false);
    } else {
      showToast('Avaliação/Meta cadastrada com sucesso!');
      setEvTitle(''); setEvProgress('0'); setEvFeedbackText('');
      setEvTargetUsers([]); setEvTargetDepts([]); setEvTargetType('all');
      const resetScores: Record<string, string> = {};
      competencies.forEach(c => { resetScores[c] = '10'; });
      setCustomScores(resetScores);
      fetchEvaluations();
    }
  };

  const deleteEvaluation = async (id: string) => {
    if (!confirm('Excluir esta avaliação/meta?')) return;
    const { error } = await supabase.from('hr_evaluations').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir.', false); }
    else { showToast('Avaliação/Meta excluída.'); fetchEvaluations(); }
  };

  const reviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('hr_vacation_requests').update({
      status, response_notes: responseNote || null,
      reviewed_by: profile!.id, reviewed_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { showToast('Erro ao atualizar.', false); return; }
    showToast(`Solicitação ${status === 'approved' ? 'aprovada' : 'recusada'}!`);
    setReviewingId(null); setResponseNote(''); fetchRequests();
  };

  const saveBalance = async () => {
    if (!selEmployee) { showToast('Selecione um funcionário.', false); return; }
    setSavingBalance(true);
    const { error } = await supabase.from('hr_vacation_balance').upsert({
      company_id: profile!.company_id!, employee_id: selEmployee,
      year: balYear, available_days: availDays, taken_days: takenDays,
      updated_at: new Date().toISOString()
    }, { onConflict: 'employee_id,year' });
    setSavingBalance(false);
    if (error) { showToast('Erro ao salvar saldo.', false); } else { showToast('Saldo salvo!'); }
  };

  const uploadDocument = async () => {
    if (!docFile || !docForm.name) { showToast('Preencha o nome e selecione um arquivo.', false); return; }
    setUploadingDoc(true);
    try {
      const ext = docFile.name.split('.').pop();
      const path = `documents/${profile!.company_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('hr-files').upload(path, docFile);
      if (upErr) throw upErr;
      const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/hr-files/${path}`;
      const { error } = await supabase.from('hr_documents').insert({
        company_id: profile!.company_id!,
        ...docForm,
        is_public: docTargetType === 'all',
        file_url: publicUrl,
        file_name: docFile.name,
        created_by: profile!.id,
        target_type: docTargetType,
        target_users: docTargetType === 'users' ? docTargetUsers : [],
        target_departments: docTargetType === 'departments' ? docTargetDepts : [],
      });
      if (error) throw error;
      showToast('Documento publicado!');
      setDocForm({ name: '', description: '', category: 'general', is_public: true });
      setDocFile(null);
      setDocTargetType('all');
      setDocTargetUsers([]);
      setDocTargetDepts([]);
      setUserSearch('');
      if (docInputRef.current) docInputRef.current.value = '';
      fetchDocuments();
    } catch (e: any) { showToast(e.message || 'Erro ao publicar.', false); }
    finally { setUploadingDoc(false); }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Excluir este documento?')) return;
    await supabase.from('hr_documents').delete().eq('id', id);
    showToast('Documento excluído.'); fetchDocuments();
  };

  const uploadPayslip = async () => {
    if (!psFile || !psEmployee || !psMonth) { showToast('Preencha todos os campos.', false); return; }
    setUploadingPs(true);
    try {
      const ext = psFile.name.split('.').pop();
      const path = `payslips/${profile!.company_id}/${psEmployee}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('hr-files').upload(path, psFile);
      if (upErr) throw upErr;
      const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/hr-files/${path}`;
      const refDate = new Date();
      const { error } = await supabase.from('hr_payslips').insert({
        company_id: profile!.company_id!, employee_id: psEmployee, month: psMonth,
        reference_date: refDate.toISOString().split('T')[0], file_url: publicUrl,
        file_name: psFile.name, net_salary: psNet ? parseFloat(psNet) : null, created_by: profile!.id
      });
      if (error) throw error;
      showToast('Holerite enviado!');
      setPsEmployee(''); setPsMonth(''); setPsNet(''); setPsFile(null);
      if (psInputRef.current) psInputRef.current.value = '';
      fetchPayslips();
    } catch (e: any) { showToast(e.message || 'Erro ao enviar.', false); }
    finally { setUploadingPs(false); }
  };

  const deletePayslip = async (id: string) => {
    if (!confirm('Excluir este holerite?')) return;
    await supabase.from('hr_payslips').delete().eq('id', id);
    showToast('Holerite excluído.'); fetchPayslips();
  };
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'
  };
  const statusLabels: Record<string, string> = {
    pending: 'Aguardando', approved: 'Aprovado', rejected: 'Recusado', cancelled: 'Cancelado'
  };
  const catLabels: Record<string, string> = { general: 'Geral', policies: 'Políticas', benefits: 'Benefícios', contracts: 'Contratos' };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-xl text-white font-medium ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          ['vacation','🏖️ Férias', null],
          ['balance','📊 Saldo', null],
          ['documents','📄 Documentos', null],
          ['payslips','💰 Holerites', null],
          ['timebank','⏰ Banco de Horas', 'timebank'],
          ['benefits','🎁 Benefícios', 'employee_benefits'],
          ['performance','📈 Avaliações/Metas', 'performance']
        ].filter(([,, featId]) => {
          if (featId) {
            const comp = profile?.company;
            const merged = {
              ...(comp?.plan?.features || {}),
              ...(comp?.custom_features || {})
            };
            const feat = merged[featId] as any;
            if (feat === false || feat === 'disabled') {
              return false;
            }
          }
          return true;
        }).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${tab === k ? 'bg-brand-primary text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* VACATION REQUESTS */}
      {tab === 'vacation' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Solicitações de Férias</h3>
          {requests.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm py-8 text-center">Nenhuma solicitação encontrada.</p>
          ) : requests.map(req => (
            <div key={req.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-400">
                    {(req as any).profiles?.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{(req as any).profiles?.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(req.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(req.end_date + 'T12:00:00').toLocaleDateString('pt-BR')} ({req.days_requested} dias)
                    </p>
                    {req.notes && <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">"{req.notes}"</p>}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[req.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                  {statusLabels[req.status] || req.status}
                </span>
              </div>

              {req.status === 'pending' && (
                reviewingId === req.id ? (
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/5">
                    <input
                      value={responseNote}
                      onChange={e => setResponseNote(e.target.value)}
                      placeholder="Comentário para o colaborador (opcional)"
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => reviewRequest(req.id, 'approved')}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all">
                        ✓ Aprovar
                      </button>
                      <button onClick={() => reviewRequest(req.id, 'rejected')}
                        className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all">
                        ✗ Recusar
                      </button>
                      <button onClick={() => { setReviewingId(null); setResponseNote(''); }}
                        className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setReviewingId(req.id); setResponseNote(''); }}
                    className="text-xs font-bold text-brand-primary hover:underline">
                    Analisar solicitação →
                  </button>
                )
              )}
              {req.response_notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">Resposta: "{req.response_notes}"</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BALANCE */}
      {tab === 'balance' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4 max-w-lg">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Definir Saldo de Férias</h3>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Funcionário</label>
            <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)}
              className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="">Selecione...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Ano</label>
            <input type="number" value={balYear} onChange={e => setBalYear(parseInt(e.target.value))}
              className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Dias Disponíveis</label>
              <input type="number" value={availDays} onChange={e => setAvailDays(parseInt(e.target.value))}
                className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Dias Gozados</label>
              <input type="number" value={takenDays} onChange={e => setTakenDays(parseInt(e.target.value))}
                className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
          <button onClick={saveBalance} disabled={savingBalance}
            className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-60">
            {savingBalance ? 'Salvando...' : 'Salvar Saldo'}
          </button>
        </div>
      )}

      {/* DOCUMENTS */}
      {tab === 'documents' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Publicar Novo Documento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Nome</label>
                <input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Manual do Colaborador" className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Categoria</label>
                <select value={docForm.category} onChange={e => setDocForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                  {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Descrição (opcional)</label>
                <input value={docForm.description} onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Arquivo</label>
                <input type="file" ref={docInputRef} onChange={e => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-primary file:text-white hover:file:bg-emerald-600" />
              </div>

              {/* ── Seleção de Destinatários ── */}
              <div className="md:col-span-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">📤 Enviar para</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {(['all', 'departments', 'users'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setDocTargetType(t); setDocTargetUsers([]); setDocTargetDepts([]); setUserSearch(''); }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        docTargetType === t
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {t === 'all' ? '🌐 Todos os funcionários' : t === 'departments' ? '🏢 Setor específico' : '👤 Pessoas específicas'}
                    </button>
                  ))}
                </div>

                {/* Setor */}
                {docTargetType === 'departments' && (
                  <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Selecione os setores</p>
                    <div className="flex flex-wrap gap-2">
                      {departments.map(dept => (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setDocTargetDepts(prev =>
                            prev.includes(dept.id) ? prev.filter(id => id !== dept.id) : [...prev, dept.id]
                          )}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            docTargetDepts.includes(dept.id)
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {docTargetDepts.includes(dept.id) ? '✓ ' : ''}{dept.name}
                        </button>
                      ))}
                      {departments.length === 0 && <p className="text-xs text-gray-400">Nenhum setor cadastrado.</p>}
                    </div>
                    {docTargetDepts.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                        {docTargetDepts.length} setor(es) selecionado(s)
                      </p>
                    )}
                  </div>
                )}

                {/* Pessoas específicas */}
                {docTargetType === 'users' && (
                  <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Selecione os funcionários</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDocTargetUsers(employees.map(emp => emp.id))}
                          className="px-2 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-[10px] font-bold rounded-lg transition-all"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocTargetUsers([])}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="text"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Buscar funcionário..."
                        className="flex-1 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                      <button
                        type="button"
                        onClick={() => { setDocShowDeptFilter(!docShowDeptFilter); setDocSelectedDeptFilter(''); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          docShowDeptFilter
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-brand-primary'
                        }`}
                      >
                        📁 Filtrar por Setor
                      </button>
                    </div>

                    {docShowDeptFilter && (
                      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wide">Escolha um Setor para Filtrar</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDocSelectedDeptFilter('')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              docSelectedDeptFilter === ''
                                ? 'bg-brand-primary text-white border-brand-primary'
                                : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Todos os Setores
                          </button>
                          {departments.map(dept => (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => setDocSelectedDeptFilter(dept.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                docSelectedDeptFilter === dept.id
                                  ? 'bg-brand-primary text-white border-brand-primary'
                                  : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {dept.name}
                            </button>
                          ))}
                        </div>
                        {docSelectedDeptFilter && (
                          <div className="flex gap-2 pt-1 border-t dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => {
                                const deptEmpIds = employees.filter(emp => emp.department_id === docSelectedDeptFilter).map(emp => emp.id);
                                setDocTargetUsers(prev => Array.from(new Set([...prev, ...deptEmpIds])));
                              }}
                              className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded"
                            >
                              Selecionar Todos deste Setor
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const deptEmpIds = employees.filter(emp => emp.department_id === docSelectedDeptFilter).map(emp => emp.id);
                                setDocTargetUsers(prev => prev.filter(id => !deptEmpIds.includes(id)));
                              }}
                              className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded"
                            >
                              Desmarcar Todos deste Setor
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {employees
                        .filter(emp => {
                          const matchesSearch = emp.full_name.toLowerCase().includes(userSearch.toLowerCase());
                          const matchesDept = !docSelectedDeptFilter || emp.department_id === docSelectedDeptFilter;
                          return matchesSearch && matchesDept;
                        })
                        .map(emp => (
                          <div
                            key={emp.id}
                            onClick={() => setDocTargetUsers(prev =>
                              prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                            )}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              docTargetUsers.includes(emp.id)
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              docTargetUsers.includes(emp.id)
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {docTargetUsers.includes(emp.id) && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{emp.full_name}</span>
                          </div>
                        ))}
                    </div>
                    {docTargetUsers.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {docTargetUsers.length} funcionário(s) selecionado(s)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button onClick={uploadDocument} disabled={uploadingDoc}
              className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-60">
              {uploadingDoc ? 'Publicando...' : 'Publicar Documento'}
            </button>
          </div>


          <div>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-3">Documentos Publicados ({docs.length})</h3>
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl">
                  <div>
                    <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{doc.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{catLabels[doc.category] || doc.category} {doc.is_public ? '· Público' : '· Privado'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setViewingDocUrl(doc.file_url); setViewingDocName(doc.name); }}
                      className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
                      Ver
                    </button>
                    <button onClick={() => deleteDocument(doc.id)}
                      className="px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAYSLIPS */}
      {tab === 'payslips' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Enviar Holerite</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Funcionário</label>
                <select value={psEmployee} onChange={e => setPsEmployee(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                  <option value="">Selecione...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Mês de Referência</label>
                <input value={psMonth} onChange={e => setPsMonth(e.target.value)} placeholder="Ex: Janeiro 2025"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Salário Líquido (R$) - Opcional</label>
                <input type="number" value={psNet} onChange={e => setPsNet(e.target.value)} placeholder="Ex: 3500.00"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Arquivo (PDF)</label>
                <input type="file" ref={psInputRef} accept=".pdf,.png,.jpg" onChange={e => setPsFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-primary file:text-white hover:file:bg-emerald-600" />
              </div>
            </div>
            <button onClick={uploadPayslip} disabled={uploadingPs}
              className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-60">
              {uploadingPs ? 'Enviando...' : 'Enviar Holerite'}
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-3">Holerites Enviados ({payslips.length})</h3>
            <div className="space-y-2">
              {payslips.map((ps: any) => (
                <div key={ps.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl">
                  <div>
                    <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{ps.profiles?.full_name} — {ps.month}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Disponibilizado {new Date(ps.available_at).toLocaleDateString('pt-BR')}
                      {ps.net_salary ? ` · Líquido: R$ ${ps.net_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {ps.file_url && (
                      <button onClick={() => { setViewingDocUrl(ps.file_url); setViewingDocName(`${ps.profiles?.full_name} — ${ps.month}`); }}
                        className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
                        Ver
                      </button>
                    )}
                    <button onClick={() => deletePayslip(ps.id)}
                      className="px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TIMEBANK ADMIN */}
      {tab === 'timebank' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Lançar Horas Extras / Compensações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Funcionário</label>
                <select value={tbEmployee} onChange={e => setTbEmployee(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                  <option value="">Selecione...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Data</label>
                <input type="date" value={tbDate} onChange={e => setTbDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Horas Alteradas (positivo para extra, negativo para folga)</label>
                <input type="number" step="0.1" value={tbHours} onChange={e => setTbHours(e.target.value)} placeholder="Ex: 2.5 ou -1.5"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Descrição / Motivo</label>
                <input type="text" value={tbDesc} onChange={e => setTbDesc(e.target.value)} placeholder="Ex: Horas extras no Projeto Panda"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
            </div>
            <button onClick={saveTimeBank} disabled={savingTb}
              className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-60">
              {savingTb ? 'Salvando...' : 'Lançar Horas'}
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-3">Lançamentos Recentes ({timeBankEntries.length})</h3>
            <div className="space-y-2">
              {timeBankEntries.map(entry => {
                const change = Number(entry.hours_changed);
                return (
                  <div key={entry.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl">
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{entry.profiles?.full_name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-505">
                        Data: {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')} · Motivo: {entry.description || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-black ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}h
                      </span>
                      <button onClick={() => deleteTimeBank(entry.id)}
                        className="px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-505 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BENEFITS ADMIN */}
      {tab === 'benefits' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Vincular Benefício ao Funcionário</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 border-b dark:border-white/5 pb-4">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">📤 Vincular para</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {(['all', 'departments', 'users'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setEbTargetType(t); setEbTargetUsers([]); setEbTargetDepts([]); setEbUserSearch(''); }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        ebTargetType === t
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {t === 'all' ? '🌐 Todos os funcionários' : t === 'departments' ? '🏢 Setor específico' : '👤 Pessoas específicas'}
                    </button>
                  ))}
                </div>

                {/* Setor */}
                {ebTargetType === 'departments' && (
                  <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Selecione os setores</p>
                    <div className="flex flex-wrap gap-2">
                      {departments.map(dept => (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setEbTargetDepts(prev =>
                            prev.includes(dept.id) ? prev.filter(id => id !== dept.id) : [...prev, dept.id]
                          )}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            ebTargetDepts.includes(dept.id)
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {ebTargetDepts.includes(dept.id) ? '✓ ' : ''}{dept.name}
                        </button>
                      ))}
                      {departments.length === 0 && <p className="text-xs text-gray-400">Nenhum setor cadastrado.</p>}
                    </div>
                    {ebTargetDepts.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                        {ebTargetDepts.length} setor(es) selecionado(s)
                      </p>
                    )}
                  </div>
                )}

                {/* Pessoas específicas */}
                {ebTargetType === 'users' && (
                  <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Selecione os funcionários</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEbTargetUsers(employees.map(emp => emp.id))}
                          className="px-2 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-[10px] font-bold rounded-lg transition-all"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setEbTargetUsers([])}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="text"
                        value={ebUserSearch}
                        onChange={e => setEbUserSearch(e.target.value)}
                        placeholder="Buscar funcionário..."
                        className="flex-1 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                      <button
                        type="button"
                        onClick={() => { setEbShowDeptFilter(!ebShowDeptFilter); setEbSelectedDeptFilter(''); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          ebShowDeptFilter
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-brand-primary'
                        }`}
                      >
                        📁 Filtrar por Setor
                      </button>
                    </div>

                    {ebShowDeptFilter && (
                      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wide">Escolha um Setor para Filtrar</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEbSelectedDeptFilter('')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              ebSelectedDeptFilter === ''
                                ? 'bg-brand-primary text-white border-brand-primary'
                                : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Todos os Setores
                          </button>
                          {departments.map(dept => (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => setEbSelectedDeptFilter(dept.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                ebSelectedDeptFilter === dept.id
                                  ? 'bg-brand-primary text-white border-brand-primary'
                                  : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {dept.name}
                            </button>
                          ))}
                        </div>
                        {ebSelectedDeptFilter && (
                          <div className="flex gap-2 pt-1 border-t dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => {
                                const deptEmpIds = employees.filter(emp => emp.department_id === ebSelectedDeptFilter).map(emp => emp.id);
                                setEbTargetUsers(prev => Array.from(new Set([...prev, ...deptEmpIds])));
                              }}
                              className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded"
                            >
                              Selecionar Todos deste Setor
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const deptEmpIds = employees.filter(emp => emp.department_id === ebSelectedDeptFilter).map(emp => emp.id);
                                setEbTargetUsers(prev => prev.filter(id => !deptEmpIds.includes(id)));
                              }}
                              className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded"
                            >
                              Desmarcar Todos deste Setor
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {employees
                        .filter(emp => {
                          const matchesSearch = emp.full_name.toLowerCase().includes(ebUserSearch.toLowerCase());
                          const matchesDept = !ebSelectedDeptFilter || emp.department_id === ebSelectedDeptFilter;
                          return matchesSearch && matchesDept;
                        })
                        .map(emp => (
                          <div
                            key={emp.id}
                            onClick={() => setEbTargetUsers(prev =>
                              prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                            )}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              ebTargetUsers.includes(emp.id)
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              ebTargetUsers.includes(emp.id)
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {ebTargetUsers.includes(emp.id) && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{emp.full_name}</span>
                          </div>
                        ))}
                    </div>
                    {ebTargetUsers.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {ebTargetUsers.length} funcionário(s) selecionado(s)
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Nome do Benefício</label>
                <input value={ebName} onChange={e => setEbName(e.target.value)} placeholder="Ex: Plano de Saúde Unimed"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Valor Subsídio Mensal (R$) - Opcional</label>
                <input type="number" step="0.01" value={ebValue} onChange={e => setEbValue(e.target.value)} placeholder="Ex: 350.00"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Data de Início</label>
                <input type="date" value={ebStartDate} onChange={e => setEbStartDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Descrição</label>
                <input value={ebDesc} onChange={e => setEbDesc(e.target.value)} placeholder="Ex: Co-participativo, enfermaria"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
            </div>
            <button onClick={saveEmployeeBenefit} disabled={savingEb}
              className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-60">
              {savingEb ? 'Salvando...' : 'Vincular Benefício'}
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-3">Benefícios Ativos ({employeeBenefits.length})</h3>
            <div className="space-y-2">
              {employeeBenefits.map(benefit => (
                <div key={benefit.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl">
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{benefit.profiles?.full_name} — {benefit.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Início: {benefit.start_date ? new Date(benefit.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      {benefit.value ? ` · Subsídio: R$ ${Number(benefit.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                    </p>
                  </div>
                  <button onClick={() => deleteEmployeeBenefit(benefit.id)}
                    className="px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-505 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PERFORMANCE ADMIN */}
      {tab === 'performance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Cadastrar Avaliação / Meta de Desempenho</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 border-b dark:border-white/5 pb-4">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">📤 Vincular para</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {(['all', 'departments', 'users'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setEvTargetType(t); setEvTargetUsers([]); setEvTargetDepts([]); setEvUserSearch(''); }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        evTargetType === t
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {t === 'all' ? '🌐 Todos os funcionários' : t === 'departments' ? '🏢 Setor específico' : '👤 Pessoas específicas'}
                    </button>
                  ))}
                </div>

                {/* Setor */}
                {evTargetType === 'departments' && (
                  <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Selecione os setores</p>
                    <div className="flex flex-wrap gap-2">
                      {departments.map(dept => (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setEvTargetDepts(prev =>
                            prev.includes(dept.id) ? prev.filter(id => id !== dept.id) : [...prev, dept.id]
                          )}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            evTargetDepts.includes(dept.id)
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {evTargetDepts.includes(dept.id) ? '✓ ' : ''}{dept.name}
                        </button>
                      ))}
                      {departments.length === 0 && <p className="text-xs text-gray-400">Nenhum setor cadastrado.</p>}
                    </div>
                    {evTargetDepts.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                        {evTargetDepts.length} setor(es) selecionado(s)
                      </p>
                    )}
                  </div>
                )}

                {/* Pessoas específicas */}
                {evTargetType === 'users' && (
                  <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Selecione os funcionários</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEvTargetUsers(employees.map(emp => emp.id))}
                          className="px-2 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-[10px] font-bold rounded-lg transition-all"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setEvTargetUsers([])}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="text"
                        value={evUserSearch}
                        onChange={e => setEvUserSearch(e.target.value)}
                        placeholder="Buscar funcionário..."
                        className="flex-1 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                      <button
                        type="button"
                        onClick={() => { setEvShowDeptFilter(!evShowDeptFilter); setEvSelectedDeptFilter(''); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          evShowDeptFilter
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-brand-primary'
                        }`}
                      >
                        📁 Filtrar por Setor
                      </button>
                    </div>

                    {evShowDeptFilter && (
                      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wide">Escolha um Setor para Filtrar</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEvSelectedDeptFilter('')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              evSelectedDeptFilter === ''
                                ? 'bg-brand-primary text-white border-brand-primary'
                                : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Todos os Setores
                          </button>
                          {departments.map(dept => (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => setEvSelectedDeptFilter(dept.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                evSelectedDeptFilter === dept.id
                                  ? 'bg-brand-primary text-white border-brand-primary'
                                  : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {dept.name}
                            </button>
                          ))}
                        </div>
                        {evSelectedDeptFilter && (
                          <div className="flex gap-2 pt-1 border-t dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => {
                                const deptEmpIds = employees.filter(emp => emp.department_id === evSelectedDeptFilter).map(emp => emp.id);
                                setEvTargetUsers(prev => Array.from(new Set([...prev, ...deptEmpIds])));
                              }}
                              className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded"
                            >
                              Selecionar Todos deste Setor
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const deptEmpIds = employees.filter(emp => emp.department_id === evSelectedDeptFilter).map(emp => emp.id);
                                setEvTargetUsers(prev => prev.filter(id => !deptEmpIds.includes(id)));
                              }}
                              className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded"
                            >
                              Desmarcar Todos deste Setor
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {employees
                        .filter(emp => {
                          const matchesSearch = emp.full_name.toLowerCase().includes(evUserSearch.toLowerCase());
                          const matchesDept = !evSelectedDeptFilter || emp.department_id === evSelectedDeptFilter;
                          return matchesSearch && matchesDept;
                        })
                        .map(emp => (
                          <div
                            key={emp.id}
                            onClick={() => setEvTargetUsers(prev =>
                              prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                            )}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              evTargetUsers.includes(emp.id)
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              evTargetUsers.includes(emp.id)
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {evTargetUsers.includes(emp.id) && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{emp.full_name}</span>
                          </div>
                        ))}
                    </div>
                    {evTargetUsers.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {evTargetUsers.length} funcionário(s) selecionado(s)
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Tipo de Registro</label>
                <select value={evType} onChange={e => setEvType(e.target.value as any)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                  <option value="feedback">Feedback Individual</option>
                  <option value="meta">Meta Estratégica</option>
                  <option value="competencia">Avaliação de Competências (Notas)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Título do Registro</label>
                <input value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Ex: Metas Q1 ou Avaliação Anual"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>

              {evType === 'meta' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Progresso Atual (%)</label>
                    <input type="number" min="0" max="100" value={evProgress} onChange={e => setEvProgress(e.target.value)}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Status da Meta</label>
                    <select value={evStatus} onChange={e => setEvStatus(e.target.value as any)}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                      <option value="em_progresso">Em Progresso</option>
                      <option value="concluido">Concluído</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </div>
                </>
              )}

              {evType === 'competencia' && (
                <div className="md:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider block">Notas das Competências</span>
                    <button 
                      type="button" 
                      onClick={() => setShowCompetenciesModal(true)} 
                      className="text-xs text-brand-primary hover:underline font-bold"
                    >
                      ⚙️ Configurar Competências ({competencies.length}/10)
                    </button>
                  </div>
                  
                  {competencies.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 dark:bg-slate-800/30 p-4 rounded-xl border dark:border-slate-800">
                      {competencies.map(comp => (
                        <div key={comp} className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">{comp}</label>
                          <select 
                            value={customScores[comp] || '10'} 
                            onChange={e => setCustomScores(prev => ({ ...prev, [comp]: e.target.value }))}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                          >
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(val => (
                              <option key={val} value={val.toString()}>{val}</option>
                            ))}
                            <option value="N/A">N/A (Não se aplica)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-slate-800/30 p-4 rounded-xl border dark:border-slate-800">
                      <div>
                        <label className="text-xs font-semibold text-gray-505 block mb-1">Comunicação (1-5)</label>
                        <input type="number" min="1" max="5" step="0.5" value={evComm} onChange={e => setEvComm(e.target.value)}
                          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 text-gray-955 dark:text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-550 block mb-1">Qualidade (1-5)</label>
                        <input type="number" min="1" max="5" step="0.5" value={evQual} onChange={e => setEvQual(e.target.value)}
                          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 text-gray-955 dark:text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-550 block mb-1">Equipe (1-5)</label>
                        <input type="number" min="1" max="5" step="0.5" value={evTeam} onChange={e => setEvTeam(e.target.value)}
                          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 text-gray-955 dark:text-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-550 block mb-1">Proatividade (1-5)</label>
                        <input type="number" min="1" max="5" step="0.5" value={evProact} onChange={e => setEvProact(e.target.value)}
                          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 text-gray-955 dark:text-white focus:outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Comentários / Descritivo do Feedback</label>
                <textarea rows={3} value={evFeedbackText} onChange={e => setEvFeedbackText(e.target.value)} placeholder="Descreva os pontos de feedback ou critérios da meta..."
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-955 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none" />
              </div>
            </div>
            <button onClick={saveEvaluation} disabled={savingEv}
              className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-60">
              {savingEv ? 'Cadastrar Registro' : 'Cadastrar Registro'}
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-3">Registros de Desempenho ({evaluations.length})</h3>
            <div className="space-y-2">
              {evaluations.map(ev => (
                <div key={ev.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-xl">
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{ev.profiles?.full_name} — {ev.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Tipo: <span className="font-semibold uppercase text-[10px]">{ev.type}</span>
                      {ev.type === 'meta' && ` · Progresso: ${Number(ev.progress).toFixed(0)}%`}
                      {ev.type === 'competencia' && (
                        ev.custom_scores && Object.keys(ev.custom_scores).length > 0 ? (
                          ` · Notas: ` + Object.entries(ev.custom_scores).map(([k, v]) => `${k}:${v}`).join(', ')
                        ) : (
                          ` · Notas: C:${ev.score_communication} Q:${ev.score_quality} E:${ev.score_teamwork} P:${ev.score_proactivity}`
                        )
                      )}
                    </p>
                  </div>
                  <button onClick={() => deleteEvaluation(ev.id)}
                    className="px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-505 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCompetenciesModal && (
        <ModalPortal className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 pandanet-modal-viewport">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowCompetenciesModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-sm">X</button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Competências da Empresa</h3>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCompetency} 
                  onChange={e => setNewCompetency(e.target.value)} 
                  placeholder="Nova competência (ex: Liderança)"
                  className="flex-1 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none"
                />
                <button 
                  onClick={addCompetency}
                  className="px-4 py-2 bg-brand-primary hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Adicionar
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-550 italic leading-tight">Cadastre até 10 competências para avaliações de notas de 1 a 10 + N/A.</p>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {competencies.map(comp => (
                  <div key={comp} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-150 dark:border-slate-800">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{comp}</span>
                    <button 
                      onClick={() => removeCompetency(comp)} 
                      className="text-xs font-bold text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
                {competencies.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-4">Nenhuma competência cadastrada. O sistema usará as competências padrão de 1 a 5.</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button 
                onClick={() => setShowCompetenciesModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold uppercase transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {viewingDocUrl && (
        <ModalPortal className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 pandanet-modal-viewport">
          <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/10">
            <div className="p-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </span>
                <h4 className="font-bold text-gray-800 dark:text-white text-sm md:text-base">{viewingDocName || 'Visualizar Documento'}</h4>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => downloadFile(viewingDocUrl!, viewingDocName || 'documento')}
                  className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Baixar Arquivo
                </button>
                <button onClick={() => { setViewingDocUrl(null); setViewingDocName(null); }} className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-slate-950 relative">
              <iframe src={viewingSignedUrl || undefined} className="w-full h-full border-0 bg-white dark:bg-slate-900" title="Visualizador de Documento" />
            </div>
          </div>
        </ModalPortal>
      )}
      {profile && <HRCalculatorAI currentUser={profile} />}
    </div>
  );
};

export default HRManager;
