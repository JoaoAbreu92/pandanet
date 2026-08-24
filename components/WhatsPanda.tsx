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
    <div className="flex h-screen bg-[#F4F7F6] overflow-hidden relative font-sans text-brand-text">
      {/* WhatsPanda Sidebar - Izing Pro Style (Desktop) */}
      <div className="hidden md:flex w-64 bg-white border-r border-gray-100 flex-col py-6 px-4 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">

        {/* Header / Logo Area */}
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <MessageCircle className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight leading-none">WhatsPanda</h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">Pro</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex flex-col gap-1.5 flex-1 mt-2">
          <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">Menu Principal</div>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.view as View)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                ${currentView === item.view
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <div className={`${currentView === item.view ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'} transition-colors duration-200`}>
                <item.icon className="w-5 h-5" strokeWidth={currentView === item.view ? 2.5 : 2} />
              </div>
              <span className={`text-sm font-medium ${currentView === item.view ? 'font-bold' : ''}`}>
                {item.label}
              </span>

              {/* Active Indicator Line */}
              {currentView === item.view && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-500 rounded-r-md" />
              )}
            </button>
          ))}
        </div>

        {/* Current User Info (Optional footer area) */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-3 px-2">
          <img
            src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name}&background=10b981&color=fff`}
            alt="Avatar"
            className="w-9 h-9 rounded-full ring-2 ring-emerald-50"
          />
          <div className="flex flex-col truncate">
            <span className="text-sm font-bold text-gray-800 truncate">{profile?.full_name || 'Usuário'}</span>
            <span className="text-[10px] text-gray-400 truncate uppercase font-semibold">{profile?.role || 'Atendente'}</span>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Shown only on small screens */}
      {menuItems.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-white border-t border-gray-100 flex justify-around items-center z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.03)] px-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.view as View)}
              className={`p-2 flex flex-col items-center justify-center transition-all min-w-[64px] rounded-xl
                ${currentView === item.view ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}
              `}
            >
              <item.icon className={`w-5 h-5 mb-1 ${currentView === item.view ? 'animate-bounce-slight' : ''}`} strokeWidth={currentView === item.view ? 2.5 : 2} />
              <span className={`text-[10px] ${currentView === item.view ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden relative ${menuItems.length > 0 ? 'pb-[72px] md:pb-0' : ''} bg-[#F4F7F6]`}>
        {renderView()}
      </div>
    </div>
  );
};

export default WhatsPanda;
