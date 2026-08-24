import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface VacationRequest {
  id: string; employee_id: string; start_date: string; end_date: string;
  days_requested: number; status: string; notes: string | null; response_notes: string | null;
  created_at: string; profiles?: { full_name: string; avatar_url: string | null };
}
interface Employee { id: string; full_name: string; avatar_url: string | null; email: string; }

const HRManager: React.FC = () => {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'vacation' | 'balance' | 'documents' | 'payslips'>('vacation');
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
  const [viewingDocName, setViewingDocName] = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { if (profile?.company_id) { fetchAll(); } }, [profile?.company_id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchEmployees(), fetchDocuments(), fetchPayslips()]);
    setLoading(false);
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
      .select('id, full_name, avatar_url, email')
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
      const { data: { publicUrl } } = supabase.storage.from('hr-files').getPublicUrl(path);
      const { error } = await supabase.from('hr_documents').insert({
        company_id: profile!.company_id!, ...docForm, file_url: publicUrl,
        file_name: docFile.name, created_by: profile!.id
      });
      if (error) throw error;
      showToast('Documento publicado!');
      setDocForm({ name: '', description: '', category: 'general', is_public: true });
      setDocFile(null); if (docInputRef.current) docInputRef.current.value = '';
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
      const { data: { publicUrl } } = supabase.storage.from('hr-files').getPublicUrl(path);
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
        {[['vacation','🏖️ Férias'],['balance','📊 Saldo'],['documents','📄 Documentos'],['payslips','💰 Holerites']].map(([k, l]) => (
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
              <div className="md:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is_public" checked={docForm.is_public}
                  onChange={e => setDocForm(f => ({ ...f, is_public: e.target.checked }))}
                  className="rounded" />
                <label htmlFor="is_public" className="text-sm text-gray-600 dark:text-gray-300">Visível para todos os colaboradores</label>
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

      {viewingDocUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/10">
            <div className="p-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </span>
                <h4 className="font-bold text-gray-800 dark:text-white text-sm md:text-base">{viewingDocName || 'Visualizar Documento'}</h4>
              </div>
              <div className="flex items-center gap-2">
                <a href={viewingDocUrl} download target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Baixar Arquivo
                </a>
                <button onClick={() => { setViewingDocUrl(null); setViewingDocName(null); }} className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-slate-950 relative">
              <iframe src={viewingDocUrl} className="w-full h-full border-0 bg-white dark:bg-slate-900" title="Visualizador de Documento" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRManager;
