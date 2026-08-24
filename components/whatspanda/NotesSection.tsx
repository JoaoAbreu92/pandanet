import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { WhatsAppContactNote } from '../../types';

interface NotesSectionProps {
  conversationId: string;
}

const NotesSection: React.FC<NotesSectionProps> = ({ conversationId }) => {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<WhatsAppContactNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [conversationId]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('whatsapp_contact_notes')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', profile?.id) // Only user's own notes
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    if (error) console.error('Error fetching notes:', error);
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from('whatsapp_contact_notes')
      .insert({
        conversation_id: conversationId,
        user_id: profile?.id,
        company_id: profile?.company_id,
        note_text: newNoteText.trim()
      });

    if (!error) {
      setNewNoteText('');
      fetchNotes();
    } else {
      console.error('Error adding note:', error);
      alert('Erro ao adicionar nota');
    }
    setLoading(false);
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editText.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from('whatsapp_contact_notes')
      .update({ note_text: editText.trim() })
      .eq('id', noteId);

    if (!error) {
      setEditingNoteId(null);
      setEditText('');
      fetchNotes();
    } else {
      console.error('Error updating note:', error);
      alert('Erro ao atualizar nota');
    }
    setLoading(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('whatsapp_contact_notes')
      .delete()
      .eq('id', noteId);

    if (!error) {
      fetchNotes();
    } else {
      console.error('Error deleting note:', error);
      alert('Erro ao excluir nota');
    }
    setLoading(false);
  };

  const startEdit = (note: WhatsAppContactNote) => {
    setEditingNoteId(note.id);
    setEditText(note.note_text);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-700 uppercase">
          Minhas Notas Privadas
        </h4>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {notes.length}
        </span>
      </div>

      {/* Add New Note */}
      <div className="space-y-2">
        <textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder="Adicionar uma nota privada..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm resize-none"
          rows={3}
        />
        <button
          onClick={handleAddNote}
          disabled={!newNoteText.trim() || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Adicionar Nota
        </button>
      </div>

      {/* Notes List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 italic">
            Nenhuma nota ainda. Adicione uma nota privada sobre este contato.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2"
            >
              {editingNoteId === note.id ? (
                // Edit Mode
                <>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                // View Mode
                <>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {note.note_text}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-yellow-200">
                    <span className="text-xs text-gray-500">
                      {new Date(note.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Editar nota"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir nota"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesSection;
