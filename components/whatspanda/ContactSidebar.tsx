import React, { useState } from 'react';
import { X, User, Phone, Mail, MapPin, Calendar, Image as ImageIcon } from 'lucide-react';
import NotesSection from './NotesSection';
import TagsManager from './TagsManager';
import { WhatsAppConversation } from '../../types';

interface ContactSidebarProps {
  conversation: WhatsAppConversation | null;
  onClose: () => void;
}

const ContactSidebar: React.FC<ContactSidebarProps> = ({ conversation, onClose }) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  if (!conversation) return null;

  // Generate a profile image URL (placeholder or from WhatsApp API)
  const getProfileImage = () => {
    // In a real implementation, this would come from WhatsApp contact data
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.contact_name)}&background=10b981&color=fff&size=200`;
  };

  const handleImageClick = () => {
    setProfileImageUrl(getProfileImage());
    setShowImageModal(true);
  };

  return (
    <>
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-white">
          <h3 className="text-lg font-bold text-gray-900">Informações do Contato</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-col items-center">
            <div
              onClick={handleImageClick}
              className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center cursor-pointer hover:ring-4 hover:ring-green-200 transition-all group relative"
            >
              <img
                src={getProfileImage()}
                alt={conversation.contact_name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <h4 className="mt-4 text-xl font-bold text-gray-900">{conversation.contact_name}</h4>
            <p className="text-sm text-gray-500">{conversation.contact_phone}</p>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <h5 className="text-sm font-bold text-gray-700 uppercase">Informações Básicas</h5>
            
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Telefone</p>
                <p className="text-sm text-gray-900">{conversation.contact_phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Última Mensagem</p>
                <p className="text-sm text-gray-900">
                  {new Date(conversation.last_message_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Status</p>
                <p className="text-sm">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    conversation.status === 'aberto' ? 'bg-green-100 text-green-800' :
                    conversation.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1)}
                  </span>
                </p>
              </div>
            </div>

            {conversation.unread_count > 0 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-white font-bold">{conversation.unread_count}</span>
                </div>
                <div>
                  <p className="text-xs text-green-700 font-medium">Mensagens não lidas</p>
                </div>
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="border-t border-gray-200 pt-6">
            <TagsManager conversationId={conversation.id} />
          </div>

          {/* Notes Section */}
          <div className="border-t border-gray-200 pt-6">
            <NotesSection conversationId={conversation.id} />
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && profileImageUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={profileImageUrl}
              alt={conversation.contact_name}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 rounded-b-lg">
              <h3 className="text-white text-2xl font-bold">{conversation.contact_name}</h3>
              <p className="text-gray-300">{conversation.contact_phone}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContactSidebar;
