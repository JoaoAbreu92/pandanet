import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { Employee } from '../types';
import { 
  FolderIcon, 
  CalendarDaysIcon, 
  UsersIcon, 
  Cog6ToothIcon, 
  EnvelopeIcon, 
  ChatBubbleLeftRightIcon, 
  SparklesIcon, 
  HeartIcon, 
  BuildingStorefrontIcon,
  WhatsAppIcon,
  XCircleIcon
} from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface QuickLinksProps {
  onNavigate: (page: string) => void;
  currentUser: Employee;
  variant?: 'card' | 'hero';
}

interface QuickLinkItem {
  id: string;
  label: string;
  page: string;
  permission: string;
  iconName: string;
}

const ALL_LINKS: QuickLinkItem[] = [
  { id: 'forms', label: 'Formulários RH', page: 'forms', permission: 'viewForms', iconName: 'folder' },
  { id: 'ti-dashboard', label: 'Painel de T.I.', page: 'ti-dashboard', permission: 'viewTiDashboard', iconName: 'cog' },
  { id: 'directory', label: 'Diretório', page: 'directory', permission: 'viewDirectory', iconName: 'users' },
  { id: 'calendar', label: 'Calendário', page: 'calendar', permission: 'viewCalendar', iconName: 'calendar' },
  { id: 'messages', label: 'Mensagens/Chat', page: 'messages', permission: 'viewMessages', iconName: 'chat' },
  { id: 'tickets', label: 'Meus Chamados', page: 'tickets', permission: 'openTickets', iconName: 'cog' },
  { id: 'feed', label: 'Feed Social', page: 'feed', permission: 'feedAccess', iconName: 'chat' },
  { id: 'scheduling', label: 'Visitas e Reuniões', page: 'scheduling', permission: 'viewScheduling', iconName: 'calendar' },
  { id: 'email', label: 'PandaMail', page: 'email', permission: 'viewEmail', iconName: 'envelope' },
  { id: 'meu-rh', label: 'Meu RH', page: 'meu-rh', permission: 'viewMeuRH', iconName: 'heart' },
  { id: 'whatspanda', label: 'WhatsPanda', page: 'whatspanda', permission: 'viewWhatsPanda', iconName: 'whatsapp' },
  { id: 'projects', label: 'Projetos', page: 'projects', permission: 'viewProjects', iconName: 'folder' },
  { id: 'marketplace', label: 'Marketplace', page: 'marketplace', permission: 'useMarketplace', iconName: 'storefront' },
  { id: 'onboarding', label: 'Onboarding', page: 'onboarding', permission: 'viewOnboarding', iconName: 'sparkles' },
  { id: 'manual-usuario', label: 'Manual do Usuário', page: 'manual-usuario', permission: 'viewDirectory', iconName: 'cog' },
];

