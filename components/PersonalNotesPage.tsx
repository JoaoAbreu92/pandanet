import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';

interface PersonalNotesPageProps {
    currentUser: Employee;
    isGhostMode: boolean;
}

interface Note {
    id: string;
    user_id: string;
    title: string;
    content: string;
    category: string;
    created_at: string;
    updated_at: string;
}

const PersonalNotesPage: React.FC<PersonalNotesPageProps> = ({ currentUser, isGhostMode }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);
    
    // Estados do formulário de edição/criação
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // SQL Script para exibição em caso de erro de tabela inexistente
    const sqlInstruction = `-- CRIE A TABELA DE NOTAS PESSOAIS NO SEU BANCO DE DADOS
CREATE TABLE IF NOT EXISTS personal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Nota',
    content TEXT NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'Geral',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE personal_notes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can manage their own personal notes" 
ON personal_notes 
FOR ALL 
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'Super Admin' OR profiles.email = 'ti@grupopixel.com.br')
    )
)
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'Super Admin' OR profiles.email = 'ti@grupopixel.com.br')
    )
);`;

    // 1. Carregar notas do Supabase
    const fetchNotes = async () => {
        setIsLoading(true);
        setDbError(null);
        try {
            const { data, error } = await supabase
                .from('personal_notes')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('updated_at', { ascending: false });

            if (error) {
                // Código 42P01 significa tabela inexistente no PostgreSQL
                if (error.code === '42P01') {
                    setDbError('Tabela de notas pessoais não encontrada no banco de dados.');
                } else {
                    throw error;
                }
            } else if (data) {
                setNotes(data);
                if (data.length > 0 && !selectedNote) {
                    selectNote(data[0]);
                }
            }
        } catch (err: any) {
            console.error('Error fetching notes:', err);
            setDbError(err.message || 'Erro ao carregar as notas pessoais.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
        // Limpar timeouts ao desmontar
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [currentUser.id]);

    // Selecionar nota para exibição/edição
    const selectNote = (note: Note) => {
        setSelectedNote(note);
        setEditTitle(note.title);
        setEditContent(note.content);
        setEditCategory(note.category);
        setShowNewCategoryInput(false);
        setNewCategoryName('');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };

    // 2. Criar nova nota
    const handleCreateNote = async () => {
        setDbError(null);
        try {
            const newNote = {
                user_id: currentUser.id,
                title: 'Nova Nota',
                content: '',
                category: 'Geral'
            };

            const { data, error } = await supabase
                .from('personal_notes')
                .insert(newNote)
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setNotes([data, ...notes]);
                selectNote(data);
            }
        } catch (err: any) {
            console.error('Error creating note:', err);
            alert('Não foi possível criar a nota. Verifique se o script SQL de instalação foi executado no seu banco de dados.');
        }
    };

    // 3. Atualizar nota no banco (com debounce)
    const triggerAutoSave = (updatedFields: Partial<Note>) => {
        if (!selectedNote) return;

        // Atualizar estado local de forma imediata para responsividade na UI
        const updatedNote = { ...selectedNote, ...updatedFields } as Note;
        setSelectedNote(updatedNote);
        setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));

        // Cancelar salvamento pendente anterior
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        setIsSaving(true);
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('personal_notes')
                    .update({
                        title: updatedFields.title ?? editTitle,
                        content: updatedFields.content ?? editContent,
                        category: updatedFields.category ?? editCategory,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', selectedNote.id);

                if (error) throw error;
            } catch (err) {
                console.error('Error auto-saving note:', err);
            } finally {
                setIsSaving(false);
            }
        }, 1200); // 1.2s de debounce
    };

    // 4. Excluir nota
    const handleDeleteNote = async (noteId: string) => {
        if (!window.confirm('Tem certeza de que deseja excluir esta nota pessoal permanentemente?')) return;

        setDbError(null);
        try {
            const { error } = await supabase
                .from('personal_notes')
                .delete()
                .eq('id', noteId);

            if (error) throw error;

            const remainingNotes = notes.filter(n => n.id !== noteId);
            setNotes(remainingNotes);
            
            if (selectedNote?.id === noteId) {
                if (remainingNotes.length > 0) {
                    selectNote(remainingNotes[0]);
                } else {
                    setSelectedNote(null);
                    setEditTitle('');
                    setEditContent('');
                    setEditCategory('');
                }
            }
        } catch (err: any) {
            console.error('Error deleting note:', err);
            alert('Erro ao excluir a nota.');
        }
    };

    // Extrair lista única de categorias
    const categories = ['Todas', ...Array.from(new Set(notes.map(n => n.category)))];

    // Filtrar notas baseado na categoria e busca por termo
    const filteredNotes = notes.filter(note => {
        const matchesCategory = selectedCategory === 'Todas' || note.category === selectedCategory;
        const matchesSearch = 
            note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            note.content.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const formatShortDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) {
            return '';
        }
    };

    const handleCopySQL = () => {
        navigator.clipboard.writeText(sqlInstruction);
        alert('Script SQL copiado com sucesso! Execute-o no console SQL do seu Supabase.');
    };

    // Se houver erro de tabela inexistente
    if (dbError && dbError.includes('não encontrada')) {
        return (
            <div className="max-w-4xl mx-auto p-6 animate-fade-in">
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                    <div className="flex items-center gap-4 text-red-500 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                        </svg>
                        <div>
                            <h2 className="text-xl font-bold dark:text-white">Instalação Necessária - Bloco de Notas</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Como você utiliza um banco de dados hospedado por conta própria (self-hosted), é necessário criar a tabela de Notas Pessoais.</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#1e293b] rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Script SQL de Criação</span>
                            <button
                                onClick={handleCopySQL}
                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-1.5"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25D" />
                                </svg>
                                Copiar SQL
                            </button>
                        </div>
                        <pre className="text-xs text-slate-600 dark:text-slate-300 font-mono overflow-x-auto max-h-[300px] leading-relaxed custom-scrollbar">
                            {sqlInstruction}
                        </pre>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">Após rodar o script SQL no editor do Supabase, você pode recarregar a página.</p>
                        <button
                            onClick={fetchNotes}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto h-[calc(100vh-10rem)] min-h-[500px] flex flex-col md:flex-row gap-6 animate-fade-in font-brand">
            
            {/* Barra Lateral Esquerda: Categorias e Lista de Notas */}
            <div className="w-full md:w-80 flex flex-col bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-shrink-0 shadow-sm">
                
                {/* Cabeçalho da Barra Lateral */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-3">
                    {isGhostMode && (
                        <div className="bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider rounded-lg p-2 text-center border border-amber-500/25">
                            👁️ Modo de Auditoria Ghost
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span>📝</span> Bloco de Notas
                        </h2>
                        <button
                            onClick={handleCreateNote}
                            className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-xs font-bold flex items-center gap-1"
                            title="Nova Nota"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Nova
                        </button>
                    </div>

                    {/* Campo de Busca */}
                    <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar notas..."
                            className="w-full pl-9 pr-4 py-1.5 border-0 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>
                </div>

                {/* Filtro de Categorias */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto custom-scrollbar flex-shrink-0">
                    {categories.map((cat) => {
                        const count = cat === 'Todas' ? notes.length : notes.filter(n => n.category === cat).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-emerald-500 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-slate-300'}`}
                            >
                                {cat} ({count})
                            </button>
                        );
                    })}
                </div>

                {/* Lista de Notas */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                            <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                            <span className="text-[10px] font-semibold tracking-wider uppercase">Carregando notas...</span>
                        </div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center p-4">
                            <span className="text-2xl mb-1.5">📭</span>
                            <p className="text-xs font-bold">Nenhuma nota encontrada</p>
                            <p className="text-[10px] opacity-75 mt-0.5">Crie uma nova nota para começar.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {filteredNotes.map((note) => (
                                <button
                                    key={note.id}
                                    onClick={() => selectNote(note)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedNote?.id === note.id ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 shadow-sm' : 'bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-800/40 border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start gap-1">
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex-1">{note.title || 'Sem Título'}</h3>
                                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-bold uppercase tracking-wide">{note.category}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-1 line-clamp-1">
                                        {note.content || 'Sem conteúdo...'}
                                    </p>
                                    <div className="flex justify-between items-center mt-2.5 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/40 text-[9px] text-slate-400">
                                        <span>Atualizado em {formatShortDate(note.updated_at)}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteNote(note.id);
                                            }}
                                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                                            title="Excluir Nota"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Painel da Direita: Visualização e Edição da Nota */}
            <div className="flex-1 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
                {selectedNote ? (
                    <div className="flex-1 flex flex-col h-full">
                        {/* Cabeçalho da Nota */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => {
                                        setEditTitle(e.target.value);
                                        triggerAutoSave({ title: e.target.value });
                                    }}
                                    placeholder="Título da nota..."
                                    className="w-full text-base sm:text-lg font-bold border-0 bg-transparent text-slate-800 dark:text-white focus:outline-none focus:ring-0 p-0"
                                />
                            </div>
                            
                            {/* Controle de Categoria */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria:</span>
                                {!showNewCategoryInput ? (
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={editCategory}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '__new__') {
                                                    setShowNewCategoryInput(true);
                                                } else {
                                                    setEditCategory(val);
                                                    triggerAutoSave({ category: val });
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-100 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                        >
                                            <option value="Geral">Geral</option>
                                            <option value="Senhas">Senhas</option>
                                            <option value="Observações">Observações</option>
                                            <option value="Trabalho">Trabalho</option>
                                            {/* Listar categorias personalizadas criadas */}
                                            {Array.from(new Set(notes.map(n => n.category)))
                                                .filter(c => !['Geral', 'Senhas', 'Observações', 'Trabalho'].includes(c))
                                                .map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))
                                            }
                                            <option value="__new__">+ Nova Categoria...</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="Nome da categoria..."
                                            className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-36"
                                        />
                                        <button
                                            onClick={() => {
                                                const cat = newCategoryName.trim();
                                                if (cat) {
                                                    setEditCategory(cat);
                                                    triggerAutoSave({ category: cat });
                                                    setShowNewCategoryInput(false);
                                                }
                                            }}
                                            className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                                            title="Confirmar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => setShowNewCategoryInput(false)}
                                            className="p-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300"
                                            title="Cancelar"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Editor de Texto (Textarea Premium) */}
                        <div className="flex-1 p-4 relative">
                            <textarea
                                value={editContent}
                                onChange={(e) => {
                                    setEditContent(e.target.value);
                                    triggerAutoSave({ content: e.target.value });
                                }}
                                placeholder="Comece a digitar suas notas aqui (senhas, anotações, lembretes)..."
                                className="w-full h-full border-0 bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-0 p-0 text-sm leading-relaxed resize-none custom-scrollbar"
                            />
                            
                            {/* Indicador de Salvamento Debounce */}
                            <div className="absolute right-4 bottom-4 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1.5">
                                {isSaving ? (
                                    <>
                                        <div className="w-2 h-2 border border-slate-300 border-t-emerald-500 rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span>Salvo automaticamente</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/20 dark:bg-slate-900/10">
                        <span className="text-5xl animate-bounce-slow mb-3">🗒️</span>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nenhuma Nota Selecionada</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">Selecione uma nota na barra lateral ou crie uma nova para guardar suas anotações, senhas e lembretes.</p>
                        <button
                            onClick={handleCreateNote}
                            className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Criar Minha Primeira Nota
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalNotesPage;
