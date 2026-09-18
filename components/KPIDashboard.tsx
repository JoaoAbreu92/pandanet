import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import ModalPortal from './ui/ModalPortal';
import { ChartBarIcon, PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface KPI { id: string; company_id: string; name: string; target: number; current: number; unit: string; category: string; period: string; powerbi_url?: string | null; }
const blank = { name: '', target: '', current: '0', unit: '', category: '', period: '', powerbi_url: '' };

const KPIDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<KPI | null>(null);
  const [form, setForm] = useState(blank);
  const canManage = Boolean(profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'admin' || profile?.role === 'Super Admin' || profile?.permissions?.manageKPIs);

  const load = useCallback(async () => {
    if (!profile?.company_id) { setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('kpis').select('*').eq('company_id', profile.company_id).order('name');
    if (queryError) setError(`Erro ao carregar indicadores: ${queryError.message}`);
    else setKpis((data || []).map(k => ({ ...k, target: Number(k.target), current: Number(k.current || 0) })));
    setLoading(false);
  }, [profile?.company_id]);
  useEffect(() => { void load(); }, [load]);

  const pct = (k: KPI) => k.target > 0 ? Math.max(0, Math.round(k.current / k.target * 100)) : 0;
  const average = useMemo(() => kpis.length ? Math.round(kpis.reduce((sum, k) => sum + Math.min(pct(k), 100), 0) / kpis.length) : 0, [kpis]);
  const reached = kpis.filter(k => pct(k) >= 100).length;
  const attention = kpis.filter(k => pct(k) < 80).length;
  const powerBi = kpis.find(k => k.powerbi_url)?.powerbi_url;

  const openCreate = () => { setEditing(null); setForm(blank); setError(''); setModal(true); };
  const openEdit = (k: KPI) => { setEditing(k); setForm({ name: k.name, target: String(k.target), current: String(k.current), unit: k.unit || '', category: k.category || '', period: k.period || '', powerbi_url: k.powerbi_url || '' }); setError(''); setModal(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!profile?.company_id || !canManage) return;
    const target = Number(form.target), current = Number(form.current), url = form.powerbi_url.trim();
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) { setError('Informe nome, meta maior que zero e valor atual válido.'); return; }
    if (url) { try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('powerbi.com')) throw new Error(); } catch { setError('Use uma URL HTTPS do domínio powerbi.com.'); return; } }
    setSaving(true); setError('');
    const payload = { company_id: profile.company_id, name: form.name.trim(), target, current, unit: form.unit.trim(), category: form.category.trim(), period: form.period.trim(), powerbi_url: url || null, updated_at: new Date().toISOString() };
    const result = editing ? await supabase.from('kpis').update(payload).eq('id', editing.id).eq('company_id', profile.company_id) : await supabase.from('kpis').insert(payload);
    setSaving(false); if (result.error) { setError(`Erro ao salvar: ${result.error.message}`); return; }
    setModal(false); await load();
  };
  const remove = async (k: KPI) => {
    if (!profile?.company_id || !canManage || !confirm(`Excluir o indicador “${k.name}”?`)) return;
    const { error: deleteError } = await supabase.from('kpis').delete().eq('id', k.id).eq('company_id', profile.company_id);
    if (deleteError) setError(`Erro ao excluir: ${deleteError.message}`); else await load();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando indicadores...</div>;
  return <div className="mx-auto max-w-6xl space-y-7 p-4">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Indicadores (KPIs)</h1><p className="mt-2 text-gray-500">Metas e resultados da sua empresa.</p></div>{canManage && <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 font-bold text-white"><PlusIcon className="h-5 w-5"/>Novo indicador</button>}</header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {!kpis.length ? <div className="rounded-3xl border border-dashed bg-white p-16 text-center"><ChartBarIcon className="mx-auto h-12 w-12 text-gray-300"/><h2 className="mt-4 text-lg font-bold">Nenhum indicador cadastrado</h2><p className="mt-2 text-sm text-gray-500">{canManage ? 'Crie o primeiro KPI da empresa.' : 'Os administradores ainda não publicaram indicadores.'}</p></div> : <>
      <div className="grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-brand-primary p-6 text-white"><p>Progresso médio</p><b className="text-4xl">{average}%</b></div><div className="rounded-3xl border bg-white p-6"><p className="text-gray-500">Metas atingidas</p><b className="text-4xl text-green-600">{reached}</b></div><div className="rounded-3xl border bg-white p-6"><p className="text-gray-500">Precisam de atenção</p><b className="text-4xl text-amber-500">{attention}</b></div></div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{kpis.map(k => <div key={k.id} className="relative rounded-3xl border bg-white p-6 shadow-sm">{canManage && <div className="absolute right-3 top-3 flex"><button onClick={() => openEdit(k)} className="p-2"><PencilSquareIcon className="h-4 w-4"/></button><button onClick={() => void remove(k)} className="p-2 text-red-500"><TrashIcon className="h-4 w-4"/></button></div>}<ChartBarIcon className="mb-3 h-6 w-6 text-brand-primary"/><small className="font-bold uppercase text-gray-400">{k.category || 'Geral'}</small><h3 className="pr-12 font-bold">{k.name}</h3><p className="mt-4 text-2xl font-black">{k.current}{k.unit} <span className="text-xs font-normal text-gray-400">/ {k.target}{k.unit}</span></p><div className="mt-4 h-2 overflow-hidden rounded bg-gray-100"><div className="h-full bg-brand-primary" style={{width:`${Math.min(pct(k),100)}%`}}/></div><div className="mt-2 flex justify-between text-xs text-gray-400"><span>{k.period || 'Sem período'}</span><b>{pct(k)}%</b></div></div>)}</div>
      <div className="overflow-hidden rounded-3xl border bg-white"><h3 className="border-b p-5 font-bold">Análise detalhada</h3>{powerBi ? <iframe title="Dashboard Power BI" src={powerBi} className="h-[450px] w-full" allowFullScreen/> : <p className="p-16 text-center text-gray-400">Nenhum dashboard Power BI vinculado.</p>}</div>
    </>}
    {modal && <ModalPortal className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md pandanet-modal-viewport" onClick={() => setModal(false)}><form onSubmit={save} onClick={e => e.stopPropagation()} className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl"><div className="flex items-center justify-between bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-5 text-white"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">Performance corporativa</p><h2 className="mt-1 text-xl font-black">{editing?'Editar':'Novo'} indicador</h2></div><button type="button" onClick={() => setModal(false)} className="rounded-xl bg-white/10 p-2 hover:bg-white/20"><XMarkIcon className="h-6 w-6"/></button></div><div className="max-h-[72vh] space-y-5 overflow-y-auto p-6"><label className="block text-sm font-bold text-slate-700">Nome do indicador<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Taxa de conversão" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/></label><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Meta<input required type="number" min="0.01" step="any" value={form.target} onChange={e=>setForm({...form,target:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5"/></label><label className="text-sm font-bold text-slate-700">Valor atual<input required type="number" min="0" step="any" value={form.current} onChange={e=>setForm({...form,current:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5"/></label></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{(['unit','period'] as const).map(field=><label key={field} className="text-sm font-bold text-slate-700">{{unit:'Unidade',period:'Período'}[field]}<input value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5"/></label>)}</div>{(['category','powerbi_url'] as const).map(field=><label key={field} className="block text-sm font-bold text-slate-700">{{category:'Categoria',powerbi_url:'URL do Power BI (opcional)'}[field]}<input value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5"/></label>)}{error&&<p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}</div><div className="flex justify-end gap-3 border-t bg-slate-50 px-6 py-4"><button type="button" onClick={()=>setModal(false)} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200">Cancelar</button><button disabled={saving} className="rounded-xl bg-brand-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50">{saving?'Salvando...':'Salvar indicador'}</button></div></form></ModalPortal>}
  </div>;
};
export default KPIDashboard;
