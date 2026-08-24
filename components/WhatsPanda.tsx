import React, { useState } from 'react';
import { 
  MessageCircle, 
  Users,
  PlusCircle,
  QrCode,
  Settings as SettingsIcon,
  LayoutGrid,
  Lock,
  UsersRound
} from 'lucide-react';
import Chat from './whatspanda/Chat';
import Contacts from './whatspanda/Contacts';
import NewTicket from './whatspanda/NewTicket';
import Channels from './whatspanda/Channels';
import Settings from './whatspanda/Settings';

import { useAuth } from './AuthContext';
import { Loader2 } from 'lucide-react';

type View = 'privados' | 'grupos' | 'contacts' | 'new-ticket' | 'channels' | 'settings';

interface WhatsPandaProps {
  initialSearch?: string;
}

const WhatsPanda: React.FC<WhatsPandaProps> = ({ initialSearch = '' }) => {
  const { profile } = useAuth();
  const [currentView, setCurrentView] = useState<View>('privados');
  const [isChatActive, setIsChatActive] = useState(false);
  const [internalSearch, setInternalSearch] = useState(initialSearch);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const handleContactChat = (phone: string) => {
    setInternalSearch(phone);
    setCurrentView('privados');
  };

  const permissions: any = {
    can_view_contacts: true,
    can_edit_contacts: false,
    can_view_chats: true,
    can_send_messages: true,
    can_send_media: true,
    can_manage_settings: false,
    can_view_groups: true,  // Ativado por padrão para todos
    ...(profile?.whatspanda_permissions || {})
  };

  const isAdmin = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin';

  // Admin override
  if (isAdmin) {
    permissions.can_view_contacts = true;
    permissions.can_edit_contacts = true;
    permissions.can_view_chats = true;
    permissions.can_send_messages = true;
    permissions.can_send_media = true;
    permissions.can_manage_settings = true;
    permissions.can_view_groups = true;
  }

  const menuItems = React.useMemo(() => [
    ...(permissions.can_view_chats ? [{ id: 'privados', label: 'Privados', icon: Lock, view: 'privados' }] : []),
    ...(permissions.can_view_groups ? [{ id: 'grupos', label: 'Grupos', icon: UsersRound, view: 'grupos' }] : []),
    ...(permissions.can_view_contacts ? [{ id: 'contacts', label: 'Contatos', icon: Users, view: 'contacts' }] : []),
    ...(permissions.can_view_chats ? [{ id: 'channels', label: 'Canais', icon: QrCode, view: 'channels' }] : []),
    ...(permissions.can_manage_settings ? [{ id: 'settings', label: 'Configurações', icon: SettingsIcon, view: 'settings' }] : []),
  ], [permissions.can_view_chats, permissions.can_view_groups, permissions.can_view_contacts, permissions.can_manage_settings]);

  // Set default view if current is invalid
  React.useEffect(() => {
    const validViews = [...menuItems.map(item => item.view), 'new-ticket'];
    if (!validViews.includes(currentView) && validViews.length > 0) {
      setCurrentView(validViews[0] as View);
    }
  }, [menuItems, currentView]);

  const renderView = () => {
    const { loading: authLoading } = useAuth();

    if (authLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 animate-pulse">
          <Loader2 className="w-12 h-12 mb-4 text-emerald-500 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Sincronizando WhatsPanda...</p>
        </div>
      );
    }

    if (menuItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
          <p>Você não tem permissão para acessar o WhatsPanda.</p>
        </div>
      );
    }

    switch (currentView) {
      case 'privados': return permissions.can_view_chats ? <Chat onConversationSelect={setIsChatActive} initialSearch={internalSearch} type="private" initialConversationId={selectedConversationId} /> : null;
      case 'grupos': return permissions.can_view_groups ? <Chat onConversationSelect={setIsChatActive} initialSearch={internalSearch} type="group" initialConversationId={selectedConversationId} /> : null;
      case 'contacts': return permissions.can_view_contacts ? <Contacts initialSearch={internalSearch} onChat={handleContactChat} /> : null;
      case 'new-ticket': return permissions.can_view_chats ? (
        <NewTicket 
          onBack={() => setCurrentView('privados')} 
          onConversationSelect={(conv) => {
            setSelectedConversationId(conv.id);
            setCurrentView('privados');
          }}
        />
      ) : null;
      case 'channels': return permissions.can_manage_settings ? <Channels /> : null;
      case 'settings': return permissions.can_manage_settings ? <Settings /> : null;
      default: return null;
    }
  };

  return (
    <div className="flex h-full bg-[#F4F7F6] dark:bg-[#020617] overflow-hidden relative font-sans text-brand-text transition-colors duration-500">

      {/* WhatsPanda Sidebar - Izing Pro Style (Desktop) */}
      <div className="hidden md:flex w-64 bg-white dark:bg-slate-900/40 backdrop-blur-xl border-r border-gray-100 dark:border-white/5 flex-col py-6 px-4 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-500">

        {/* Header / Logo Area */}
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <MessageCircle className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white leading-none font-brand">WhatsPanda</h1>
            <span className="text-[10px] uppercase tracking-widest font-medium text-emerald-600 dark:text-emerald-400">Pro</span>
          </div>
        </div>

        {/* Novo Atendimento Button */}
        <button
          onClick={() => setCurrentView('new-ticket')}
          className="mx-2 mb-6 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 group font-medium"
        >
          <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span>Novo Atendimento</span>
        </button>

        {/* Navigation Menu */}
        <div className="flex flex-col gap-1.5 flex-1 mt-2">
          <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">Menu Principal</div>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.view as View)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative border
                ${currentView === item.view
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/10'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
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
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* Current User Info (Optional footer area) */}
        <div className="mt-auto pt-6 border-t border-gray-100 dark:border-white/5 flex items-center gap-3 px-2">
          <img
            src={profile?.avatarUrl || `https://ui-avatars.com/api/?name=${profile?.name}&background=10b981&color=fff`}
            alt="Avatar"
            className="w-9 h-9 rounded-full ring-2 ring-emerald-50"
          />
          <div className="flex flex-col truncate">
            <span className="text-sm font-medium text-gray-800 dark:text-white truncate tracking-tight">{profile?.name || 'Usuário'}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate uppercase font-medium tracking-widest">{profile?.role || 'Atendente'}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden relative ${menuItems.length > 0 ? 'pb-[72px] md:pb-0' : ''} bg-[#F4F7F6] dark:bg-transparent flex flex-col`}>
        {renderView()}
      </div>

      {/* Mobile Menu - Shown only on small screens */}
      {menuItems.length > 0 && !(currentView === 'privados' && isChatActive) && (
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
    </div>
  );
};

export default WhatsPanda;
