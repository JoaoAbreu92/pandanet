import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { WhatsAppConversationWithDetails } from '../../types';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { MessageCircle, Clock, User, CheckCheck, Smartphone, Instagram, Send } from 'lucide-react';

interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  order_index: number;
}

interface KanbanBoardProps {
  conversations: WhatsAppConversationWithDetails[];
  onOpenChat: (conversation: WhatsAppConversationWithDetails) => void;
  companyId: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ conversations, onOpenChat, companyId }) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchColumns();
  }, [companyId]);

  const fetchColumns = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_kanban_columns')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (!error && data) {
      setColumns(data);
    }
    setLoading(false);
  };

  const createDefaultColumns = async () => {
    const defaultCols = [
      { name: 'Novos Contatos', color: '#3B82F6', order_index: 0, company_id: companyId },
      { name: 'Em Atendimento', color: '#F59E0B', order_index: 1, company_id: companyId },
      { name: 'Aguardando Cliente', color: '#8B5CF6', order_index: 2, company_id: companyId },
      { name: 'Resolvido', color: '#10B981', order_index: 3, company_id: companyId }
    ];
    await supabase.from('whatsapp_kanban_columns').insert(defaultCols);
    fetchColumns();
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newColumnId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
    
    // Optimistic UI update could be handled by parent, but since we rely on Realtime mostly,
    // we'll just fire the Supabase query. The real-time update in Chat.tsx will refresh the props.
    await supabase
      .from('whatsapp_conversations')
      .update({ kanban_column_id: newColumnId })
      .eq('id', draggableId);
  };

  // Group conversations
  const groupedConversations = columns.reduce((acc, col) => {
    acc[col.id] = conversations.filter(c => c.kanban_column_id === col.id);
    return acc;
  }, {} as Record<string, WhatsAppConversationWithDetails[]>);

  const unassignedConversations = conversations.filter(c => !c.kanban_column_id);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center p-8 text-gray-400 font-bold uppercase tracking-widest text-xs">Carregando Quadro...</div>;
  }

  if (columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-transparent">
        <div className="bg-white dark:bg-slate-900/60 p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 text-center max-w-lg">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Quadro Kanban Vazio</h2>
          <p className="text-sm text-gray-500 mb-8 opacity-80 leading-relaxed text-balance">
            Você ainda não criou os estágios (colunas) para organizar suas conversas. Crie as colunas padrão agora ou vá em Configurações &gt; Estágios Kanban para personalizar.
          </p>
          <button 
            onClick={createDefaultColumns}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-xs uppercase tracking-widest"
          >
            Criar Colunas Padrão
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden bg-slate-50/50 dark:bg-transparent p-6">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 h-full overflow-x-auto pb-4 custom-scrollbar items-start">
          
          {/* Unassigned / Caixa de Entrada Column */}
          <div className="flex-shrink-0 w-80 max-h-full flex flex-col bg-white/60 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-black/20 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-widest">Caixa de Entrada</h3>
              <span className="bg-white dark:bg-white/10 text-slate-600 dark:text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                {unassignedConversations.length}
              </span>
            </div>
            
            <Droppable droppableId="unassigned">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/50 dark:bg-white/5' : ''}`}
                >
                  {unassignedConversations.map((conv, index) => (
                    <KanbanCard key={conv.id} conversation={conv} index={index} onClick={() => onOpenChat(conv)} />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Custom Columns */}
          {columns.map(col => (
            <div key={col.id} className="flex-shrink-0 w-80 max-h-full flex flex-col bg-white/60 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div 
                className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-black/20 flex justify-between items-center bg-opacity-10" 
                style={{ borderTop: `4px solid ${col.color}` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: col.color }} />
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-widest">{col.name}</h3>
                </div>
                <span className="bg-white dark:bg-white/10 text-slate-600 dark:text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {groupedConversations[col.id]?.length || 0}
                </span>
              </div>
              
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/50 dark:bg-white/5' : ''}`}
                  >
                    {groupedConversations[col.id]?.map((conv, index) => (
                      <KanbanCard key={conv.id} conversation={conv} index={index} onClick={() => onOpenChat(conv)} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
          <div className="w-4 flex-shrink-0" /> {/* Spacer */}
        </div>
      </DragDropContext>
    </div>
  );
};

// Subcomponent for the Card
const KanbanCard = ({ conversation: conv, index, onClick }: { conversation: WhatsAppConversationWithDetails, index: number, onClick: () => void }) => {
  return (
    <Draggable draggableId={conv.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`p-4 bg-white dark:bg-slate-800 rounded-2xl border ${
            snapshot.isDragging 
              ? 'border-emerald-500 shadow-2xl scale-105 z-50 ring-4 ring-emerald-500/20' 
              : 'border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:-translate-y-1'
          } transition-all duration-200 cursor-grab active:cursor-grabbing`}
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative flex-shrink-0">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.contact_name || conv.contact_phone || 'User')}&background=random`}
                  className="w-10 h-10 rounded-full border border-slate-100 shadow-sm"
                  alt={conv.contact_name || conv.contact_phone}
                />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-px shadow-sm">
                  {conv.channel?.channel_type === 'instagram' ? <Instagram className="w-3.5 h-3.5 text-pink-500" /> :
                   conv.channel?.channel_type === 'messenger' ? <MessageCircle className="w-3.5 h-3.5 text-blue-500" /> :
                   conv.channel?.channel_type === 'telegram' ? <Send className="w-3.5 h-3.5 text-sky-500" /> :
                   <Smartphone className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
              </div>
              <div className="min-w-0 flex flex-col">
                <h4 className="font-bold text-sm tracking-tight text-slate-800 dark:text-white truncate">{conv.contact_name || conv.contact_phone}</h4>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-bold truncate opacity-80">{conv.contact_phone}</p>
              </div>
            </div>
            {conv.unread_count > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold min-w-[20px] px-1.5 py-0.5 rounded-full text-center shadow-sm flex-shrink-0">
                {conv.unread_count}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
            {conv.assigned_user && (
              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 truncate max-w-[100px]">
                {conv.assigned_user.full_name.split(' ')[0]}
              </span>
            )}
            {conv.department && (
              <span className="text-[9px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-500/20 truncate max-w-[100px]">
                {conv.department.name}
              </span>
            )}
            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest ml-auto opacity-70">
              <Clock className="w-3 h-3" />
              {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default KanbanBoard;
