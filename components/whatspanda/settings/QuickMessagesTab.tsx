import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../AuthContext';
import {
  Plus, Edit2, Trash2, Shield, Eye, EyeOff, Loader2, Save, X, Search
} from 'lucide-react';

interface QuickMessage {
  id: string;
  company_id: string;
  shortcut: string;
  message: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  shared_with?: string[];
  creator?: {
    full_name: string;
  };
}

const QuickMessagesTab: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const activeProfile = currentUser || profile;
  const userId = activeProfile?.id;
  const companyId = activeProfile?.company_id;

  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [shareWithSpecific, setShareWithSpecific] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchQuickMessages();
    fetchAgents();
  }, [companyId, userId]);

  const fetchAgents = async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .order('full_name', { ascending: true });
      if (!error) {
        setAgents(data || []);
      }
    } catch (err) {
      console.error('[QUICK-MSG] Erro ao carregar agentes:', err);
    }
  };

  const fetchQuickMessages = async () => {
    if (!companyId || !userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_quick_messages')
        .select('*, creator:profiles(full_name)')
        .eq('company_id', companyId)
        .or(`is_public.eq.true,created_by.eq.${userId},shared_with.cs.{${userId}}`)
        .order('shortcut', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('[QUICK-MSG] Erro ao carregar mensagens:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !userId) return;

    const cleanShortcut = shortcut.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanShortcut || !messageText.trim()) {
      alert('Preencha o atalho e o texto da mensagem.');
      return;
    }

    // Validar se o atalho já existe (evitar duplicados para o mesmo escopo)
    const exists = messages.some(
      m => m.shortcut === cleanShortcut && m.id !== editId && (m.is_public || m.created_by === userId)
    );
    if (exists) {
      alert(`O atalho "/${cleanShortcut}" já está cadastrado.`);
      return;
    }

    const shared = isPublic ? [] : (shareWithSpecific ? selectedAgents : []);

    setActionLoading(true);
    try {
      if (editId) {
        // Atualizar
        const { error } = await supabase
          .from('whatsapp_quick_messages')
          .update({
            shortcut: cleanShortcut,
            message: messageText.trim(),
            is_public: isPublic,
            shared_with: shared
          })
          .eq('id', editId);

        if (error) throw error;
      } else {
        // Inserir novo
        const { error } = await supabase
          .from('whatsapp_quick_messages')
          .insert({
            company_id: companyId,
            shortcut: cleanShortcut,
            message: messageText.trim(),
            is_public: isPublic,
            created_by: userId,
            shared_with: shared
          });

        if (error) throw error;
      }

      // Reset
      setShortcut('');
      setMessageText('');
      setIsPublic(true);
      setShareWithSpecific(false);
      setSelectedAgents([]);
      setEditId(null);
      setIsEditing(false);
      fetchQuickMessages();
    } catch (err: any) {
      console.error('[QUICK-MSG-SAVE] Erro:', err);
      alert('Erro ao salvar mensagem rápida: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (msg: QuickMessage) => {
    setEditId(msg.id);
    setShortcut(msg.shortcut);
    setMessageText(msg.message);
    setIsPublic(msg.is_public);
    const shared = msg.shared_with || [];
    setSelectedAgents(shared);
    setShareWithSpecific(!msg.is_public && shared.length > 0);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta mensagem rápida?')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_quick_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchQuickMessages();
    } catch (err: any) {
      console.error('[QUICK-MSG-DELETE] Erro:', err);
      alert('Erro ao excluir mensagem rápida: ' + err.message);
    }
  };

  const filteredMessages = messages.filter(
    m => m.shortcut.includes(searchTerm.toLowerCase()) || m.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-4">
      {/* Formulário lateral */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            {editId ? 'Editar Atalho' : 'Cadastrar Atalho'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Atalho *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-sm">/</span>
                <input
                  type="text"
                  required
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-semibold text-sm"
                  placeholder="ex: pix, boasvindas, endereco"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Texto Completo da Mensagem *
              </label>
              <textarea
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium text-xs"
                placeholder="Insira o texto completo que será disparado ao usar o atalho..."
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
              <div>
                <h4 className="text-[10px] font-bold text-gray-700 dark:text-white uppercase tracking-wider">Atalho Público</h4>
                <p className="text-[9px] text-gray-400 font-medium mt-0.5">Se ativo, todos os consultores podem usar.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPublic(!isPublic);
                  if (isPublic) {
                    setShareWithSpecific(false);
                    setSelectedAgents([]);
                  }
                }}
                className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${isPublic ? 'bg-emerald-500 flex justify-end' : 'bg-slate-350 dark:bg-slate-600 flex justify-start'
                  }`}
              >
                <span className="w-4.5 h-4.5 bg-white rounded-full shadow-md" />
              </button>
            </div>

            {!isPublic && (
              <>
                <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-700 dark:text-white uppercase tracking-wider">Compartilhar Específico</h4>
                    <p className="text-[9px] text-gray-400 font-medium mt-0.5">Selecione usuários específicos para visualizar o atalho.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareWithSpecific(!shareWithSpecific)}
                    className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${shareWithSpecific ? 'bg-emerald-500 flex justify-end' : 'bg-slate-350 dark:bg-slate-600 flex justify-start'
                      }`}
                  >
                    <span className="w-4.5 h-4.5 bg-white rounded-full shadow-md" />
                  </button>
                </div>

                {shareWithSpecific && (
                  <div className="p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Usuários Disponíveis
                    </label>
                    {agents.filter(a => a.id !== userId).length === 0 ? (
                      <p className="text-[10px] text-gray-400 font-medium">Nenhum outro usuário disponível.</p>
                    ) : (
                      agents.filter(a => a.id !== userId).map(agent => (
                        <label key={agent.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedAgents.includes(agent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAgents([...selectedAgents, agent.id]);
                              } else {
                                setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                              }
                            }}
                            className="rounded text-emerald-500 focus:ring-emerald-500 border-gray-300 dark:border-white/10 dark:bg-white/5"
                          />
                          {agent.full_name}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setShortcut('');
                    setMessageText('');
                    setIsPublic(true);
                    setIsEditing(false);
                  }}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all uppercase tracking-widest"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Listagem */}
      <div className="lg:col-span-2 space-y-4">
        {/* Barra de busca */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none focus:outline-none dark:text-white font-medium text-xs placeholder:text-gray-400"
            placeholder="Pesquisar por atalho ou mensagem..."
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Carregando atalhos...</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-white dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 flex justify-between gap-6"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                      /{msg.shortcut}
                    </span>
                    {msg.is_public ? (
                      <span className="flex items-center gap-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
                        <Eye className="w-3 h-3" /> Público
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
                        <EyeOff className="w-3 h-3" /> Privado
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      Criador: {msg.created_by === userId ? 'Você' : (msg.creator?.full_name || 'Desconhecido')}
                    </span>
                    {!msg.is_public && msg.shared_with && msg.shared_with.length > 0 && (
                      <span className="text-[9px] font-medium text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                        Compartilhado com: {msg.shared_with.map(id => agents.find(a => a.id === id)?.full_name?.split(' ')[0]).filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-650 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed mt-1">
                    {msg.message}
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  {msg.created_by === userId ? (
                    <>
                      <button
                        onClick={() => handleEdit(msg)}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500 dark:bg-red-500/20 dark:hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500 hover:text-inherit" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[9px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest self-center opacity-60">
                      Apenas Visualização
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredMessages.length === 0 && (
              <div className="bg-white/30 dark:bg-white/5 p-12 rounded-[2rem] border border-dashed border-gray-200 dark:border-white/5 text-center text-gray-400">
                Nenhum atalho encontrado.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickMessagesTab;
