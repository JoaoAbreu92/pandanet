import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import { Plus, Trash2, Save, MessageSquare, List, UserPlus, Users, Play, Pause } from 'lucide-react';
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ChatbotFlow {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
}

interface ChatbotNode {
    id: string;
    flow_id: string;
    type: 'greeting' | 'menu' | 'transfer_queue' | 'transfer_user' | 'message';
    content: any;
}

const ChatbotSettings: React.FC = () => {
    const { profile, currentUser } = useAuth();
    const [flows, setFlows] = useState<ChatbotFlow[]>([]);
    const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow | null>(null);
    const [nodes, setNodes] = useState<ChatbotNode[]>([]);
    const [queues, setQueues] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [geminiKey, setGeminiKey] = useState('');
    const activeProfile = currentUser || profile;
    const [signature, setSignature] = useState(activeProfile?.whatsapp_signature || '');
    const [useSignature, setUseSignature] = useState(activeProfile?.use_whatsapp_signature || false);

    useEffect(() => {
        fetchData();
    }, [currentUser?.company_id]);

    const fetchData = async () => {
        const companyId = currentUser?.company_id;
        if (!companyId) return;

        const { data: flowsData } = await supabase.from('whatsapp_chatbot_flows').select('*').eq('company_id', companyId);
        const { data: queuesData } = await supabase.from('whatsapp_queues').select('*').eq('company_id', companyId);
        const { data: teamData } = await supabase.from('profiles').select('id, full_name').eq('company_id', companyId);
        const { data: settingsData } = await supabase.from('whatsapp_settings').select('gemini_api_key').eq('company_id', companyId).limit(1).single();

        if (flowsData) setFlows(flowsData);
        if (queuesData) setQueues(queuesData);
        if (teamData) setTeam(teamData);
        if (settingsData) setGeminiKey(settingsData.gemini_api_key || '');
    };

    const fetchNodes = async (flowId: string) => {
        const { data } = await supabase.from('whatsapp_chatbot_nodes').select('*').eq('flow_id', flowId);
        if (data) setNodes(data);
    };

    const handleCreateFlow = async () => {
        const companyId = profile?.company_id;
        if (!companyId) return;

        const { data, error } = await supabase.from('whatsapp_chatbot_flows').insert({
            company_id: companyId,
            name: 'Novo Fluxo',
            is_active: false
        }).select().single();

        if (data) {
            setFlows([...flows, data]);
            setSelectedFlow(data);
            fetchNodes(data.id);
        }
    };

    const handleToggleActive = async (flow: ChatbotFlow) => {
        // Desativar outros fluxos da empresa antes de ativar este
        if (!flow.is_active) {
            await supabase.from('whatsapp_chatbot_flows').update({ is_active: false }).eq('company_id', profile?.company_id);
        }

        const { error } = await supabase.from('whatsapp_chatbot_flows')
            .update({ is_active: !flow.is_active })
            .eq('id', flow.id);

        if (!error) fetchData();
    };

    const handleDeleteFlow = async (flowId: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este fluxo e todos os seus passos?')) return;
        const { error } = await supabase.from('whatsapp_chatbot_flows').delete().eq('id', flowId);
        if (!error) {
            setFlows(flows.filter(f => f.id !== flowId));
            if (selectedFlow?.id === flowId) {
                setSelectedFlow(null);
                setNodes([]);
            }
        }
    };

    const handleAddNode = async (type: ChatbotNode['type']) => {
        if (!selectedFlow) return;

        const content = type === 'menu' ? { text: '', options: [] } : { text: '' };
        
        const { data, error } = await supabase.from('whatsapp_chatbot_nodes').insert({
            flow_id: selectedFlow.id,
            type,
            content
        }).select().single();

        if (data) setNodes([...nodes, data]);
    };

    const handleUpdateNode = async (nodeId: string, content: any) => {
        const { error } = await supabase.from('whatsapp_chatbot_nodes').update({ content }).eq('id', nodeId);
        if (!error) {
            setNodes(nodes.map(n => n.id === nodeId ? { ...n, content } : n));
        }
    };

    const handleSaveGeminiKey = async () => {
        const companyId = profile?.company_id;
        if (!companyId) return;
        setLoading(true);
        await supabase.from('whatsapp_settings').update({ gemini_api_key: geminiKey }).eq('company_id', companyId);
        setLoading(false);
        alert('Configuração salva!');
    };

    const handleSaveSignature = async () => {
        if (!profile?.id) return;
        setLoading(true);
        const { error } = await supabase.from('profiles').update({ 
            whatsapp_signature: signature,
            use_whatsapp_signature: useSignature
        }).eq('id', profile.id);
        setLoading(false);
        if (error) alert('Erro ao salvar assinatura: ' + error.message);
        else alert('Assinatura salva com sucesso!');
    };

    const handleDeleteNode = async (nodeId: string) => {
        const { error } = await supabase.from('whatsapp_chatbot_nodes').delete().eq('id', nodeId);
        if (!error) setNodes(nodes.filter(n => n.id !== nodeId));
    };

    return (
        <div className="space-y-6">
            {/* Global Settings / Gemini Config */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                           <SparklesIcon className="w-5 h-5 text-emerald-500" /> Configuração do Google Gemini
                        </h2>
                        <p className="text-xs text-slate-500">Esta chave é necessária para o bot sugerir transferências inteligentes e analisar conversas.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/20 p-1.5 rounded-xl border border-slate-200 dark:border-white/5 min-w-[300px]">
                        <input 
                            type="password" 
                            placeholder="Insira sua Gemini API Key aqui..."
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm px-3 flex-1"
                        />
                        <button 
                            onClick={handleSaveGeminiKey} 
                            disabled={loading}
                            className={`flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-xs font-bold shadow-md shadow-emerald-500/20 ${loading ? 'opacity-50' : ''}`}
                        >
                            {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Chave
                        </button>
                    </div>
                </div>
            </div>

            {/* User Personal Settings */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                           <MessageSquare className="w-5 h-5 text-emerald-500" /> Minha Assinatura WhatsPanda
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Este texto será anexado automaticamente às suas mensagens enviadas.</p>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Texto da Assinatura</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Att, [Seu Nome]"
                                    value={signature}
                                    onChange={(e) => setSignature(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/5 p-3 rounded-xl outline-none text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="use_signature"
                                    checked={useSignature}
                                    onChange={(e) => setUseSignature(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-500"
                                />
                                <label htmlFor="use_signature" className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">Habilitar assinatura por padrão</label>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button 
                            onClick={handleSaveSignature} 
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-all text-xs font-bold shadow-lg ${loading ? 'opacity-50' : ''}`}
                        >
                            {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Minha Assinatura
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold">Fluxos de Atendimento (Chatbot)</h2>
                    <p className="text-xs text-slate-500">Configure automações e roteamento por IA</p>
                </div>
                <button 
                    onClick={handleCreateFlow}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> Novo Fluxo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Lista de Fluxos */}
                <div className="md:col-span-1 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 font-bold text-xs uppercase text-slate-500">
                        Meus Fluxos
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {flows.map(flow => (
                            <div 
                                key={flow.id}
                                onClick={() => { setSelectedFlow(flow); fetchNodes(flow.id); }}
                                className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${selectedFlow?.id === flow.id ? 'bg-emerald-50 dark:bg-emerald-500/10 border-l-4 border-emerald-500' : ''}`}
                            >
                                <div className="flex justify-between items-start group/flow">
                                    <span className="font-medium text-sm">{flow.name}</span>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleToggleActive(flow); }}
                                            title={flow.is_active ? "Desativar" : "Ativar"}
                                        >
                                            {flow.is_active ? <Play className="w-4 h-4 text-emerald-500 fill-emerald-500" /> : <Pause className="w-4 h-4 text-slate-400" />}
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteFlow(flow.id); }}
                                            className="opacity-0 group-hover/flow:opacity-100 p-1 text-red-400 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="m-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Como funciona?</p>
                        <ul className="text-[10px] text-slate-500 space-y-1 list-disc pl-3">
                            <li>Crie um passo do tipo <b>Saudação</b> para ser a primeira mensagem.</li>
                            <li>Use o <b>Menu</b> para dar opções numeradas ao cliente.</li>
                            <li>Configure o <b>Próximo Passo</b> em cada opção para levar o cliente adiante.</li>
                            <li>Use <b>Setor</b> ou <b>Usuário</b> para finalizar o robô e transferir o chat.</li>
                        </ul>
                    </div>
                </div>

                {/* Editor do Fluxo */}
                <div className="md:col-span-3 space-y-4">
                    {!selectedFlow ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                            <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                            <p>Selecione ou crie um fluxo para começar</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex gap-2 p-2 bg-slate-100 dark:bg-white/5 rounded-xl">
                                <button onClick={() => handleAddNode('greeting')} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-white dark:bg-white/10 rounded-lg shadow-sm hover:bg-emerald-50 transition-colors">
                                    <MessageSquare className="w-4 h-4 text-emerald-500" /> Saudação
                                </button>
                                <button onClick={() => handleAddNode('menu')} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-white dark:bg-white/10 rounded-lg shadow-sm hover:bg-blue-50 transition-colors">
                                    <List className="w-4 h-4 text-blue-500" /> Menu
                                </button>
                                <button onClick={() => handleAddNode('transfer_queue')} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-white dark:bg-white/10 rounded-lg shadow-sm hover:bg-purple-50 transition-colors">
                                    <Users className="w-4 h-4 text-purple-500" /> Dep.
                                </button>
                                <button onClick={() => handleAddNode('transfer_user')} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-white dark:bg-white/10 rounded-lg shadow-sm hover:bg-orange-50 transition-colors">
                                    <UserPlus className="w-4 h-4 text-orange-500" /> Usuário
                                </button>
                            </div>

                            <div className="space-y-4">
                                {nodes.map((node, idx) => (
                                    <div key={node.id} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 relative group">
                                        <div className="absolute top-4 right-4 flex gap-2 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleDeleteNode(node.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-white/10 rounded-full text-[10px] font-bold text-slate-400">
                                                #{idx + 1}
                                            </span>
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                {node.type === 'greeting' ? 'Saudação do Robô' : 
                                                 node.type === 'menu' ? 'Menu de Opções' : 
                                                 node.type === 'transfer_queue' ? 'Transferir para Setor' : 
                                                 node.type === 'transfer_user' ? 'Transferir para Atendente' : 'Mensagem'}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            {(node.type === 'greeting' || node.type === 'menu' || node.type === 'message') && (
                                                <textarea 
                                                    value={node.content.text}
                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, text: e.target.value })}
                                                    placeholder="Digite a mensagem do robô..."
                                                    className="w-full p-3 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                    rows={3}
                                                />
                                            )}

                                            {node.type === 'menu' && (
                                                <div className="space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-500/20">
                                                    <p className="text-[10px] font-bold text-blue-500 uppercase">Opções do Menu</p>
                                                    {(node.content.options || []).map((opt: any, optIdx: number) => (
                                                        <div key={optIdx} className="flex gap-2">
                                                            <input 
                                                                value={opt.label}
                                                                onChange={(e) => {
                                                                    const newOpts = [...node.content.options];
                                                                    newOpts[optIdx].label = e.target.value;
                                                                    handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                }}
                                                                placeholder={`Opção ${optIdx + 1}`}
                                                                className="flex-1 p-2 text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                                                            />
                                                            <select 
                                                                value={opt.next_node}
                                                                onChange={(e) => {
                                                                    const newOpts = [...node.content.options];
                                                                    newOpts[optIdx].next_node = e.target.value;
                                                                    handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                }}
                                                                className="w-32 p-2 text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                                                            >
                                                                <option value="">Próximo Passo</option>
                                                                {nodes.filter(n => n.id !== node.id).map((n, i) => (
                                                                    <option key={n.id} value={n.id}>Passo #{i + 1} ({n.type})</option>
                                                                ))}
                                                            </select>
                                                            <button 
                                                                onClick={() => {
                                                                    const newOpts = node.content.options.filter((_: any, i: number) => i !== optIdx);
                                                                    handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                }}
                                                                className="p-2 text-red-500"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={() => {
                                                            const newOpts = [...(node.content.options || []), { label: '', next_node: '' }];
                                                            handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                        }}
                                                        className="text-[10px] text-blue-500 font-bold hover:underline"
                                                    >
                                                        + ADICIONAR OPÇÃO
                                                    </button>
                                                </div>
                                            )}

                                            {node.type === 'transfer_queue' && (
                                                <select 
                                                    value={node.content.queue_id}
                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, queue_id: e.target.value })}
                                                    className="w-full p-3 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                                                >
                                                    <option value="">Selecione o Setor</option>
                                                    {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                                </select>
                                            )}

                                            {node.type === 'transfer_user' && (
                                                <select 
                                                    value={node.content.user_id}
                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, user_id: e.target.value })}
                                                    className="w-full p-3 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                                                >
                                                    <option value="">Selecione o Atendente</option>
                                                    {team.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {nodes.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-xl">
                                        Nenhum passo adicionado. Use os botões acima para começar o fluxo.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatbotSettings;
