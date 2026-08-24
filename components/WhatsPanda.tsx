import React, { useState } from 'react';
import { 
  MessageCircle, 
  Users,
  PlusCircle,
  QrCode,
  Settings as SettingsIcon,
  LayoutGrid
} from 'lucide-react';
import Chat from './whatspanda/Chat';
import Contacts from './whatspanda/Contacts';
import NewTicket from './whatspanda/NewTicket';
import Channels from './whatspanda/Channels';
import Settings from './whatspanda/Settings';

import { useAuth } from './AuthContext';

type View = 'chat' | 'contacts' | 'new-ticket' | 'channels' | 'settings';

const WhatsPanda: React.FC = () => {
  const { profile } = useAuth();
  const [currentView, setCurrentView] = useState<View>('chat');

  const permissions = profile?.whatspanda_permissions || {
    can_view_contacts: false,
    can_edit_contacts: false,
    can_view_chats: false,
    can_send_messages: false,
    can_send_media: false,
    can_manage_settings: false
  };

  // Admin override
  if (profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin') {
    permissions.can_view_contacts = true;
    permissions.can_edit_contacts = true;
    permissions.can_view_chats = true;
    permissions.can_send_messages = true;
    permissions.can_send_media = true;
    permissions.can_manage_settings = true;
  }

  const menuItems = [
    ...(permissions.can_view_chats ? [{ id: 'chat', label: 'Conversas', icon: MessageCircle, view: 'chat' }] : []),
    ...(permissions.can_view_contacts ? [{ id: 'contacts', label: 'Contatos', icon: Users, view: 'contacts' }] : []),
    ...(permissions.can_manage_settings ? [{ id: 'channels', label: 'Canais', icon: QrCode, view: 'channels' }] : []),
    ...(permissions.can_manage_settings ? [{ id: 'settings', label: 'Configurações', icon: SettingsIcon, view: 'settings' }] : []),
  ];

  // Set default view if current is invalid
  React.useEffect(() => {
    const validViews = menuItems.map(item => item.view);
    if (!validViews.includes(currentView) && validViews.length > 0) {
      setCurrentView(validViews[0] as View);
    }
  }, [permissions, currentView]);

  const renderView = () => {
    if (menuItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
          <p>Você não tem permissão para acessar o WhatsPanda.</p>
        </div>
      );
    }

    switch (currentView) {
      case 'chat': return permissions.can_view_chats ? <Chat /> : null;
      case 'contacts': return permissions.can_view_contacts ? <Contacts /> : null;
      case 'channels': return permissions.can_manage_settings ? <Channels /> : null;
      case 'settings': return permissions.can_manage_settings ? <Settings /> : null;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative">
      {/* WhatsPanda Sub-Sidebar - Hidden on small screens to save space */}
      <div className="hidden md:flex w-20 bg-white border-r border-gray-200 flex-col items-center py-6 gap-6 z-20 shadow-sm">
        <div className="mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
            <LayoutGrid className="w-6 h-6" />
          </div>
          </div>

        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.view as View)}
            className={`p-3 rounded-xl transition-all duration-200 group relative ${currentView === item.view
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
              : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
              }`}
            title={item.label}
            >
            <item.icon className="w-6 h-6" />
            {/* Tooltip */}
            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {item.label}
            </div>
          </button>
        ))}
      </div>

      {/* Mobile Menu - Shown only on small screens */}
      {menuItems.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center z-50">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.view as View)}
              className={`p-2 flex flex-col items-center justify-center transition-all ${currentView === item.view ? 'text-green-600' : 'text-gray-400'}`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden relative ${menuItems.length > 0 ? 'pb-16 md:pb-0' : ''}`}>
        {renderView()}
      </div>
    </div>
  );
};

export default WhatsPanda;