const QuickLinks: React.FC<QuickLinksProps> = ({ onNavigate, currentUser, variant = 'card' }) => {
  const { refreshProfile } = useAuth();
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Filtra as opções que o usuário de fato tem permissão para acessar
  const allowedLinks = ALL_LINKS.filter(link => {
    if (link.page === 'feed') return true;
    if (currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin') return true;
    if (link.permission === 'viewWhatsPanda') {
      return !!currentUser.is_whatsapp_agent || 
        (!!currentUser.whatspanda_permissions && Object.keys(currentUser.whatspanda_permissions).length > 0) ||
        (currentUser.permissions && (currentUser.permissions as any).viewWhatsPanda === true);
    }
    return (currentUser.permissions as any)[link.permission] === true;
  });

  // Carrega a seleção do usuário ou define a padrão
  useEffect(() => {
    const userQuickLinks = (currentUser as any)?.quick_links;
    if (userQuickLinks && Array.isArray(userQuickLinks) && userQuickLinks.length > 0) {
      setSelectedPages(userQuickLinks.filter(page => allowedLinks.some(link => link.page === page)));
    } else {
      // Default: Primeiras 4 permitidas
      const defaultPages = allowedLinks.slice(0, 4).map(l => l.page);
      setSelectedPages(defaultPages);
    }
  }, [currentUser, allowedLinks.length]);

  const renderIcon = (name: string) => {
    switch (name) {
      case 'folder': return <FolderIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'cog': return <Cog6ToothIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'users': return <UsersIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'calendar': return <CalendarDaysIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'envelope': return <EnvelopeIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'chat': return <ChatBubbleLeftRightIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'heart': return <HeartIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'storefront': return <BuildingStorefrontIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'sparkles': return <SparklesIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      case 'whatsapp': return <WhatsAppIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
      default: return <Cog6ToothIcon className="w-6 h-6 sm:w-7 sm:h-7" />;
    }
  };

  // Mapeia as páginas selecionadas para os itens de link rápido ativos
  const activeLinks = allowedLinks.filter(link => selectedPages.includes(link.page)).slice(0, 6);

  const handleToggleLink = (page: string) => {
    if (selectedPages.includes(page)) {
      setSelectedPages(selectedPages.filter(p => p !== page));
    } else {
      if (selectedPages.length >= 6) {
        alert('Você pode selecionar no máximo 6 links rápidos.');
        return;
      }
      setSelectedPages([...selectedPages, page]);
    }
  };

  const handleSave = async () => {
    if (selectedPages.length === 0) {
      alert('Selecione pelo menos 1 link rápido.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ quick_links: selectedPages })
        .eq('id', currentUser.id);

      if (error) throw error;
      
      await refreshProfile();
      setModalOpen(false);
    } catch (err) {
      console.error('Error saving quick links:', err);
      alert('Erro ao salvar links rápidos.');
    } finally {
      setIsSaving(false);
    }
  };

  const linksGrid = (
    <div className={variant === 'hero' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-3 gap-2.5'}>
      {activeLinks.map((link) => (
        <button
          key={link.label}
          type="button"
          onClick={() => onNavigate(link.page)}
          className={variant === 'hero'
            ? 'group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-3.5 text-left dark:border-white/10 dark:bg-slate-950/30 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:border-white/25 dark:hover:bg-white/10'
            : 'flex flex-col items-center justify-center p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800/30 transition-all duration-200 group text-center h-24 w-full'}
        >
          <span className={variant === 'hero'
            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg transition-transform group-hover:scale-105'
            : 'text-brand-primary dark:text-emerald-450 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mb-1.5 transition-transform duration-200 group-hover:scale-110 flex-shrink-0'}>
            {renderIcon(link.iconName)}
          </span>
          <span className={variant === 'hero' ? 'min-w-0 flex-1' : 'contents'}>
            <span className={variant === 'hero'
              ? 'block truncate text-sm font-black text-slate-900 dark:text-white'
              : 'text-[11px] font-semibold text-brand-subtle-text dark:text-gray-250 group-hover:text-emerald-850 dark:group-hover:text-emerald-300 text-center leading-tight break-words w-full'}>
              {link.label}
            </span>
            {variant === 'hero' && <span className="block text-[10px] text-slate-500 dark:text-slate-300">Abrir módulo</span>}
          </span>
          {variant === 'hero' && <span className="text-lg text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-600 dark:group-hover:text-white">›</span>}
        </button>
      ))}
      {activeLinks.length === 0 && (
        <p className={variant === 'hero' ? 'col-span-full rounded-2xl border border-dashed border-white/20 p-5 text-center text-xs text-slate-300' : 'col-span-full text-xs text-gray-450 italic py-4 text-center'}>
          Nenhum atalho selecionado. Use “Personalizar” para adicionar.
        </p>
      )}
    </div>
  );

  const modal = isModalOpen && (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg p-6 relative border dark:border-white/5 animate-fade-in-up">
        <button onClick={() => setModalOpen(false)} disabled={isSaving} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white">
          <XCircleIcon className="w-6 h-6" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Personalizar acessos rápidos</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Selecione até 6 módulos disponíveis no seu plano e nas suas permissões.</p>
        <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
          {allowedLinks.map(link => {
            const selected = selectedPages.includes(link.page);
            return (
              <button key={link.id} type="button" onClick={() => handleToggleLink(link.page)} className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${selected ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-400 font-semibold' : 'bg-white dark:bg-slate-850 border-gray-150 dark:border-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                <div className={selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>{renderIcon(link.iconName)}</div>
                <span className="text-xs sm:text-sm leading-tight">{link.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t dark:border-white/5">
          <button type="button" onClick={() => setModalOpen(false)} disabled={isSaving} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold uppercase">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase hover:bg-emerald-600 disabled:opacity-50">{isSaving ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>
      </div>
    </div>
  );

  if (variant === 'hero') {
    return (
      <>
        <div className="rounded-3xl border border-emerald-200/80 bg-white/70 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.08] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">Acesso rápido</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Seus módulos favoritos, do seu jeito</p></div>
            <button type="button" onClick={() => setModalOpen(true)} className="rounded-full border border-emerald-300 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">Personalizar</button>
          </div>
          {linksGrid}
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <Card 
        title="Links Rápidos" 
        headerAction={
          <button 
            type="button"
            onClick={() => setModalOpen(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title="Personalizar Links Rápidos"
          >
            <Cog6ToothIcon className="w-4 h-4" />
          </button>
        }
      >
        {linksGrid}
      </Card>
      {modal}
    </>
  );
};

export default QuickLinks;
