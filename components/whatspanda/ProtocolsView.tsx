import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle, 
  ExternalLink,
  Filter
} from 'lucide-react';

interface ProtocolsViewProps {
  onSelectConversation?: (conversationId: string) => void;
}

export const ProtocolsView: React.FC<ProtocolsViewProps> = ({ onSelectConversation }) => {
  const { profile } = useAuth();
  const [protocols, setProtocols] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchProtocols = async () => {
    const companyId = profile?.company_id;
    if (!companyId) return;

    setLoading(true);
    try {
      // 1. Fetch company agents
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', companyId);
      if (profilesData) setAgents(profilesData);

      // 2. Fetch conversations with protocols
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          assigned_user:profiles!assigned_to(id, full_name),
          queue:whatsapp_queues!queue_id(id, name, color)
        `)
        .eq('company_id', companyId)
        .not('protocol_number', 'is', null)
        .order('protocol_created_at', { ascending: false });

      if (error) throw error;
      setProtocols(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar protocolos:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtocols();
  }, [profile?.company_id]);

  // Filtered protocols calculation
  const filteredProtocols = protocols.filter(item => {
    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchProtocol = item.protocol_number?.toLowerCase().includes(q);
      const matchClient = (item.contact_name || '').toLowerCase().includes(q) || (item.contact_phone || '').includes(q);
      const matchAgent = item.assigned_user?.full_name?.toLowerCase().includes(q);
      if (!matchProtocol && !matchClient && !matchAgent) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }

    // Agent filter
    if (agentFilter !== 'all' && item.assigned_to !== agentFilter) {
      return false;
    }

    // Date range filter
    if (startDate) {
      const itemDate = new Date(item.protocol_created_at || item.created_at).toISOString().slice(0, 10);
      if (itemDate < startDate) return false;
    }
    if (endDate) {
      const itemDate = new Date(item.protocol_created_at || item.created_at).toISOString().slice(0, 10);
      if (itemDate > endDate) return false;
    }

    return true;
  });

  // Metrics
  const totalCount = protocols.length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = protocols.filter(p => (p.protocol_created_at || p.created_at)?.startsWith(todayStr)).length;
  const openCount = protocols.filter(p => p.status === 'aberto' || p.status === 'open').length;
  const closedCount = protocols.filter(p => p.status === 'fechado' || p.status === 'closed').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col font-sans overflow-y-auto custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
              Protocolos de Atendimento
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-gray-400 mt-1">
            Histórico completo e consulta de todos os números de protocolo gerados na empresa.
          </p>
        </div>
        <button
          onClick={fetchProtocols}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Lista</span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total de Protocolos</span>
            <FileText className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{totalCount}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Gerados Hoje</span>
            <Calendar className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{todayCount}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Em Atendimento</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{openCount}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Encerrados</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{closedCount}</p>
        </div>
      </div>

      {/* Filter Options */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm mb-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtros de Pesquisa</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por protocolo, cliente ou telefone..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
            >
              <option value="all">Todos os Status</option>
              <option value="aberto">Em Atendimento (Aberto)</option>
              <option value="fechado">Encerrado (Fechado)</option>
              <option value="pendente">Aguardando (Pendente)</option>
            </select>
          </div>

          {/* Agent filter */}
          <div>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
            >
              <option value="all">Todos os Atendentes</option>
              {agents.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.full_name}</option>
              ))}
            </select>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[11px] text-slate-800 dark:text-white outline-none"
              title="Data inicial"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[11px] text-slate-800 dark:text-white outline-none"
              title="Data final"
            />
          </div>
        </div>
      </div>

      {/* Protocols Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="p-4">Protocolo</th>
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Atendente</th>
                <th className="p-4">Setor / Fila</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    Carregando protocolos...
                  </td>
                </tr>
              ) : filteredProtocols.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-sm">Nenhum protocolo encontrado</p>
                    <p className="text-xs opacity-70 mt-1">Tente ajustar os termos da pesquisa ou filtros acima.</p>
                  </td>
                </tr>
              ) : (
                filteredProtocols.map(item => {
                  const createdAt = new Date(item.protocol_created_at || item.created_at);
                  const isClosed = item.status === 'fechado' || item.status === 'closed';
                  const isOpen = item.status === 'aberto' || item.status === 'open';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold rounded-lg border border-emerald-500/20 text-xs">
                          {item.protocol_number}
                        </span>
                      </td>

                      <td className="p-4 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {createdAt.toLocaleDateString('pt-BR')} às {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-4">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{item.contact_name || item.contact_phone}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.contact_phone}</p>
                        </div>
                      </td>

                      <td className="p-4 font-medium">
                        {item.assigned_user ? (
                          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                            <User className="w-3.5 h-3.5" />
                            {item.assigned_user.full_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Não atribuído</span>
                        )}
                      </td>

                      <td className="p-4">
                        {item.queue ? (
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                            style={{
                              backgroundColor: `${item.queue.color}15`,
                              color: item.queue.color,
                              borderColor: `${item.queue.color}30`
                            }}
                          >
                            {item.queue.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Geral</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isClosed 
                            ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' 
                            : isOpen 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {isClosed ? 'Fechado' : isOpen ? 'Em Atendimento' : 'Pendente'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        {onSelectConversation && (
                          <button
                            onClick={() => onSelectConversation(item.id)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-all inline-flex items-center gap-1.5"
                          >
                            <span>Ver Chat</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProtocolsView;
