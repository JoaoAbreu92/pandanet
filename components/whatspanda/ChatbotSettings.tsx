import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import {
    Plus, Trash2, Save, MessageSquare, List, UserPlus, Users, Play, Pause,
    RefreshCw, Send, Smartphone, BookOpen, Layers, GripVertical, Zap,
    AlertCircle, CheckCircle, ArrowDown, Download, Upload
} from 'lucide-react';
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
    sort_order: number;
}

interface SimMessage {
    id: string;
    sender: 'user' | 'bot' | 'system';
    text: string;
    options?: Array<{ label: string; next_node: string }>;
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
    const [chatbotMode, setChatbotMode] = useState<'disabled' | 'flow' | 'gemini'>('disabled');
    const [chatbotMaxRetries, setChatbotMaxRetries] = useState<number>(2);
    const [chatbotInvalidOptionMsg, setChatbotInvalidOptionMsg] = useState<string>('Opção inválida. Por favor, escolha uma das opções do menu:');
    const activeProfile = currentUser || profile;
    const [signature, setSignature] = useState('');
    const [useSignature, setUseSignature] = useState(false);

    // Dirty tracking and save state
    const [dirtyNodeIds, setDirtyNodeIds] = useState<Set<string>>(new Set());
    const [isSavingFlow, setIsSavingFlow] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Drag-and-drop state
    const [dragSourceId, setDragSourceId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // Simulator State
    const [isSimulating, setIsSimulating] = useState(false);
    const [simHistory, setSimHistory] = useState<SimMessage[]>([]);
    const [currentNode, setCurrentNode] = useState<ChatbotNode | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExportFlow = () => {
        if (!selectedFlow) return;
        
        const flowData = {
            version: '1.0',
            flow: {
                name: selectedFlow.name,
                description: selectedFlow.description,
            },
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                content: n.content,
                sort_order: n.sort_order
            }))
        };

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(flowData, null, 2)
        )}`;
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonString);
        downloadAnchor.setAttribute('download', `${selectedFlow.name.toLowerCase().replace(/\s+/g, '_')}_flow.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    const handleImportFlow = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedFlow) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (!data.nodes || !Array.isArray(data.nodes)) {
                    alert('Formato de arquivo inválido. O arquivo deve conter uma lista de etapas (nodes).');
                    return;
                }

                if (!window.confirm('Atenção: Importar este fluxo irá apagar todas as etapas atuais do fluxo selecionado. Deseja continuar?')) {
                    return;
                }

                setLoading(true);

                // 1. Map old UUIDs to new UUIDs to preserve connections
                const oldToNewIdMap: Record<string, string> = {};
                
                // First pass: generate new UUIDs
                data.nodes.forEach((node: any) => {
                    oldToNewIdMap[node.id] = crypto.randomUUID();
                });

                // 2. Prepare nodes for insertion with updated references
                const finalizedNodes = data.nodes.map((node: any) => {
                    let updatedContent = { ...node.content };
                    if (node.type === 'menu' && Array.isArray(updatedContent.options)) {
                        updatedContent.options = updatedContent.options.map((opt: any) => ({
                            ...opt,
                            next_node: oldToNewIdMap[opt.next_node] || opt.next_node
                        }));
                    }
                    return {
                        id: oldToNewIdMap[node.id],
                        flow_id: selectedFlow.id,
                        type: node.type,
                        content: updatedContent,
                        sort_order: typeof node.sort_order === 'number' ? node.sort_order : 0
                    };
                });

                // 3. Clear existing nodes in database
                await supabase.from('whatsapp_chatbot_nodes').delete().eq('flow_id', selectedFlow.id);

                // 4. Insert new nodes
                const { error: insertErr } = await supabase.from('whatsapp_chatbot_nodes').insert(finalizedNodes);
                if (insertErr) throw insertErr;

                // 5. Update flow metadata if present in JSON
                if (data.flow) {
                    const updatedFlow = {
                        ...selectedFlow,
                        name: data.flow.name || selectedFlow.name,
                        description: data.flow.description || selectedFlow.description
                    };
                    await supabase.from('whatsapp_chatbot_flows')
                        .update({ name: updatedFlow.name, description: updatedFlow.description })
                        .eq('id', selectedFlow.id);
                    setSelectedFlow(updatedFlow);
                }

                // 6. Reload nodes
                await fetchNodes(selectedFlow.id);
                alert('Fluxo importado com sucesso!');
            } catch (err: any) {
                console.error('Erro ao importar fluxo:', err);
                alert('Erro ao importar fluxo: ' + err.message);
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const applyFormatting = (format: 'bold' | 'italic' | 'strike' | 'mono') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        
        let formatted = '';
        switch (format) {
            case 'bold': formatted = `*${selectedText}*`; break;
            case 'italic': formatted = `_${selectedText}_`; break;
            case 'strike': formatted = `~${selectedText}~`; break;
            case 'mono': formatted = `\`\`\`${selectedText}\`\`\``; break;
        }

        const newValue = text.substring(0, start) + formatted + text.substring(end);
        setSignature(newValue);
        
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + formatted.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 50);
    };

    const renderWhatsAppMarkdown = (text: string) => {
        if (!text) return <span className="text-slate-400 dark:text-gray-500 italic">Sua assinatura aparecerá aqui...</span>;
        
        let formatted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        formatted = formatted.replace(/```([^`]+)```/g, '<span style="font-family: monospace;" class="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-500">$1</span>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
        formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');
        formatted = formatted.replace(/\n/g, '<br/>');

        return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
    };

    useEffect(() => {
        fetchData();
    }, [currentUser?.company_id]);

    useEffect(() => {
        const fetchSignature = async () => {
            const profileId = activeProfile?.id;
            if (!profileId) return;
            const { data } = await supabase
                .from('profiles')
                .select('whatsapp_signature, use_whatsapp_signature')
                .eq('id', profileId)
                .single();
            if (data) {
                setSignature(data.whatsapp_signature || '');
                setUseSignature(data.use_whatsapp_signature || false);
            }
        };
        fetchSignature();
    }, [activeProfile?.id]);

    const fetchData = async () => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;

        const { data: flowsData } = await supabase.from('whatsapp_chatbot_flows').select('*').eq('company_id', companyId);
        const { data: queuesData } = await supabase.from('whatsapp_queues').select('*').eq('company_id', companyId);
        const { data: teamData } = await supabase.from('profiles').select('id, full_name').eq('company_id', companyId);
        const { data: settingsData } = await supabase.from('whatsapp_settings').select('gemini_api_key, chatbot_mode, chatbot_max_retries, chatbot_invalid_option_msg').eq('company_id', companyId).limit(1).single();

        if (flowsData) setFlows(flowsData);
        if (queuesData) setQueues(queuesData);
        if (teamData) setTeam(teamData);
        if (settingsData) {
            setGeminiKey(settingsData.gemini_api_key || '');
            setChatbotMode((settingsData.chatbot_mode as any) || 'disabled');
            setChatbotMaxRetries(settingsData.chatbot_max_retries !== undefined ? settingsData.chatbot_max_retries : 2);
            setChatbotInvalidOptionMsg(settingsData.chatbot_invalid_option_msg || 'Opção inválida. Por favor, escolha uma das opções do menu:');
        }
    };

    const handleUpdateChatbotMode = async (mode: 'disabled' | 'flow' | 'gemini') => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;

        setLoading(true);
        const { error } = await supabase
            .from('whatsapp_settings')
            .update({ chatbot_mode: mode })
            .eq('company_id', companyId);
        
        setLoading(false);
        if (error) {
            console.error('Erro ao atualizar modo de atendimento:', error);
            alert('Erro ao atualizar modo de atendimento: ' + error.message);
        } else {
            setChatbotMode(mode);
            if (mode === 'gemini') {
                await supabase.from('whatsapp_chatbot_flows').update({ is_active: false }).eq('company_id', companyId);
                fetchData();
            } else if (mode === 'flow') {
                if (selectedFlow) {
                    await supabase.from('whatsapp_chatbot_flows').update({ is_active: false }).eq('company_id', companyId);
                    await supabase.from('whatsapp_chatbot_flows').update({ is_active: true }).eq('id', selectedFlow.id);
                    fetchData();
                } else if (flows.length > 0) {
                    await supabase.from('whatsapp_chatbot_flows').update({ is_active: false }).eq('company_id', companyId);
                    await supabase.from('whatsapp_chatbot_flows').update({ is_active: true }).eq('id', flows[0].id);
                    fetchData();
                }
            } else {
                await supabase.from('whatsapp_chatbot_flows').update({ is_active: false }).eq('company_id', companyId);
                fetchData();
            }
        }
    };

    const fetchNodes = async (flowId: string) => {
        const { data } = await supabase
            .from('whatsapp_chatbot_nodes')
            .select('*')
            .eq('flow_id', flowId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (data) setNodes(data);
        setDirtyNodeIds(new Set());
    };

    const handleCreateFlow = async () => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;

        const { data, error } = await supabase.from('whatsapp_chatbot_flows').insert({
            company_id: companyId,
            name: 'Novo Fluxo de Chatbot',
            is_active: false
        }).select().single();

        if (error) {
            console.error('Erro ao criar fluxo:', error);
            alert('Erro ao criar fluxo: ' + error.message);
            return;
        }

        if (data) {
            setFlows([...flows, data]);
            setSelectedFlow(data);
            fetchNodes(data.id);
        }
    };

    const handleToggleActive = async (flow: ChatbotFlow) => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;

        if (!flow.is_active) {
            const { error: deactivateErr } = await supabase.from('whatsapp_chatbot_flows').update({ is_active: false }).eq('company_id', companyId);
            if (deactivateErr) {
                console.error('Erro ao desativar outros fluxos:', deactivateErr);
                alert('Erro ao desativar outros fluxos: ' + deactivateErr.message);
                return;
            }
        }

        const { error } = await supabase.from('whatsapp_chatbot_flows')
            .update({ is_active: !flow.is_active })
            .eq('id', flow.id);

        if (error) {
            console.error('Erro ao alternar status do fluxo:', error);
            alert('Erro ao alterar status do fluxo: ' + error.message);
        } else {
            fetchData();
        }
    };

    const handleDeleteFlow = async (flowId: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este fluxo e todos os seus passos?')) return;
        const { error } = await supabase.from('whatsapp_chatbot_flows').delete().eq('id', flowId);
        if (error) {
            console.error('Erro ao excluir fluxo:', error);
            alert('Erro ao excluir fluxo: ' + error.message);
        } else {
            setFlows(flows.filter(f => f.id !== flowId));
            if (selectedFlow?.id === flowId) {
                setSelectedFlow(null);
                setNodes([]);
                setIsSimulating(false);
                setDirtyNodeIds(new Set());
            }
        }
    };

    const handleAddNode = async (type: ChatbotNode['type']) => {
        if (!selectedFlow) return;

        const content = type === 'menu' ? { text: '', options: [] } : { text: '' };
        const nextSortOrder = nodes.length;
        
        const { data, error } = await supabase.from('whatsapp_chatbot_nodes').insert({
            flow_id: selectedFlow.id,
            type,
            content,
            sort_order: nextSortOrder
        }).select().single();

        if (error) {
            console.error('Erro ao adicionar etapa:', error);
            alert('Erro ao adicionar etapa: ' + error.message);
            return;
        }

        if (data) setNodes([...nodes, data]);
    };

    // Update node LOCAL state only — does NOT save to DB immediately
    const handleUpdateNode = (nodeId: string, content: any) => {
        setNodes(nodes.map(n => n.id === nodeId ? { ...n, content } : n));
        setDirtyNodeIds(prev => new Set([...prev, nodeId]));
    };

    // Explicit save — batch saves all dirty nodes to Supabase
    const handleSaveFlow = async () => {
        if (dirtyNodeIds.size === 0) return;
        setIsSavingFlow(true);
        setSaveSuccess(false);

        try {
            // Se metadados do fluxo foram modificados
            if (dirtyNodeIds.has('flow-meta') && selectedFlow) {
                const { error: flowErr } = await supabase
                    .from('whatsapp_chatbot_flows')
                    .update({ name: selectedFlow.name, description: selectedFlow.description })
                    .eq('id', selectedFlow.id);
                if (flowErr) throw flowErr;
            }

            const dirtyNodes = nodes.filter(n => dirtyNodeIds.has(n.id) && n.id !== 'flow-meta');
            for (const node of dirtyNodes) {
                const { error } = await supabase
                    .from('whatsapp_chatbot_nodes')
                    .update({ content: node.content, sort_order: node.sort_order })
                    .eq('id', node.id);
                if (error) throw error;
            }

            // Recarregar os fluxos do banco de dados para sincronizar a lista lateral
            const companyId = currentUser?.company_id || profile?.company_id;
            if (companyId) {
                const { data: flowsData } = await supabase.from('whatsapp_chatbot_flows').select('*').eq('company_id', companyId);
                if (flowsData) {
                    setFlows(flowsData);
                    const updatedSelected = flowsData.find(f => f.id === selectedFlow?.id);
                    if (updatedSelected) setSelectedFlow(updatedSelected);
                }
            }

            setDirtyNodeIds(new Set());
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            console.error('Erro ao salvar fluxo:', err);
            alert('Erro ao salvar fluxo: ' + (err.message || err));
        } finally {
            setIsSavingFlow(false);
        }
    };

    const handleSaveChatbotSettings = async () => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;
        setLoading(true);
        const { error } = await supabase
            .from('whatsapp_settings')
            .update({ 
                gemini_api_key: geminiKey,
                chatbot_max_retries: chatbotMaxRetries,
                chatbot_invalid_option_msg: chatbotInvalidOptionMsg
            })
            .eq('company_id', companyId);
        setLoading(false);
        if (error) {
            console.error('Erro ao salvar configurações do Chatbot:', error);
            alert('Erro ao salvar configurações do Chatbot: ' + error.message);
        } else {
            alert('Configurações do Chatbot salvas com sucesso!');
        }
    };

    const handleSaveSignature = async () => {
        const profileId = activeProfile?.id;
        if (!profileId) return;
        setLoading(true);
        const { error } = await supabase.from('profiles').update({ 
            whatsapp_signature: signature,
            use_whatsapp_signature: useSignature
        }).eq('id', profileId);
        setLoading(false);
        if (error) alert('Erro ao salvar assinatura: ' + error.message);
        else alert('Assinatura salva com sucesso!');
    };

    const handleDeleteNode = async (nodeId: string) => {
        const { error } = await supabase.from('whatsapp_chatbot_nodes').delete().eq('id', nodeId);
        if (error) {
            console.error('Erro ao excluir etapa:', error);
            alert('Erro ao excluir etapa: ' + error.message);
        } else {
            setNodes(nodes.filter(n => n.id !== nodeId));
            setDirtyNodeIds(prev => {
                const next = new Set(prev);
                next.delete(nodeId);
                return next;
            });
        }
    };

    // ── Drag-and-Drop Handlers ──────────────────────────────────────────────
    const handleDragStart = (e: React.DragEvent, nodeId: string) => {
        setDragSourceId(nodeId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', nodeId);
    };

    const handleDragOver = (e: React.DragEvent, nodeId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverId !== nodeId) setDragOverId(nodeId);
    };

    const handleDrop = (e: React.DragEvent, targetNodeId: string) => {
        e.preventDefault();
        const sourceNodeId = e.dataTransfer.getData('text/plain');
        if (!sourceNodeId || sourceNodeId === targetNodeId) {
            setDragOverId(null);
            setDragSourceId(null);
            return;
        }

        const newNodes = [...nodes];
        const sourceIdx = newNodes.findIndex(n => n.id === sourceNodeId);
        const targetIdx = newNodes.findIndex(n => n.id === targetNodeId);
        if (sourceIdx === -1 || targetIdx === -1) return;

        const [removed] = newNodes.splice(sourceIdx, 1);
        newNodes.splice(targetIdx, 0, removed);

        const updatedNodes = newNodes.map((n, idx) => ({ ...n, sort_order: idx }));
        setNodes(updatedNodes);
        setDragOverId(null);
        setDragSourceId(null);
        // Mark all as dirty so sort_order gets persisted
        setDirtyNodeIds(new Set(updatedNodes.map(n => n.id)));
    };

    const handleDragEnd = () => {
        setDragOverId(null);
        setDragSourceId(null);
    };

    // ── Templates ─────────────────────────────────────────────────────────────
    const loadTemplate = async (templateType: 'support_sales' | 'clinic' | 'restaurant' | 'practical_example') => {
        if (!selectedFlow) return;
        if (!window.confirm('Atenção: Carregar este modelo irá apagar todas as etapas atuais deste fluxo de chatbot. Deseja continuar?')) return;

        setLoading(true);
        try {
            await supabase.from('whatsapp_chatbot_nodes').delete().eq('flow_id', selectedFlow.id);

            const q1 = queues[0]?.id || null;
            const q2 = queues[1]?.id || queues[0]?.id || null;

            if (templateType === 'practical_example') {
                const u1 = team[0]?.id || activeProfile?.id;
                const u2 = team[1]?.id || team[0]?.id || activeProfile?.id;
                const u3 = team[2]?.id || team[1]?.id || team[0]?.id || activeProfile?.id;

                const name1 = team[0]?.full_name || 'Carlos';
                const name2 = team[1]?.full_name || 'Ana';
                const name3 = team[2]?.full_name || 'Lucas';

                // 1. Inserir nós de transferência de usuário (Suporte)
                const { data: t1 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 5,
                    content: { text: `Perfeito. Estou te transferindo para o atendente ${name1} no Suporte. Por favor, aguarde.`, user_id: u1 }
                }).select().single();

                const { data: t2 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 6,
                    content: { text: `Perfeito. Estou te transferindo para o atendente ${name2} no Suporte. Por favor, aguarde.`, user_id: u2 }
                }).select().single();

                const { data: t3 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 7,
                    content: { text: `Perfeito. Estou te transferindo para o atendente ${name3} no Suporte. Por favor, aguarde.`, user_id: u3 }
                }).select().single();

                // 2. Inserir nós de transferência de usuário (Comercial)
                const { data: t4 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 8,
                    content: { text: `Entendido. Um momento enquanto te conecto com o consultor ${name1} do Comercial.`, user_id: u1 }
                }).select().single();

                const { data: t5 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 9,
                    content: { text: `Entendido. Um momento enquanto te conecto com o consultor ${name2} do Comercial.`, user_id: u2 }
                }).select().single();

                const { data: t6 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 10,
                    content: { text: `Entendido. Um momento enquanto te conecto com o consultor ${name3} do Comercial.`, user_id: u3 }
                }).select().single();

                // 3. Inserir nós de transferência de usuário (Financeiro)
                const { data: t7 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 11,
                    content: { text: `Certo. Vou te transferir para o analista ${name1} no Financeiro.`, user_id: u1 }
                }).select().single();

                const { data: t8 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 12,
                    content: { text: `Certo. Vou te transferir para o analista ${name2} no Financeiro.`, user_id: u2 }
                }).select().single();

                const { data: t9 } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_user', sort_order: 13,
                    content: { text: `Certo. Vou te transferir para o analista ${name3} no Financeiro.`, user_id: u3 }
                }).select().single();

                // 4. Inserir menus de cada setor
                const { data: mSup } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 2,
                    content: {
                        text: 'Você escolheu *Suporte*. Selecione o atendente desejado:',
                        options: [
                            { label: `1. Falar com ${name1} 🛠️`, next_node: t1?.id || '' },
                            { label: `2. Falar com ${name2} 🛠️`, next_node: t2?.id || '' },
                            { label: `3. Falar com ${name3} 🛠️`, next_node: t3?.id || '' }
                        ]
                    }
                }).select().single();

                const { data: mCom } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 3,
                    content: {
                        text: 'Você escolheu *Comercial*. Selecione o consultor desejado:',
                        options: [
                            { label: `1. Falar com ${name1} 💼`, next_node: t4?.id || '' },
                            { label: `2. Falar com ${name2} 💼`, next_node: t5?.id || '' },
                            { label: `3. Falar com ${name3} 💼`, next_node: t6?.id || '' }
                        ]
                    }
                }).select().single();

                const { data: mFin } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 4,
                    content: {
                        text: 'Você escolheu *Financeiro*. Selecione o analista desejado:',
                        options: [
                            { label: `1. Falar com ${name1} 💳`, next_node: t7?.id || '' },
                            { label: `2. Falar com ${name2} 💳`, next_node: t8?.id || '' },
                            { label: `3. Falar com ${name3} 💳`, next_node: t9?.id || '' }
                        ]
                    }
                }).select().single();

                // 5. Inserir Menu Principal
                const { data: mMain } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 1,
                    content: {
                        text: 'Por favor, escolha uma das opções abaixo para direcionarmos seu atendimento:',
                        options: [
                            { label: '1. Suporte Técnico 🛠️', next_node: mSup?.id || '' },
                            { label: '2. Comercial / Vendas 💼', next_node: mCom?.id || '' },
                            { label: '3. Financeiro 💳', next_node: mFin?.id || '' }
                        ]
                    }
                }).select().single();

                // 6. Inserir Etapa de Saudação (Greeting)
                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'greeting', sort_order: 0,
                    content: { text: 'Olá! Seja bem-vindo à nossa central de atendimento PandaNet. Como posso ajudar você hoje?' }
                });
            } else if (templateType === 'support_sales') {
                const { data: supportNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_queue', sort_order: 2,
                    content: { text: 'Perfeito. Estou transferindo seu atendimento para nossa equipe do Suporte Técnico. Por favor, aguarde.', queue_id: q1 }
                }).select().single();

                const { data: salesNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_queue', sort_order: 3,
                    content: { text: 'Certo! Um consultor do Comercial falará com você em instantes.', queue_id: q2 }
                }).select().single();

                const { data: msgNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'message', sort_order: 4,
                    content: { text: 'Certo! Se precisar de algo mais, estamos à disposição. Tenha um ótimo dia!' }
                }).select().single();

                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 1,
                    content: {
                        text: 'Por favor, selecione uma das opções abaixo:',
                        options: [
                            { label: '1. Suporte Técnico 🛠️', next_node: supportNode?.id || '' },
                            { label: '2. Comercial / Vendas 💼', next_node: salesNode?.id || '' },
                            { label: '3. Outros Assuntos ✨', next_node: msgNode?.id || '' }
                        ]
                    }
                });

                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'greeting', sort_order: 0,
                    content: { text: 'Olá! Seja bem-vindo à nossa central de atendimento. Como podemos ajudar você hoje?' }
                });

            } else if (templateType === 'clinic') {
                const { data: bookingNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'message', sort_order: 2,
                    content: { text: 'Para agendar sua consulta rapidamente, acesse o link do nosso portal médico: https://agendamentos.exemplo.com.br' }
                }).select().single();

                const { data: receptionNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_queue', sort_order: 3,
                    content: { text: 'Aguarde um instante. Estou transferindo você para a nossa Recepção para agendamentos manuais.', queue_id: q1 }
                }).select().single();

                const { data: infoNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'message', sort_order: 4,
                    content: { text: 'Nosso horário de funcionamento é de Segunda a Sexta, das 8h às 18h. Estamos localizados na Av. Paulista, 1000.' }
                }).select().single();

                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 1,
                    content: {
                        text: 'Escolha uma opção:',
                        options: [
                            { label: '1. Agendamento Online 📅', next_node: bookingNode?.id || '' },
                            { label: '2. Falar com Recepção ☎️', next_node: receptionNode?.id || '' },
                            { label: '3. Horários e Localização 📍', next_node: infoNode?.id || '' }
                        ]
                    }
                });

                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'greeting', sort_order: 0,
                    content: { text: 'Olá! Obrigado por entrar em contato com nossa clínica médica. Como podemos te ajudar hoje?' }
                });
            } else if (templateType === 'restaurant') {
                const { data: menuLinkNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'message', sort_order: 2,
                    content: { text: 'Aqui está o nosso cardápio digital completo: https://cardapio.exemplo.com.br/pedir. Faça o seu pedido por lá e ele já entrará em nossa cozinha!' }
                }).select().single();

                const { data: trackerNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'message', sort_order: 3,
                    content: { text: 'Para acompanhar seu pedido, envie o número dele (ex: #1024) ou aguarde que o sistema enviará atualizações.' }
                }).select().single();

                const { data: supportNode } = await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'transfer_queue', sort_order: 4,
                    content: { text: 'Vou te passar para um de nossos atendentes na recepção para te ajudar com seu pedido.', queue_id: q1 }
                }).select().single();

                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'menu', sort_order: 1,
                    content: {
                        text: 'Olá! Sou o PandaBot de Delivery 🐼. Escolha uma opção para iniciar seu atendimento:',
                        options: [
                            { label: '1. Ver Cardápio / Fazer Pedido 🍔', next_node: menuLinkNode?.id || '' },
                            { label: '2. Acompanhar Pedido 📦', next_node: trackerNode?.id || '' },
                            { label: '3. Falar com Atendente 👤', next_node: supportNode?.id || '' }
                        ]
                    }
                });

                await supabase.from('whatsapp_chatbot_nodes').insert({
                    flow_id: selectedFlow.id, type: 'greeting', sort_order: 0,
                    content: { text: 'Seja bem-vindo ao Panda Restaurante! 🐼🍔🍕' }
                });
            }

            fetchNodes(selectedFlow.id);
            alert('Modelo de fluxo carregado com sucesso!');
        } catch (err: any) {
            console.error('Error loading template:', err);
            alert('Erro ao carregar modelo: ' + err.message);
        }
        setLoading(false);
    };

    // ── Simulator ─────────────────────────────────────────────────────────────
    const startSimulation = () => {
        if (nodes.length === 0) {
            alert('Adicione passos ao fluxo para poder simular.');
            return;
        }

        setIsSimulating(true);
        const greeting = nodes.find(n => n.type === 'greeting');
        const first = greeting || nodes[0];
        
        if (first) {
            const initialHistory: SimMessage[] = [
                { id: '1', sender: 'bot', text: first.content.text }
            ];

            const menuNode = nodes.find(n => n.type === 'menu');
            if (first.type === 'greeting' && menuNode) {
                initialHistory.push({
                    id: '2',
                    sender: 'bot',
                    text: menuNode.content.text,
                    options: menuNode.content.options
                });
                setCurrentNode(menuNode);
            } else {
                setCurrentNode(first);
            }

            setSimHistory(initialHistory);
        }
    };

    const handleSimulateOption = (option: { label: string; next_node: string }) => {
        const userMsg: SimMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: option.label
        };

        const targetNode = nodes.find(n => n.id === option.next_node);

        if (!targetNode) {
            setSimHistory(prev => [...prev, userMsg, {
                id: `bot-err-${Date.now()}`,
                sender: 'bot',
                text: '🤖 Etapa de destino não configurada ou inexistente.'
            }]);
            return;
        }

        const botMsg: SimMessage = {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: targetNode.content.text || ''
        };

        if (targetNode.type === 'menu') {
            botMsg.options = targetNode.content.options;
        }

        let sysMsg: SimMessage | null = null;
        if (targetNode.type === 'transfer_queue') {
            const queueName = queues.find(q => q.id === targetNode.content.queue_id)?.name || 'Sem setor';
            sysMsg = {
                id: `sys-${Date.now()}`,
                sender: 'system',
                text: `Conversa encaminhada para o setor: ${queueName}`
            };
        } else if (targetNode.type === 'transfer_user') {
            const userName = team.find(u => u.id === targetNode.content.user_id)?.full_name || 'Sem atendente';
            sysMsg = {
                id: `sys-${Date.now()}`,
                sender: 'system',
                text: `Conversa atribuída ao atendente: ${userName}`
            };
        }

        setSimHistory(prev => {
            const current = [...prev, userMsg, botMsg];
            if (sysMsg) current.push(sysMsg);
            return current;
        });
        setCurrentNode(targetNode);
    };

    const resetSimulation = () => {
        setSimHistory([]);
        setCurrentNode(null);
        startSimulation();
    };

    // ── Node type helpers ──────────────────────────────────────────────────────
    const getNodeMeta = (type: ChatbotNode['type']) => {
        switch (type) {
            case 'greeting': return { label: 'Saudação do Robô 🤖', borderClass: 'border-l-4 border-emerald-500', titleColor: 'text-emerald-500', bgDot: 'bg-emerald-500' };
            case 'menu': return { label: 'Menu de Opções 📋', borderClass: 'border-l-4 border-blue-500', titleColor: 'text-blue-500', bgDot: 'bg-blue-500' };
            case 'transfer_queue': return { label: 'Transferir para Setor 🏢', borderClass: 'border-l-4 border-purple-500', titleColor: 'text-purple-500', bgDot: 'bg-purple-500' };
            case 'transfer_user': return { label: 'Transferir para Atendente 👤', borderClass: 'border-l-4 border-orange-500', titleColor: 'text-orange-500', bgDot: 'bg-orange-500' };
            default: return { label: 'Mensagem', borderClass: 'border-l-4 border-slate-400', titleColor: 'text-slate-400', bgDot: 'bg-slate-400' };
        }
    };

    const translateType = (type: string) => {
        switch (type) {
            case 'greeting': return 'Saudação';
            case 'menu': return 'Menu';
            case 'transfer_queue': return 'Setor';
            case 'transfer_user': return 'Agente';
            case 'message': return 'Mensagem';
            default: return type;
        }
    };

    // ── SVG Node Connector ─────────────────────────────────────────────────────
    const getNodeConnectorColor = (type?: ChatbotNode['type']) => {
        switch (type) {
            case 'greeting': return '#10b981';   // emerald
            case 'menu': return '#3b82f6';        // blue
            case 'transfer_queue': return '#a855f7'; // purple
            case 'transfer_user': return '#f97316'; // orange
            default: return '#94a3b8';             // slate
        }
    };

    const NodeConnector = ({ fromNode, label }: { fromNode?: ChatbotNode; label?: string }) => {
        const color = getNodeConnectorColor(fromNode?.type);
        return (
            <div className="flex flex-col items-center my-0 select-none pointer-events-none" style={{ height: 44 }}>
                <svg width="60" height="44" viewBox="0 0 60 44" fill="none">
                    {/* Vertical dashed line */}
                    <line x1="30" y1="0" x2="30" y2="28" stroke={color} strokeWidth="2.5" strokeDasharray="5 3" />
                    {/* Arrowhead */}
                    <polygon points="30,44 22,28 38,28" fill={color} opacity="0.85" />
                </svg>
                {label && (
                    <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border -mt-1"
                        style={{
                            color,
                            backgroundColor: color + '18',
                            borderColor: color + '40'
                        }}
                    >
                        {label}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 max-w-7xl pb-10">
            {/* Modo de Atendimento Automático */}
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white tracking-tight">
                        <Zap className="w-6 h-6 text-emerald-500" /> Modo de Atendimento Automático
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold opacity-75 uppercase tracking-widest mt-1">
                        Escolha como o PandaNet deve responder às novas conversas recebidas.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Opção 1: Desativado */}
                    <button
                        onClick={() => handleUpdateChatbotMode('disabled')}
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group
                            ${chatbotMode === 'disabled'
                                ? 'bg-slate-50 dark:bg-white/5 border-slate-500 text-slate-900 dark:text-white shadow-lg shadow-slate-500/5'
                                : 'bg-transparent border-gray-200 dark:border-white/5 text-gray-500 hover:border-slate-350 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Pause className="w-8 h-8 mb-2" />
                        <span className="font-bold text-sm">Desativado</span>
                        <span className="text-[10px] opacity-75 mt-1 text-center font-medium">Nenhum robô responderá de forma automática.</span>
                        {chatbotMode === 'disabled' && (
                            <div className="absolute top-0 right-0 bg-slate-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-xl uppercase tracking-wider">
                                Ativo
                            </div>
                        )}
                    </button>

                    {/* Opção 2: Fluxo Manual */}
                    <button
                        onClick={() => handleUpdateChatbotMode('flow')}
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group
                            ${chatbotMode === 'flow'
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/5'
                                : 'bg-transparent border-gray-200 dark:border-white/5 text-gray-500 hover:border-emerald-350 hover:text-emerald-600 dark:hover:text-emerald-450'
                            }`}
                    >
                        <List className="w-8 h-8 mb-2" />
                        <span className="font-bold text-sm">Fluxo de Chatbot (Manual)</span>
                        <span className="text-[10px] opacity-75 mt-1 text-center font-medium">Usa a árvore de menus e etapas criada manualmente abaixo.</span>
                        {chatbotMode === 'flow' && (
                            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-xl uppercase tracking-wider">
                                Ativo
                            </div>
                        )}
                    </button>

                    {/* Opção 3: Triagem por IA (Gemini) */}
                    <button
                        onClick={() => handleUpdateChatbotMode('gemini')}
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group
                            ${chatbotMode === 'gemini'
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg shadow-indigo-500/5'
                                : 'bg-transparent border-gray-200 dark:border-white/5 text-gray-500 hover:border-indigo-350 hover:text-indigo-650 dark:hover:text-indigo-450'
                            }`}
                    >
                        <SparklesIcon className="w-8 h-8 mb-2" />
                        <span className="font-bold text-sm">Triagem Inteligente (Gemini IA)</span>
                        <span className="text-[10px] opacity-75 mt-1 text-center font-medium">A IA do Gemini atende e faz a triagem para setores e atendentes.</span>
                        {chatbotMode === 'gemini' && (
                            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-xl uppercase tracking-wider">
                                Ativo
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* Configurações Gerais do Chatbot */}
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white tracking-tight">
                            <SparklesIcon className="w-6 h-6 text-emerald-500" /> Configurações Gerais do Chatbot
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold opacity-75 uppercase tracking-widest mt-1">
                            Ajuste a inteligência artificial do Gemini e limites de comportamento do bot.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Input Chave API Gemini */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            Chave de API do Google Gemini
                        </label>
                        <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-black/20 p-2.5 rounded-2xl border border-transparent dark:border-white/5">
                            <input 
                                type="password" 
                                placeholder="Insira sua Gemini API Key..."
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm px-3 py-2 flex-1 dark:text-white min-w-0"
                            />
                        </div>
                    </div>

                    {/* Input Tentativas do Chatbot */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            Máximo de Tentativas (Opções Inválidas)
                        </label>
                        <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-black/20 p-2.5 rounded-2xl border border-transparent dark:border-white/5">
                            <input 
                                type="number" 
                                min={1}
                                max={10}
                                value={chatbotMaxRetries}
                                onChange={(e) => setChatbotMaxRetries(parseInt(e.target.value) || 2)}
                                className="bg-transparent border-none outline-none text-sm px-3 py-2 flex-1 dark:text-white min-w-0"
                            />
                        </div>
                        <span className="text-[9px] text-gray-450 dark:text-gray-400 font-bold opacity-70">
                            Quantas vezes o menu reaparecerá se o cliente digitar uma opção errada antes de desativar o bot.
                        </span>
                    </div>

                    {/* Input Mensagem de Opção Inválida */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            Mensagem para Opção Inválida / Não Encontrada
                        </label>
                        <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-black/20 p-2.5 rounded-2xl border border-transparent dark:border-white/5">
                            <textarea 
                                rows={2}
                                value={chatbotInvalidOptionMsg}
                                onChange={(e) => setChatbotInvalidOptionMsg(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm px-3 py-2 flex-1 dark:text-white min-w-0 resize-none"
                                placeholder="Digite a mensagem enviada quando o cliente escolhe uma opção inexistente..."
                            />
                        </div>
                        <span className="text-[9px] text-gray-450 dark:text-gray-400 font-bold opacity-70">
                            Mensagem enviada de volta quando o robô de fluxo não entende o texto digitado pelo cliente.
                        </span>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button 
                        onClick={handleSaveChatbotSettings} 
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all text-xs font-bold shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Configurações
                    </button>
                </div>
            </div>

            {/* Minha Assinatura WhatsPanda */}
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl">
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-8">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white tracking-tight">
                            <MessageSquare className="w-6 h-6 text-indigo-500" /> Minha Assinatura WhatsPanda
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold opacity-75 uppercase tracking-widest">
                            Texto anexado automaticamente no rodapé das suas mensagens enviadas.
                        </p>
                        
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100/50 dark:bg-black/20 rounded-xl border border-transparent dark:border-white/5 w-fit">
                                <button type="button" onClick={() => applyFormatting('bold')} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all font-bold text-xs shadow-sm" title="Negrito"><b>B</b></button>
                                <button type="button" onClick={() => applyFormatting('italic')} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all font-italic text-xs shadow-sm" title="Itálico"><i>I</i></button>
                                <button type="button" onClick={() => applyFormatting('strike')} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all line-through text-xs shadow-sm" title="Tachado">S</button>
                                <button type="button" onClick={() => applyFormatting('mono')} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all font-mono text-xs shadow-sm" title="Monofásico">M</button>
                                <div className="h-4 w-px bg-slate-300 dark:bg-white/10 mx-1" />
                                {['💼', '🛠️', '✨', '👍', '☕', '📞', '💬'].map(emoji => (
                                    <button key={emoji} type="button" onClick={() => {
                                        const textarea = textareaRef.current;
                                        if (!textarea) return;
                                        const start = textarea.selectionStart;
                                        const end = textarea.selectionEnd;
                                        const text = textarea.value;
                                        const newValue = text.substring(0, start) + emoji + text.substring(end);
                                        setSignature(newValue);
                                        setTimeout(() => {
                                            textarea.focus();
                                            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                        }, 50);
                                    }} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-all text-sm">{emoji}</button>
                                ))}
                            </div>

                            <div>
                                <textarea 
                                    ref={textareaRef}
                                    placeholder={`Ex: &#10;*Att, João Silva*&#10;_Comercial Pixel_&#10;📞 (11) 99999-9999`}
                                    value={signature}
                                    onChange={(e) => setSignature(e.target.value)}
                                    className="w-full bg-gray-100/50 dark:bg-black/20 border border-transparent dark:border-white/5 p-4 rounded-2xl outline-none text-sm dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 transition-all font-medium min-h-[100px]"
                                    rows={3}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    id="use_signature"
                                    checked={useSignature}
                                    onChange={(e) => setUseSignature(e.target.checked)}
                                    className="w-5 h-5 rounded-lg border-gray-300 text-emerald-500 focus:ring-emerald-500/20"
                                />
                                <label htmlFor="use_signature" className="text-sm font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                                    Habilitar assinatura por padrão
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="w-full xl:w-80 space-y-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Pré-visualização no WhatsApp:</span>
                        <div className="bg-[#efeae2] dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-3xl p-4 shadow-inner relative overflow-hidden h-[150px] flex flex-col justify-end">
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#fff_1px,transparent_1px)]" />
                            <div className="bg-white dark:bg-[#0b141a] text-slate-800 dark:text-gray-100 p-3 rounded-2xl rounded-tr-none shadow-md text-xs relative max-w-[90%] self-end">
                                <p className="text-slate-500 dark:text-gray-400 italic mb-1 opacity-70">Texto da sua mensagem...</p>
                                <div className="border-t border-slate-100 dark:border-white/5 my-1.5" />
                                <div className="leading-relaxed break-words whitespace-pre-wrap text-left">
                                    {renderWhatsAppMarkdown(signature)}
                                </div>
                                <span className="text-[9px] text-slate-400 dark:text-gray-500 block text-right mt-1.5 font-medium">16:45 ✔️✔️</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-end self-end shrink-0 w-full sm:w-auto">
                        <button 
                            onClick={handleSaveSignature} 
                            disabled={loading}
                            className="w-full sm:w-auto justify-center flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:opacity-90 transition-all text-xs font-bold shadow-xl"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : <Save className="w-4 h-4 shrink-0" />}
                            Salvar Assinatura
                        </button>
                    </div>
                </div>
            </div>

            {/* Fluxos de Atendimento Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Layers className="w-6 h-6 text-emerald-500" /> Fluxos de Atendimento (Chatbot)
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-bold opacity-75 uppercase tracking-widest mt-1">
                        Configure árvores de automação e roteamento por setor ou agente.
                    </p>
                </div>
                <button 
                    onClick={handleCreateFlow}
                    className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20"
                >
                    <Plus className="w-4 h-4" /> Novo Fluxo
                </button>
            </div>

            {/* Flow Builder Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Column 1: Flows List (Col-3) */}
                <div className="lg:col-span-3 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-[2rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-2xl flex flex-col h-fit">
                    <div className="p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent font-bold text-[10px] uppercase tracking-[0.2em] text-gray-400">
                        Meus Fluxos
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                        {flows.map(flow => (
                            <div 
                                key={flow.id}
                                onClick={() => { setSelectedFlow(flow); fetchNodes(flow.id); setIsSimulating(false); }}
                                className={`p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors relative group/flow ${selectedFlow?.id === flow.id ? 'bg-emerald-50/50 dark:bg-emerald-500/10' : ''}`}
                            >
                                {selectedFlow?.id === flow.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                                )}
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-sm text-gray-800 dark:text-white truncate block">{flow.name}</span>
                                        {/* Badge ATIVO */}
                                        {flow.is_active && (
                                            <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                <Zap className="w-2.5 h-2.5 fill-white" /> ATIVO
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleToggleActive(flow); }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500"
                                            title={flow.is_active ? "Desativar fluxo" : "Ativar fluxo"}
                                        >
                                            {flow.is_active ? <Play className="w-4 h-4 text-emerald-500 fill-emerald-500" /> : <Pause className="w-4 h-4 text-slate-400" />}
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteFlow(flow.id); }}
                                            className="opacity-0 group-hover/flow:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {flows.length === 0 && (
                            <div className="p-8 text-center text-gray-400 text-xs">
                                Nenhum fluxo criado ainda.
                            </div>
                        )}
                    </div>

                    <div className="m-4 p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl space-y-3">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4" /> Dicas de Fluxo
                        </p>
                        <ul className="text-[10px] text-gray-500 dark:text-gray-400 space-y-2 pl-4 list-decimal font-medium leading-relaxed">
                            <li>Comece sempre com uma <b>Saudação</b>.</li>
                            <li>Use o <b>Menu</b> para estruturar as opções numeradas.</li>
                            <li>Vincule o <b>Próximo Passo</b> de cada opção para criar caminhos.</li>
                            <li>Finalize os nós usando <b>Transferir</b> para encaminhar ao atendente ou fila.</li>
                            <li>Arraste os nós pelo <b>handle</b> ⠿ para reordenar.</li>
                        </ul>
                    </div>

                    <div className="m-4 mt-0 p-5 bg-blue-500/5 border border-blue-500/10 rounded-3xl space-y-3">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-4 h-4" /> Estrutura do JSON
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
                            O arquivo importado deve conter metadados e um array de etapas (nodes).
                        </p>
                        <div className="text-[9px] bg-slate-100 dark:bg-black/30 p-2.5 rounded-xl font-mono text-slate-650 dark:text-slate-400 max-h-36 overflow-y-auto no-scrollbar whitespace-pre-wrap select-all cursor-text">
{`{
  "flow": {
    "name": "Nome do Fluxo",
    "description": "Descrição"
  },
  "nodes": [
    {
      "id": "antigo-uuid-1",
      "type": "greeting",
      "content": { "text": "Olá! Seja bem-vindo." },
      "sort_order": 0
    },
    {
      "id": "antigo-uuid-2",
      "type": "menu",
      "content": {
        "text": "Selecione uma opção:",
        "options": [
          { "label": "1. Falar com Atendente", "next_node": "antigo-uuid-3" }
        ]
      },
      "sort_order": 1
    }
  ]
}`}
                        </div>
                        <ul className="text-[9px] text-gray-500 dark:text-gray-400 space-y-1.5 pl-3 list-disc font-medium leading-normal">
                            <li>O fluxo **deve** começar com uma etapa **Saudação** (`greeting`).</li>
                            <li>A Saudação é imediatamente seguida pelo primeiro **Menu** em ordem.</li>
                            <li>A importação mapeia os IDs antigos para novos UUIDs sem quebrar links.</li>
                        </ul>
                    </div>
                </div>

                {/* Column 2: Editor & Simulator (Col-9) */}
                <div className="lg:col-span-9 space-y-6">
                    {!selectedFlow ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2.5rem] bg-white/50 dark:bg-white/5 shadow-2xl p-10">
                            <MessageSquare className="w-16 h-16 mb-4 opacity-20 text-emerald-500" />
                            <p className="font-bold text-gray-800 dark:text-white uppercase tracking-widest text-xs opacity-65">Nenhum fluxo selecionado</p>
                            <p className="text-xs text-gray-500 mt-2 text-center">Selecione um fluxo de chatbot na barra lateral ou crie um novo para iniciar.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                            {/* Node Editor (Col-8) */}
                            <div className="xl:col-span-8 space-y-6">
                                {/* Toolbar: Save + Simulator */}
                                <div className="flex flex-wrap items-center justify-end gap-3 p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/5 shadow-xl">
                                    <div className="flex items-center gap-2">
                                        {/* Dirty state indicator */}
                                        {dirtyNodeIds.size > 0 && !saveSuccess && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-500/20">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {dirtyNodeIds.size} alteração{dirtyNodeIds.size > 1 ? 'ões' : ''} não salva{dirtyNodeIds.size > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {saveSuccess && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Salvo!
                                            </span>
                                        )}
                                        {/* Save Flow Button */}
                                        <button
                                            onClick={handleSaveFlow}
                                            disabled={dirtyNodeIds.size === 0 || isSavingFlow}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all
                                                ${dirtyNodeIds.size > 0
                                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 cursor-pointer'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed opacity-50'
                                                }`}
                                        >
                                            {isSavingFlow ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Salvar Fluxo
                                        </button>
                                        <button
                                            onClick={handleExportFlow}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all text-xs font-bold shadow-md cursor-pointer"
                                                title="Baixar fluxo para arquivo JSON"
                                        >
                                            <Download className="w-4 h-4" />
                                                Baixar Fluxo
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all text-xs font-bold shadow-md cursor-pointer"
                                                title="Fazer upload de fluxo de arquivo JSON"
                                        >
                                            <Upload className="w-4 h-4" />
                                                Fazer Upload
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImportFlow}
                                            accept=".json"
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => loadTemplate('practical_example')}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer"
                                            title="Carregar Exemplo Prático com Saudação, Menus e Agentes"
                                        >
                                            <Zap className="w-4 h-4" />
                                            Exemplo Prático
                                        </button>
                                        <button
                                            onClick={isSimulating ? resetSimulation : startSimulation}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer"
                                        >
                                            <Smartphone className="w-4 h-4" />
                                            {isSimulating ? 'Reiniciar' : 'Simular'}
                                        </button>
                                    </div>
                                </div>

                                {/* Node Creation Toolbar */}
                                <div className="flex gap-2.5 p-2 bg-gray-100 dark:bg-white/5 rounded-2xl border border-transparent dark:border-white/5 shadow-inner">
                                    <button onClick={() => handleAddNode('greeting')} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold bg-white dark:bg-white/10 rounded-xl shadow-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                        <MessageSquare className="w-4 h-4" /> Saudação
                                    </button>
                                    <button onClick={() => handleAddNode('menu')} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold bg-white dark:bg-white/10 rounded-xl shadow-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                        <List className="w-4 h-4" /> Menu
                                    </button>
                                    <button onClick={() => handleAddNode('transfer_queue')} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold bg-white dark:bg-white/10 rounded-xl shadow-md hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                        <Users className="w-4 h-4" /> Setor
                                    </button>
                                    <button onClick={() => handleAddNode('transfer_user')} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold bg-white dark:bg-white/10 rounded-xl shadow-md hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors uppercase tracking-wider text-orange-600 dark:text-orange-400">
                                        <UserPlus className="w-4 h-4" /> Agente
                                    </button>
                                    <button onClick={() => handleAddNode('message')} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold bg-white dark:bg-white/10 rounded-xl shadow-md hover:bg-slate-50 dark:hover:bg-slate-500/10 transition-colors uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        <Send className="w-4 h-4" /> Mensagem
                                    </button>
                                </div>

                                {/* Active Flow Header in Editor */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/5 shadow-xl">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={selectedFlow.name}
                                                onChange={(e) => {
                                                    const updated = { ...selectedFlow, name: e.target.value };
                                                    setSelectedFlow(updated);
                                                    setFlows(flows.map(f => f.id === selectedFlow.id ? updated : f));
                                                    setDirtyNodeIds(prev => new Set([...prev, 'flow-meta']));
                                                }}
                                                placeholder="Nome do fluxo..."
                                                className="bg-transparent border-b border-dashed border-gray-300 dark:border-white/10 hover:border-gray-500 focus:border-emerald-500 outline-none text-base font-bold text-gray-800 dark:text-white px-1 py-0.5 w-full md:w-64"
                                            />
                                            {selectedFlow.is_active ? (
                                                <button
                                                    onClick={() => handleToggleActive(selectedFlow)}
                                                    className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wide shadow-md shadow-emerald-500/30 transition-all"
                                                    title="Clique para desativar este fluxo"
                                                >
                                                    <Zap className="w-2.5 h-2.5 fill-white" /> ATIVO
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleToggleActive(selectedFlow)}
                                                    className="inline-flex items-center gap-1 text-[9px] font-bold bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full uppercase tracking-wide transition-all"
                                                    title="Clique para ativar este fluxo"
                                                >
                                                    Inativo (Ativar)
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={selectedFlow.description || ''}
                                            placeholder="Descrição do fluxo (opcional)..."
                                            onChange={(e) => {
                                                const updated = { ...selectedFlow, description: e.target.value };
                                                setSelectedFlow(updated);
                                                setFlows(flows.map(f => f.id === selectedFlow.id ? updated : f));
                                                setDirtyNodeIds(prev => new Set([...prev, 'flow-meta']));
                                            }}
                                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none text-xs text-gray-500 dark:text-gray-400 px-1 py-0.5 w-full"
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl shrink-0">{nodes.length} etapa{nodes.length !== 1 ? 's' : ''}</span>
                                </div>

                                {/* Nodes List with Drag-and-Drop + SVG Connectors */}
                                <div className="space-y-0 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {nodes.map((node, idx) => {
                                        const meta = getNodeMeta(node.type);
                                        const isDragging = dragSourceId === node.id;
                                        const isOver = dragOverId === node.id && dragSourceId !== node.id;
                                        const isDirty = dirtyNodeIds.has(node.id);
                                        const prevNode = idx > 0 ? nodes[idx - 1] : undefined;

                                        return (
                                            <div key={node.id}>
                                                {/* SVG connector above each node (except first), colored by previous node type */}
                                                {idx > 0 && <NodeConnector fromNode={prevNode} />}

                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, node.id)}
                                                    onDragOver={(e) => handleDragOver(e, node.id)}
                                                    onDrop={(e) => handleDrop(e, node.id)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`
                                                        bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 
                                                        relative group shadow-lg transition-all hover:shadow-xl ${meta.borderClass}
                                                        ${isDragging ? 'opacity-40 scale-95' : ''}
                                                        ${isOver ? 'ring-2 ring-emerald-400 dark:ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' : ''}
                                                    `}
                                                >
                                                    {/* Dirty indicator dot */}
                                                    {isDirty && (
                                                        <div className="absolute top-3 right-12 w-2 h-2 bg-amber-400 rounded-full" title="Alteração não salva" />
                                                    )}

                                                    {/* Action buttons */}
                                                    <div className="absolute top-4 right-4 flex gap-2 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleDeleteNode(node.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-3 mb-4">
                                                        {/* Drag handle */}
                                                        <div
                                                            className="cursor-grab active:cursor-grabbing p-1.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors touch-none"
                                                            title="Arraste para reordenar"
                                                        >
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <span className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-white/10 rounded-full text-xs font-bold text-slate-500 dark:text-gray-400">
                                                            #{idx + 1}
                                                        </span>
                                                        <span className={`text-xs font-bold uppercase tracking-widest ${meta.titleColor}`}>
                                                            {meta.label}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-4 ml-10">
                                                        {(node.type === 'greeting' || node.type === 'menu' || node.type === 'message') && (
                                                            <textarea 
                                                                value={node.content.text}
                                                                onChange={(e) => handleUpdateNode(node.id, { ...node.content, text: e.target.value })}
                                                                placeholder="Digite a mensagem do robô..."
                                                                className="w-full p-4 text-sm bg-gray-50 dark:bg-black/10 border border-transparent dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium resize-none placeholder:text-gray-400"
                                                                rows={3}
                                                            />
                                                        )}

                                                        {node.type === 'menu' && (
                                                            <div className="space-y-3 pl-5 border-l-2 border-blue-200 dark:border-blue-500/20">
                                                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Opções de Roteamento</p>
                                                                {(node.content.options || []).map((opt: any, optIdx: number) => (
                                                                    <div key={optIdx} className="flex gap-3 items-center animate-in fade-in duration-200">
                                                                        <input
                                                                            type="text"
                                                                            value={opt.label}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...node.content.options];
                                                                                newOpts[optIdx] = { ...opt, label: e.target.value };
                                                                                handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                            }}
                                                                            placeholder={`Opção ${optIdx + 1}`}
                                                                            className="flex-1 p-3 text-xs bg-gray-50 dark:bg-black/10 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500/20 dark:text-white font-semibold"
                                                                        />
                                                                        <select
                                                                            value={opt.next_node}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...node.content.options];
                                                                                newOpts[optIdx] = { ...opt, next_node: e.target.value };
                                                                                handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                            }}
                                                                            className="w-40 p-3 text-xs bg-gray-50 dark:bg-black/10 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500/20 dark:text-white font-semibold cursor-pointer"
                                                                        >
                                                                            <option value="">Próximo Passo</option>
                                                                            {nodes.filter(n => n.id !== node.id).map((n) => {
                                                                                const originalIdx = nodes.findIndex(org => org.id === n.id);
                                                                                return (
                                                                                    <option key={n.id} value={n.id} className="dark:bg-slate-900">
                                                                                        Passo #{originalIdx + 1} ({translateType(n.type)})
                                                                                    </option>
                                                                                );
                                                                            })}
                                                                        </select>
                                                                        <button 
                                                                            onClick={() => {
                                                                                const newOpts = node.content.options.filter((_: any, i: number) => i !== optIdx);
                                                                                handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                            }}
                                                                            className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                {/* Visual hint for menu connections */}
                                                                {(node.content.options || []).length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                                        {(node.content.options || []).map((opt: any, optIdx: number) => {
                                                                            const targetNode = nodes.find(n => n.id === opt.next_node);
                                                                            const targetIdx = targetNode ? nodes.findIndex(n => n.id === opt.next_node) : -1;
                                                                            if (!targetNode) return null;
                                                                            return (
                                                                                <span key={optIdx} className="text-[9px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-1 rounded-full border border-blue-200 dark:border-blue-500/20 flex items-center gap-1">
                                                                                    <ArrowDown className="w-2.5 h-2.5" />
                                                                                    Op {optIdx + 1} → Passo #{targetIdx + 1}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                <button 
                                                                    onClick={() => {
                                                                        const newOpts = [...(node.content.options || []), { label: '', next_node: '' }];
                                                                        handleUpdateNode(node.id, { ...node.content, options: newOpts });
                                                                    }}
                                                                    className="text-[10px] text-blue-500 font-bold hover:underline tracking-widest uppercase flex items-center gap-1"
                                                                >
                                                                    + Adicionar Opção do Menu
                                                                </button>
                                                            </div>
                                                        )}

                                                        {node.type === 'transfer_queue' && (
                                                            <div className="space-y-3">
                                                                <textarea 
                                                                    value={node.content.text || ''}
                                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, text: e.target.value })}
                                                                    placeholder="Mensagem antes de transferir..."
                                                                    className="w-full p-4 text-sm bg-gray-50 dark:bg-black/10 border border-transparent dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium resize-none placeholder:text-gray-400"
                                                                    rows={2}
                                                                />
                                                                <select 
                                                                    value={node.content.queue_id || ''}
                                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, queue_id: e.target.value })}
                                                                    className="w-full p-3.5 text-sm bg-gray-50 dark:bg-black/10 border border-transparent rounded-2xl dark:text-white font-semibold cursor-pointer"
                                                                >
                                                                    <option value="">Selecione o Setor / Fila de Destino...</option>
                                                                    {queues.map(q => <option key={q.id} value={q.id} className="dark:bg-slate-900">{q.name}</option>)}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {node.type === 'transfer_user' && (
                                                            <div className="space-y-3">
                                                                <textarea 
                                                                    value={node.content.text || ''}
                                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, text: e.target.value })}
                                                                    placeholder="Mensagem antes de transferir..."
                                                                    className="w-full p-4 text-sm bg-gray-50 dark:bg-black/10 border border-transparent dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium resize-none placeholder:text-gray-400"
                                                                    rows={2}
                                                                />
                                                                <select 
                                                                    value={node.content.user_id || ''}
                                                                    onChange={(e) => handleUpdateNode(node.id, { ...node.content, user_id: e.target.value })}
                                                                    className="w-full p-3.5 text-sm bg-gray-50 dark:bg-black/10 border border-transparent rounded-2xl dark:text-white font-semibold cursor-pointer"
                                                                >
                                                                    <option value="">Selecione o Atendente de Destino...</option>
                                                                    {team.map(u => <option key={u.id} value={u.id} className="dark:bg-slate-900">{u.full_name}</option>)}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {nodes.length === 0 && (
                                        <div className="p-10 text-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-3xl bg-white/30 dark:bg-white/5">
                                            Nenhuma etapa configurada neste fluxo. Clique nos botões acima para construir seu chatbot!
                                        </div>
                                    )}
                                </div>

                                {/* Bottom save button if there are dirty nodes */}
                                {dirtyNodeIds.size > 0 && (
                                    <div className="sticky bottom-4 flex justify-center z-10">
                                        <button
                                            onClick={handleSaveFlow}
                                            disabled={isSavingFlow}
                                            className="flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-2xl shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-100"
                                        >
                                            {isSavingFlow ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Salvar {dirtyNodeIds.size} alteração{dirtyNodeIds.size > 1 ? 'ões' : ''}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Simulator Sidebar (Col-4) */}
                            <div className="xl:col-span-4">
                                {isSimulating ? (
                                    <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border-4 border-slate-800 flex flex-col h-[65vh] animate-in slide-in-from-right duration-500">
                                        <div className="px-4 py-3 bg-slate-800 rounded-3xl flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">🤖</div>
                                                <div>
                                                    <h5 className="text-white text-xs font-bold leading-tight">WhatsPanda Bot</h5>
                                                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Simulador Ativo</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setIsSimulating(false)} className="text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-wider">
                                                Fechar
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto px-2 space-y-3 custom-scrollbar flex flex-col justify-end">
                                            <div className="space-y-3">
                                                {simHistory.map((msg) => {
                                                    if (msg.sender === 'system') {
                                                        return (
                                                            <div key={msg.id} className="text-center py-1">
                                                                <span className="bg-indigo-500/20 text-indigo-200 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-indigo-500/30 shadow-inner block w-fit mx-auto">
                                                                    {msg.text}
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    const isBot = msg.sender === 'bot';
                                                    return (
                                                        <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                                                            <div className={`p-3 rounded-2xl text-xs max-w-[85%] font-medium ${isBot ? 'bg-slate-800 text-slate-100 rounded-tl-sm' : 'bg-emerald-600 text-white rounded-tr-sm'}`}>
                                                                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {currentNode?.type === 'menu' && currentNode.content.options?.length > 0 && (
                                            <div className="p-3 bg-slate-800/50 rounded-3xl mt-4 space-y-2 border border-slate-800">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Responda ao Bot:</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {currentNode.content.options.map((opt: any, i: number) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => handleSimulateOption(opt)}
                                                            className="px-3 py-2 text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-xl text-left border border-slate-700/50 transition-colors w-full flex justify-between items-center group"
                                                        >
                                                            <span>{opt.label || `Opção ${i + 1}`}</span>
                                                            <Send className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                                            <span>Simulador Local Client-Side</span>
                                            <button onClick={resetSimulation} className="text-emerald-500 font-bold hover:underline">Reiniciar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="hidden xl:flex flex-col items-center justify-center p-8 bg-slate-950/20 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/5 text-gray-400 text-center h-[50vh]">
                                        <Smartphone className="w-12 h-12 mb-3 text-slate-400 opacity-30" />
                                        <h5 className="text-xs font-bold uppercase tracking-widest mb-1 text-slate-500">Simulador de Conversa</h5>
                                        <p className="text-[10px] text-gray-500 leading-relaxed max-w-[200px]">Clique em "Simular" acima para carregar o mockup interativo do robô.</p>
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

