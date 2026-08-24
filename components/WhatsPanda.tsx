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

  const canManageSettings = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin';

  const menuItems = [
    { id: 'chat', label: 'Conversas', icon: MessageCircle, view: 'chat' },
    { id: 'contacts', label: 'Contatos', icon: Users, view: 'contacts' },
    { id: 'channels', label: 'Canais', icon: QrCode, view: 'channels' },
    ...(canManageSettings ? [{ id: 'settings', label: 'Configurações', icon: SettingsIcon, view: 'settings' }] : []),
  ];

  const renderView = () => {
    switch (currentView) {
      case 'chat': return <Chat />;
      case 'contacts': return <Contacts />;
      case 'new-ticket': return <NewTicket />;
      case 'channels': return <Channels />;
      case 'settings': return <Settings />;
      default: return <Chat />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* WhatsPanda Sub-Sidebar */}
      <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-6 z-20 shadow-sm">
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {renderView()}
      </div>
    </div>
  );
};

export default WhatsPanda;
