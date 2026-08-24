import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import { 
  Plus, Calendar, Clock, Play, Pause, Trash2, Send, 
  Sparkles, CheckCircle2, AlertCircle, Loader2, X, Users, Image as ImageIcon,
  Video, Search
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  template_1: string;
  template_2: string | null;
  template_3: string | null;
  template_4: string | null;
  image_url: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  interval_seconds: number;
  status: 'pending' | 'running' | 'completed' | 'paused';
  created_at: string;
}

interface TargetStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

const Scheduler: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const activeProfile = currentUser || profile;
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, TargetStats>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phonesText, setPhonesText] = useState('');
  const [template1, setTemplate1] = useState('');
  const [template2, setTemplate2] = useState('');
  const [template3, setTemplate3] = useState('');
  const [template4, setTemplate4] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [intervalSeconds, setIntervalSeconds] = useState(30);

  // Mídia de Upload
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Modal da Agenda
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);
  const [agendaContacts, setAgendaContacts] = useState<{ name: string; phone: string }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [dddFilter, setDddFilter] = useState('');
  const [searchContact, setSearchContact] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});

  const fetchAgendaContacts = async () => {
    const companyId = activeProfile?.company_id;
    if (!companyId) return;

    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('contact_name, contact_phone')
        .eq('company_id', companyId)
        .not('contact_phone', 'is', null);

      if (error) throw error;

      if (data) {
        const uniqueMap = new Map<string, string>();
        data.forEach(c => {
          const cleanPhone = c.contact_phone.replace(/\D/g, '');
          if (cleanPhone && cleanPhone.length >= 8) {
            const existingName = uniqueMap.get(cleanPhone);
            if (!existingName || (!existingName.startsWith('+') && c.contact_name)) {
              uniqueMap.set(cleanPhone, c.contact_name || `+${cleanPhone}`);
            }
          }
        });

        const contactsList = Array.from(uniqueMap.entries()).map(([phone, name]) => ({
          name,
          phone
        }));

        contactsList.sort((a, b) => a.name.localeCompare(b.name));
        setAgendaContacts(contactsList);
      }
    } catch (err) {
      console.error('[AGENDA] Erro ao carregar contatos:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (isAgendaOpen) {
      fetchAgendaContacts();
    }
  }, [isAgendaOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMediaFile(null);
      setMediaType(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 10MB.');
        e.target.value = '';
        return;
      }
      setMediaFile(file);
      setMediaType('image');
      setImageUrl(''); // Limpar URL direta
    } else if (file.type.startsWith('video/')) {
      if (file.size > 50 * 1024 * 1024) {
        alert('O vídeo deve ter no máximo 50MB.');
        e.target.value = '';
        return;
      }
      setMediaFile(file);
      setMediaType('video');
      setImageUrl(''); // Limpar URL direta
    } else {
      alert('Apenas arquivos de imagem ou vídeo são permitidos.');
      e.target.value = '';
    }
  };

  const filteredContacts = agendaContacts.filter(contact => {
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchContact.toLowerCase()) ||
      contact.phone.includes(searchContact);

    let matchesDDD = true;
    if (dddFilter.trim() !== '') {
      const cleanPhone = contact.phone.replace(/\D/g, '');
      let contactDDD = '';
      if (cleanPhone.startsWith('55') && cleanPhone.length >= 4) {
        contactDDD = cleanPhone.slice(2, 4);
      } else if (cleanPhone.length >= 2) {
        contactDDD = cleanPhone.slice(0, 2);
      }
      matchesDDD = contactDDD === dddFilter.trim();
    }

    return matchesSearch && matchesDDD;
  });

  const isAllFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedContacts[c.phone]);

  const handleSelectAllFiltered = (checked: boolean) => {
    const newSelected = { ...selectedContacts };
    filteredContacts.forEach(contact => {
      if (checked) {
        newSelected[contact.phone] = true;
      } else {
        delete newSelected[contact.phone];
      }
    });
    setSelectedContacts(newSelected);
  };

  const handleConfirmSelectedContacts = () => {
    const selectedPhones = Object.keys(selectedContacts).filter(phone => selectedContacts[phone]);
    if (selectedPhones.length === 0) {
      alert('Nenhum contato selecionado.');
      return;
    }

    const existingPhones = phonesText
      .split(/[\n,]/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    const allPhones = Array.from(new Set([...existingPhones, ...selectedPhones]));

    setPhonesText(allPhones.join('\n'));
    setIsAgendaOpen(false);
    setSelectedContacts({});
    setSearchContact('');
    setDddFilter('');
  };

  useEffect(() => {
    fetchCampaigns();
  }, [activeProfile?.company_id]);

  const fetchCampaigns = async () => {
    const companyId = activeProfile?.company_id;
    if (!companyId) return;

    setLoading(true);
    try {
      const { data: campaignData, error } = await supabase
        .from('whatsapp_scheduled_campaigns')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (campaignData) {
        setCampaigns(campaignData);
        // Buscar estatísticas de alvos para cada campanha
        const statsMap: Record<string, TargetStats> = {};
        
        await Promise.all(
          campaignData.map(async (camp) => {
            const { data: targets, error: targetErr } = await supabase
              .from('whatsapp_scheduled_targets')
              .select('status')
              .eq('campaign_id', camp.id);
            
            if (!targetErr && targets) {
              const total = targets.length;
              const sent = targets.filter(t => t.status === 'sent').length;
              const failed = targets.filter(t => t.status === 'failed').length;
              const pending = targets.filter(t => t.status === 'pending').length;
              statsMap[camp.id] = { total, sent, failed, pending };
            }
          })
        );
        
        setCampaignStats(statsMap);
      }
    } catch (err) {
      console.error('[CAMPAIGN] Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = activeProfile?.company_id;
    const userId = activeProfile?.id;
    if (!companyId || !userId) return;

    if (!name.trim() || !template1.trim() || !phonesText.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, Contatos e Mensagem 1).');
      return;
    }

    // Processar telefones
    const phones = phonesText
      .split(/[\n,]/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    if (phones.length === 0) {
      alert('Por favor, insira pelo menos um número de telefone válido com DDI e DDD (ex: 5541999999999).');
      return;
    }

    setActionLoading('create');
    let finalImageUrl = imageUrl.trim() || null;
    let finalMediaType = mediaType || 'image';

    try {
      if (mediaFile) {
        setUploadingMedia(true);
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `campaigns/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('chat-media')
          .upload(fileName, mediaFile);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('chat-media')
          .getPublicUrl(fileName);

        finalImageUrl = urlData.publicUrl;
      }

      // 1. Criar a campanha
      const { data: newCampaign, error: campaignErr } = await supabase
        .from('whatsapp_scheduled_campaigns')
        .insert({
          company_id: companyId,
          name: name.trim(),
          template_1: template1.trim(),
          template_2: template2.trim() || null,
          template_3: template3.trim() || null,
          template_4: template4.trim() || null,
          image_url: finalImageUrl,
          media_type: finalMediaType,
          scheduled_date: scheduledDate,
          start_time: startTime + ':00',
          end_time: endTime + ':00',
          interval_seconds: intervalSeconds,
          status: 'pending',
          created_by: userId
        })
        .select()
        .single();

      if (campaignErr) throw campaignErr;

      // 2. Criar os alvos (targets)
      if (newCampaign) {
        const targetInserts = phones.map(phone => ({
          campaign_id: newCampaign.id,
          contact_phone: phone,
          status: 'pending'
        }));

        const { error: targetErr } = await supabase
          .from('whatsapp_scheduled_targets')
          .insert(targetInserts);

        if (targetErr) throw targetErr;

        // Resetar formulário
        setName('');
        setPhonesText('');
        setTemplate1('');
        setTemplate2('');
        setTemplate3('');
        setTemplate4('');
        setImageUrl('');
        setMediaFile(null);
        setMediaType(null);
        setScheduledDate(new Date().toISOString().split('T')[0]);
        setStartTime('08:00');
        setEndTime('18:00');
        setIntervalSeconds(30);
        
        setIsModalOpen(false);
        fetchCampaigns();
      }
    } catch (err: any) {
      console.error('[CAMPAIGN-CREATE] Erro:', err);
      alert('Erro ao criar campanha: ' + err.message);
    } finally {
      setActionLoading(null);
      setUploadingMedia(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'running' | 'paused') => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('whatsapp_scheduled_campaigns')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      fetchCampaigns();
    } catch (err: any) {
      console.error('[CAMPAIGN-UPDATE] Erro:', err);
      alert('Erro ao atualizar status da campanha: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta campanha e todos os seus agendamentos?')) return;
    
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('whatsapp_scheduled_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchCampaigns();
    } catch (err: any) {
      console.error('[CAMPAIGN-DELETE] Erro:', err);
      alert('Erro ao excluir campanha: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pendente</span>;
      case 'running':
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Disparando</span>;
      case 'completed':
        return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Concluída</span>;
      case 'paused':
        return <span className="bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pausada</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-500 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-8 h-8 text-emerald-500" /> Disparador de Mensagens
          </h2>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 opacity-70 mt-1">Crie e programe campanhas de disparo em massa com variação aleatória.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-6 py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Buscando campanhas agendadas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {campaigns.map((camp) => {
            const stats = campaignStats[camp.id] || { total: 0, sent: 0, failed: 0, pending: 0 };
            const pct = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
            
            return (
              <div 
                key={camp.id} 
                className="bg-white dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row justify-between md:items-center gap-6"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[280px]">{camp.name}</h3>
                    {getStatusBadge(camp.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400 font-semibold opacity-85 mt-2">
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> {camp.scheduled_date}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> {camp.start_time.slice(0,5)} até {camp.end_time.slice(0,5)}</span>
                    <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-slate-400" /> Intervalo: {camp.interval_seconds}s</span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1.5">
                      <span>Progresso dos envios: {stats.sent} / {stats.total}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    {stats.failed > 0 && (
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {stats.failed} envio(s) com erro.
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações da Campanha */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {camp.status === 'pending' || camp.status === 'paused' ? (
                    <button
                      onClick={() => handleUpdateStatus(camp.id, 'running')}
                      disabled={actionLoading === camp.id}
                      className="p-3 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all font-bold text-xs"
                      title="Iniciar Disparos"
                    >
                      <Play className="w-4 h-4 text-emerald-500 hover:text-inherit fill-emerald-500 hover:fill-inherit shrink-0" />
                    </button>
                  ) : camp.status === 'running' ? (
                    <button
                      onClick={() => handleUpdateStatus(camp.id, 'paused')}
                      disabled={actionLoading === camp.id}
                      className="p-3 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl transition-all font-bold text-xs"
                      title="Pausar Disparos"
                    >
                      <Pause className="w-4 h-4 shrink-0" />
                    </button>
                  ) : null}

                  <button
                    onClick={() => handleDeleteCampaign(camp.id)}
                    disabled={actionLoading === camp.id}
                    className="p-3 bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all font-bold text-xs"
                    title="Excluir Campanha"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            );
          })}

          {campaigns.length === 0 && (
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-dashed border-gray-200 dark:border-white/10 rounded-[2.5rem] p-20 flex flex-col items-center text-center shadow-xl">
              <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Nenhuma campanha criada</h3>
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-2 opacity-65 uppercase tracking-wider">Crie uma nova campanha e selecione os alvos para disparar suas mensagens em massa de forma inteligente.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal - Criar Campanha */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-500">
          <form onSubmit={handleCreateCampaign} className="bg-white dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-white/5 animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Criar Nova Campanha</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-150 dark:hover:bg-white/10 rounded-2xl transition-all">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lado Esquerdo: Metadados */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Nome da Campanha *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium text-sm"
                      placeholder="Ex: Campanha Black Friday Vendas"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Lista de Contatos (Telefones) *</span>
                      <button
                        type="button"
                        onClick={() => setIsAgendaOpen(true)}
                        className="text-[9px] text-emerald-500 hover:text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-xl transition-all"
                      >
                        <Users className="w-3.5 h-3.5" /> Agenda do WhatsPanda
                      </button>
                    </label>
                    <textarea
                      required
                      value={phonesText}
                      onChange={(e) => setPhonesText(e.target.value)}
                      rows={4}
                      className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium text-xs placeholder:text-gray-400"
                      placeholder={`5541999999999\n5511988888888\n5521977777777`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Data Agendada *</label>
                      <input
                        type="date"
                        required
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-semibold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Intervalo (Segundos)</label>
                      <input
                        type="number"
                        min={10}
                        max={600}
                        value={intervalSeconds}
                        onChange={(e) => setIntervalSeconds(parseInt(e.target.value))}
                        className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-semibold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hora Inicial de Envio *</label>
                      <input
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-semibold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hora Limite de Envio *</label>
                      <input
                        type="time"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-semibold text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 bg-gray-50 dark:bg-white/5 p-4 rounded-3xl border border-gray-100 dark:border-white/5">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Mídia da Campanha (Imagem ou Vídeo)
                    </label>
                    
                    <div>
                      <span className="block text-[9px] text-gray-400 dark:text-gray-400 font-bold mb-1.5 uppercase">Opção A: Upload de arquivo local</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        disabled={uploadingMedia}
                        className="w-full text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-500 hover:file:bg-emerald-500/20 file:transition-all cursor-pointer"
                      />
                      <span className="block text-[9px] text-gray-400 dark:text-gray-500 mt-1 font-medium">Imagem: máx 10MB | Vídeo: máx 50MB</span>
                    </div>

                    {mediaFile && (
                      <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-2xl">
                        <div className="flex items-center gap-2">
                          {mediaType === 'image' ? <ImageIcon className="w-4 h-4 text-emerald-500" /> : <Video className="w-4 h-4 text-emerald-500" />}
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{mediaFile.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setMediaFile(null); setMediaType(null); }}
                          className="text-[10px] text-red-500 font-bold uppercase tracking-wider hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    )}

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-gray-250 dark:border-white/10"></div>
                      <span className="flex-shrink mx-4 text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">OU</span>
                      <div className="flex-grow border-t border-gray-250 dark:border-white/10"></div>
                    </div>

                    <div>
                      <span className="block text-[9px] text-gray-400 dark:text-gray-400 font-bold mb-1.5 uppercase">Opção B: URL direta da mídia</span>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          if (e.target.value) {
                            setMediaFile(null);
                            setMediaType(null);
                          }
                        }}
                        disabled={!!mediaFile}
                        className="w-full px-4 py-2.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-medium text-xs placeholder:text-gray-400"
                        placeholder="https://sua-midia.com/arquivo.mp4 ou .png"
                      />
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Templates de Mensagens */}
                <div className="space-y-4">
                  <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-3xl mb-2 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Rotação Inteligente</h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                        Cadastre até 4 variações da mensagem. O robô irá escolher um modelo de forma aleatória para cada contato para simular comportamento humano e evitar banimentos do WhatsApp.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider mb-2">Mensagem Modelo 1 *</label>
                    <textarea
                      required
                      value={template1}
                      onChange={(e) => setTemplate1(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all font-medium text-xs placeholder:text-gray-400"
                      placeholder="Primeira variação do seu text..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mensagem Modelo 2 (Opcional)</label>
                    <textarea
                      value={template2}
                      onChange={(e) => setTemplate2(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all font-medium text-xs placeholder:text-gray-400"
                      placeholder="Segunda variação..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mensagem Modelo 3 (Opcional)</label>
                    <textarea
                      value={template3}
                      onChange={(e) => setTemplate3(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all font-medium text-xs placeholder:text-gray-400"
                      placeholder="Terceira variação..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mensagem Modelo 4 (Opcional)</label>
                    <textarea
                      value={template4}
                      onChange={(e) => setTemplate4(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all font-medium text-xs placeholder:text-gray-400"
                      placeholder="Quarta variação..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-8 py-3.5 text-xs font-bold text-gray-650 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl transition-all uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={actionLoading === 'create'}
                className="px-10 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 flex items-center justify-center"
              >
                {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Agendar Disparos
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal - Agenda do WhatsPanda */}
      {isAgendaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 dark:border-white/5">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Users className="w-6 h-6 text-emerald-500" /> Agenda WhatsPanda
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-widest mt-1 opacity-70">
                  Selecione os contatos das conversas existentes.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsAgendaOpen(false); setSelectedContacts({}); setSearchContact(''); setDddFilter(''); }} 
                className="p-2 hover:bg-gray-150 dark:hover:bg-white/10 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Filtros */}
            <div className="p-5 bg-slate-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou telefone..."
                  value={searchContact}
                  onChange={(e) => setSearchContact(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-transparent rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Filtro DDD (ex: 41)"
                  value={dddFilter}
                  onChange={(e) => setDddFilter(e.target.value.replace(/\D/g, ''))}
                  maxLength={3}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-transparent rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 dark:text-white text-center"
                />
              </div>
            </div>

            {/* Listagem */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2 max-h-[45vh]">
              {loadingContacts ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Carregando contatos...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-center">
                  <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Nenhum contato encontrado</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">Tente ajustar a busca ou o DDD.</p>
                </div>
              ) : (
                <>
                  {/* Cabeçalho "Selecionar Todos" */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 mb-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={(e) => handleSelectAllFiltered(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-gray-300 dark:border-white/10 text-emerald-500 focus:ring-emerald-500/20 transition-all cursor-pointer"
                      />
                      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        Selecionar Todos ({filteredContacts.length} contatos filtrados)
                      </span>
                    </label>
                    <span className="text-[10px] text-emerald-500 font-bold uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {Object.values(selectedContacts).filter(Boolean).length} marcados
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {filteredContacts.map(c => {
                      const isSelected = !!selectedContacts[c.phone];
                      return (
                        <div 
                          key={c.phone} 
                          className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-200 ${
                            isSelected 
                              ? 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-500/10' 
                              : 'bg-white dark:bg-slate-900/40 border-gray-100 dark:border-white/5 hover:border-gray-250 dark:hover:border-white/10'
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1 select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSelected = { ...selectedContacts };
                                if (e.target.checked) {
                                  newSelected[c.phone] = true;
                                } else {
                                  delete newSelected[c.phone];
                                }
                                setSelectedContacts(newSelected);
                              }}
                              className="w-4.5 h-4.5 rounded border-gray-300 dark:border-white/10 text-emerald-500 focus:ring-emerald-500/20 transition-all cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{c.name}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold mt-0.5">{c.phone}</p>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Ações */}
            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setIsAgendaOpen(false); setSelectedContacts({}); setSearchContact(''); setDddFilter(''); }}
                className="px-6 py-3 text-xs font-bold text-gray-650 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl transition-all uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSelectedContacts}
                disabled={Object.values(selectedContacts).filter(Boolean).length === 0}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20"
              >
                Importar Contatos ({Object.values(selectedContacts).filter(Boolean).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scheduler;
