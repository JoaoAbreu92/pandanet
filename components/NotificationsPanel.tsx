import React from 'react';
import { XMarkIcon, BellIcon, ChatBubbleLeftIcon, TicketIcon, CalendarIcon, AtSymbolIcon } from './icons';
import type { Notification } from '../types';

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onClearAll: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose, notifications, onMarkAsRead, onClearAll }) => {

    // Sort notifications by read/unread and then date (assuming logic handles this, or just map as is)
    // For now, render as received but filtered logic could be added here.

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'message': return <ChatBubbleLeftIcon className="w-5 h-5 text-blue-500" />;
            case 'ticket': return <TicketIcon className="w-5 h-5 text-amber-500" />;
            case 'event': return <CalendarIcon className="w-5 h-5 text-purple-500" />;
            case 'mention': return <AtSymbolIcon className="w-5 h-5 text-red-500" />;
            default: return <BellIcon className="w-5 h-5 text-gray-500" />;
        }
    };

    return (
        <>
            {/* Transparent Backdrop for click-outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={onClose}
                />
            )}

            {/* Mini Modal / Popover */}
            {isOpen && (
                <div className="absolute top-20 right-6 w-96 max-h-[600px] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 rounded-t-xl bg-gray-50/50">
                        <div className="flex items-center space-x-2">
                            <BellIcon className="w-5 h-5 text-brand-primary" />
                            <h2 className="text-lg font-bold text-gray-800">Notificações</h2>
                            {notifications.some(n => !n.isRead) ? (
                                <span className="bg-brand-primary text-white text-xs px-2 py-0.5 rounded-full">
                                    {notifications.filter(n => !n.isRead).length} novas
                                </span>
                            ) : null}
                        </div>
                        {/* Close button removed as click-outside is primary, but kept for accessibility if needed, though mostly redundant in popover */}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto max-h-[450px] p-2 space-y-2">
                        {notifications.length > 0 ? (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-3 rounded-lg flex items-start space-x-3 transition-all cursor-pointer hover:bg-gray-50 ${notification.isRead ? 'opacity-70' : 'bg-blue-50/50 border-l-4 border-brand-primary'}`}
                                    onClick={() => onMarkAsRead(notification.id)}
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        {notification.avatarUrl ? (
                                            <div className="relative">
                                                <img src={notification.avatarUrl} alt="" className="w-8 h-8 rounded-full shadow-sm" />
                                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                                    {getIcon(notification.type)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                {getIcon(notification.type)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className={`text-sm ${notification.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'} truncate`}>{notification.title}</p>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{notification.timestamp}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5 leading-snug">{notification.description}</p>
                                    </div>
                                    {!notification.isRead && (
                                        <div className="w-2 h-2 bg-brand-primary rounded-full mt-2 flex-shrink-0"></div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500 flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                    <BellIcon className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="font-medium">Tudo limpo!</p>
                                <p className="text-sm text-gray-400">Nenhuma notificação nova.</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                            <button
                                onClick={onClearAll}
                                className="w-full py-2 text-sm text-gray-600 hover:text-brand-primary font-medium hover:bg-white rounded-md transition-all shadow-sm border border-transparent hover:border-gray-200"
                            >
                                Marcar todas como lidas
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default NotificationsPanel;
