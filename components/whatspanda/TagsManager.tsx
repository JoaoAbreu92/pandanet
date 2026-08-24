import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Tag, X, Plus } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { WhatsAppTag, WhatsAppConversationTag } from '../../types';

interface TagsManagerProps {
  conversationId: string;
}

type TagScope = 'personal' | 'department' | 'global';

const TagsManager: React.FC<TagsManagerProps> = ({ conversationId }) => {
  const { profile } = useAuth();
  const [availableTags, setAvailableTags] = useState<WhatsAppTag[]>([]);
  const [conversationTags, setConversationTags] = useState<WhatsAppConversationTag[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedScope, setSelectedScope] = useState<TagScope>('personal');
  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.isAdmin || profile?.isCompanyAdmin;
  const canManageTags = isAdmin || profile?.whatspanda_permissions?.can_manage_tags;

  useEffect(() => {
    fetchAvailableTags();
    fetchConversationTags();
  }, [conversationId]);

  const fetchAvailableTags = async () => {
    const { data, error } = await supabase
      .from('whatsapp_tags')
      .select('*')
      .eq('is_active', true)
      .eq('company_id', profile?.company_id)
      .order('name');

    if (data) setAvailableTags(data);
    if (error) console.error('Error fetching tags:', error);
  };

  const fetchConversationTags = async () => {
    const { data, error } = await supabase
      .from('whatsapp_conversation_tags')
      .select(`
        *,
        tag:whatsapp_tags(*)
      `)
      .eq('conversation_id', conversationId);

    if (data) setConversationTags(data);
    if (error) console.error('Error fetching conversation tags:', error);
  };

  const handleAddTag = async () => {
    if (!selectedTagId || !canManageTags) return;

    setLoading(true);

    const tagData: any = {
      conversation_id: conversationId,
      tag_id: selectedTagId,
      company_id: profile?.company_id,
      created_by: profile?.id
    };

    // Set scope
    if (selectedScope === 'personal') {
      tagData.user_id = profile?.id;
      tagData.department_id = null;
    } else if (selectedScope === 'department') {
      tagData.user_id = null;
      tagData.department_id = profile?.department_id;
    } else {
      // global - only admins
      tagData.user_id = null;
      tagData.department_id = null;
    }

    const { error } = await supabase
      .from('whatsapp_conversation_tags')
      .insert(tagData);

    if (!error) {
      setSelectedTagId('');
      setShowAddMenu(false);
      fetchConversationTags();
    } else {
      console.error('Error adding tag:', error);
      alert('Erro ao adicionar etiqueta');
    }

    setLoading(false);
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!canManageTags) return;

    setLoading(true);
    const { error } = await supabase
      .from('whatsapp_conversation_tags')
      .delete()
      .eq('id', tagId);

    if (!error) {
      fetchConversationTags();
    } else {
      console.error('Error removing tag:', error);
      alert('Erro ao remover etiqueta');
    }
    setLoading(false);
  };

  const getTagScopeLabel = (tag: WhatsAppConversationTag) => {
    if (tag.user_id) return '(Pessoal)';
    if (tag.department_id) return '(Setor)';
    return '(Global)';
  };

  const canRemoveTag = (tag: WhatsAppConversationTag) => {
    if (isAdmin) return true;
    return tag.created_by === profile?.id;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Etiquetas
        </h4>
        {canManageTags && (
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
            title="Adicionar etiqueta"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Add Tag Menu */}
      {showAddMenu && canManageTags && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Etiqueta
            </label>
            <select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="">Selecione uma etiqueta...</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Visibilidade
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="personal"
                  checked={selectedScope === 'personal'}
                  onChange={() => setSelectedScope('personal')}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Apenas eu vejo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="department"
                  checked={selectedScope === 'department'}
                  onChange={() => setSelectedScope('department')}
                  className="text-green-600 focus:ring-green-500"
                  disabled={!profile?.department_id}
                />
                <span className={`text-sm ${!profile?.department_id ? 'text-gray-400' : 'text-gray-700'}`}>
                  Todo o meu setor vê
                </span>
              </label>
              {isAdmin && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="global"
                    checked={selectedScope === 'global'}
                    onChange={() => setSelectedScope('global')}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Todos veem (Global)</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddTag}
              disabled={!selectedTagId || loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
            <button
              onClick={() => {
                setShowAddMenu(false);
                setSelectedTagId('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="flex flex-wrap gap-2">
        {conversationTags.length === 0 ? (
          <p className="text-xs text-gray-400 italic w-full text-center py-4">
            Nenhuma etiqueta adicionada
          </p>
        ) : (
          conversationTags.map((convTag) => {
            const tag = convTag.tag || availableTags.find(t => t.id === convTag.tag_id);
            if (!tag) return null;

            return (
              <div
                key={convTag.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium group"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                  border: `1px solid ${tag.color}40`
                }}
              >
                <span>{tag.name}</span>
                <span className="text-[10px] opacity-60">
                  {getTagScopeLabel(convTag)}
                </span>
                {canRemoveTag(convTag) && (
                  <button
                    onClick={() => handleRemoveTag(convTag.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-full p-0.5 transition-all"
                    disabled={loading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TagsManager;
