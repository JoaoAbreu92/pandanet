
import React, { useState, useRef, useEffect } from 'react';
import {
    FaceSmileIcon,
    PaperClipIcon,
    PaperAirplaneIcon,
    XCircleIcon,
    ArrowUturnLeftIcon,
    SearchIcon,
    ChevronLeftIcon,
    PlusIcon,
    TrashIcon,
    UserGroupIcon,
    XMarkIcon,
    PhotoIcon,
} from './icons';
import type { Conversation, Message, Employee } from '../types';

const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🤔', '🎉', '🔥', '👀'];
const availableEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', 'Mw', '😔', '😪', '🤤', '😴',
    '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
    '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', 'wv', '☹️', '😮',
    '😯', '😲', '😳', '🥺', 'mV', '😨', 'mw', '😥', '😢', '😭',
    '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
    '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
    '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
    '🙀', '😿', '😾', '👋', '🤚', 'Mw', '✋', '🖖', '👌', '🤏',
    '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
    '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
    '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', 'Foot',
    '👂', '🦻', 'Nose', '🧠', '🫀', '🫁', 'Tooth', 'Bone', 'Eyes',
    'Eye', 'Tongue', 'Mouth', 'Lip', 'Baby', 'Child', 'Boy', 'Girl',
    'Person', 'Blond', 'Man', 'Beard', 'Redhead', 'Woman', 'Older_Adult', 'Old_Man',
    'Old_Woman', 'Frown', 'Pout', 'Gesturing_NO', 'Gesturing_OK', 'Tipping_Hand', 'Raising_Hand', 'Deaf_Person',
    'Bowing', 'Facepalming', 'Shrugging', 'Health_Worker', 'Student', 'Teacher', 'Judge', 'Farmer',
    'Cook', 'Mechanic', 'Factory_Worker', 'Office_Worker', 'Scientist', 'Software_Engineer', 'Singer', 'Artist',
    'Pilot', 'Astronaut', 'Firefighter', 'Police_Officer', 'Detective', 'Guard', 'Ninja', 'Construction_Worker',
    'Prince', 'Princess', 'Person_Wearing_Turban', 'Person_With_Veil'];

const NOTE_COLORS = [
    { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-200' },
    { id: 'green', bg: 'bg-green-100', border: 'border-green-200' },
    { id: 'red', bg: 'bg-red-100', border: 'border-red-200' },
    { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-200' },
    { id: 'pink', bg: 'bg-pink-100', border: 'border-pink-200' },
];

interface Note {
    id: number;
    text: string;
    colorId: string;
}

interface Team {
    id: number;
    name: string;
    members: number[];
    creatorId: number;
}

interface MessagesProps {
    conversations: Conversation[];
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
    currentUser: Employee;
    allEmployees: Employee[];
}

const Messages: React.FC<MessagesProps> = ({ conversations, setConversations, currentUser, allEmployees: companyEmployees }) => {
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [stickerTab, setStickerTab] = useState<'gallery' | 'saved'>('gallery');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
    const [activeTab, setActiveTab] = useState<'conversations' | 'contacts' | 'teams'>('conversations');
    const [typingStatus, setTypingStatus] = useState<Record<number, boolean>>({});

    const [showMembersModal, setShowMembersModal] = useState(false);

    // Sticky Notes State
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNoteText, setNewNoteText] = useState('');
    const [noteWarning, setNoteWarning] = useState(false);

    // Teams State


    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const typingTimeoutRef = useRef<number | null>(null);

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [selectedConversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !attachedFile) || !selectedConversation) return;
        const message: Message = { id: Date.now(), sender: 'me', senderName: currentUser.name, avatarUrl: currentUser.avatarUrl, text: newMessage, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reactions: [], ...(attachedFile && { file: { name: attachedFile.name, url: URL.createObjectURL(attachedFile) } }), ...(replyingToMessage && { replyingTo: replyingToMessage }), };
        const updatedConversations = conversations.map(conv => (conv.id === selectedConversationId ? { ...conv, messages: [...conv.messages, message], lastMessage: attachedFile ? `Enviou um anexo` : newMessage, lastMessageTimestamp: message.timestamp, unreadCount: 0 } : conv));
        setConversations(updatedConversations);
        setNewMessage(''); setAttachedFile(null); setReplyingToMessage(null);
    };

    const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { if (file.size > 10 * 1024 * 1024) { alert('O arquivo excede o limite de 10MB.'); return; } setAttachedFile(file); }
    };

    const handleReact = (messageId: number, emoji: string) => {
        const updatedConversations = conversations.map(conv => {
            if (conv.id === selectedConversationId) {
                return {
                    ...conv, messages: conv.messages.map(msg => {
                        if (msg.id === messageId) {
                            const userReactionIndex = msg.reactions.findIndex(r => r.user === currentUser.name);
                            const newReactions = [...msg.reactions];

                            if (userReactionIndex > -1) {
                                if (newReactions[userReactionIndex].emoji === emoji) {
                                    newReactions.splice(userReactionIndex, 1);
                                } else {
                                    newReactions[userReactionIndex].emoji = emoji;
                                }
                            } else {
                                newReactions.push({ emoji, user: currentUser.name });
                            }
                            return { ...msg, reactions: newReactions };
                        }
                        return msg;
                    })
                };
            }
            return conv;
        });
        setConversations(updatedConversations);
    };

    const handleSelectConversation = (convId: number) => {
        setSelectedConversationId(convId);
        const updatedConversations = conversations.map(conv =>
            conv.id === convId ? { ...conv, unreadCount: 0 } : conv
        );
        setConversations(updatedConversations);
    };

    // Sticky Notes Logic
    const handleAddNote = () => {
        if (!newNoteText.trim()) return;

        if (notes.length >= 6) {
            if (!noteWarning) {
                setNoteWarning(true);
                return;
            }
            // FIFO: Remove first, add new
            const newNote: Note = { id: Date.now(), text: newNoteText, colorId: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id };
            setNotes(prev => [...prev.slice(1), newNote]);
            setNoteWarning(false);
        } else {
            const newNote: Note = { id: Date.now(), text: newNoteText, colorId: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id };
            setNotes(prev => [...prev, newNote]);
        }
        setNewNoteText('');
    };

    const handleDeleteNote = (id: number) => { // Manual delete if needed, though not explicitly requested, good for UX
        setNotes(notes.filter(n => n.id !== id));
        setNoteWarning(false); // Reset warning if we free up space
    };

    // Teams Logic



    const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
        const isMe = message.sender === 'me';
        return (
            <div className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
                <img src={message.avatarUrl} alt={message.senderName} className="w-8 h-8 rounded-full mt-1" />
                <div className={`flex flex-col relative ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Show name for other users in group chats */}
                    {!isMe && selectedConversation?.isGroup && (
                        <span className="text-[10px] text-gray-500 ml-1 mb-0.5">{message.senderName}</span>
                    )}
                    <div className="relative">
                        {message.replyingTo && (
                            <div className={`text-xs p-2 rounded-t-lg max-w-xs sm:max-w-md text-gray-500 border-l-2 border-green-400 ${isMe ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                                <p className="font-semibold">{message.replyingTo.senderName}</p>
                                <p className="truncate">{message.replyingTo.text}</p>
                            </div>
                        )}
                        <div className={`p-3 rounded-lg max-w-xs sm:max-w-md ${isMe ? 'bg-brand-primary text-white rounded-br-none' : 'bg-white text-brand-text rounded-bl-none'} ${message.replyingTo ? 'rounded-t-none' : ''}`}>
                            <p className="text-sm break-words">{message.text}</p>
                            {message.file && (<div className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2"> <PaperClipIcon className="w-4 h-4" /> <a href={message.file.url} className="text-sm underline" target="_blank" rel="noopener noreferrer">{message.file.name}</a> </div>)}
                        </div>
                        <div className={`absolute top-0 -mt-4 flex items-center bg-white shadow-md rounded-full border transition-all duration-300 opacity-0 delay-1000 group-hover:opacity-100 group-hover:delay-0 ${isMe ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}`}>
                            <div className="flex items-center p-0.5">
                                {availableReactions.map(emoji => (<button key={emoji} onClick={() => handleReact(message.id, emoji)} className="p-1 text-lg hover:scale-125 transition-transform">{emoji}</button>))}
                            </div>
                            <button onClick={() => setReplyingToMessage(message)} className="p-1.5 text-gray-500 hover:text-brand-primary"> <ArrowUturnLeftIcon className="w-4 h-4" /> </button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center w-full">
                        <div className={`flex gap-1 mt-1 ${isMe ? 'order-2' : ''}`}>
                            {message.reactions.length > 0 && message.reactions.map((r, i) => (<span key={i} className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full cursor-pointer" title={r.user}>{r.emoji}</span>))}
                        </div>
                        <span className={`text-xs text-gray-400 mt-1 ${isMe ? 'mr-2' : 'ml-1'}`}>{message.timestamp}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-5rem)] bg-white">
            {/* Left Sidebar: Conversations/Contacts/Teams */}
            <div className={`w-full md:w-1/4 lg:w-1/5 bg-white border-r flex-col ${selectedConversationId !== null ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b">
                    <div className="flex bg-gray-100 rounded-md p-1">
                        <button onClick={() => setActiveTab('conversations')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'conversations' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Chat</button>
                        <button onClick={() => setActiveTab('contacts')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'contacts' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Contatos</button>
                        <button onClick={() => setActiveTab('teams')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'teams' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Equipes</button>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1">
                    {activeTab === 'conversations' && (
                        <ul>
                            {conversations.filter(c => !c.isGroup).map(conv => {
                                const participant = companyEmployees.find(e => e.name === conv.participantName);
                                const isOnline = participant ? participant.isOnline : false;
                                return (
                                    <li key={conv.id} onClick={() => handleSelectConversation(conv.id)}>
                                        <div className={`p-4 flex items-center space-x-3 cursor-pointer border-l-4 ${selectedConversationId === conv.id ? 'bg-emerald-50 border-brand-primary' : 'border-transparent hover:bg-gray-50'}`}>
                                            <div className="relative">
                                                <img src={conv.participantAvatarUrl} alt={conv.participantName} className={`w-10 h-10 rounded-full border-2 ${isOnline ? 'border-green-500' : 'border-gray-400'}`} />
                                                {conv.unreadCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 bg-red-500 text-white text-xs rounded-full">{conv.unreadCount}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-sm font-semibold text-brand-text truncate">{conv.participantName}</p>
                                                    <p className="text-xs text-gray-400">{conv.lastMessageTimestamp}</p>
                                                </div>
                                                <p className="text-sm text-brand-subtle-text truncate">{conv.lastMessage}</p>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {activeTab === 'contacts' && (
                        <ul> {companyEmployees.filter(e => e.name !== currentUser.name).map(emp => (<li key={emp.id} className="p-4 flex items-center space-x-4 cursor-pointer hover:bg-gray-50"> <img src={emp.avatarUrl} alt={emp.name} className={`w-10 h-10 rounded-full border-2 ${emp.isOnline ? 'border-green-500' : 'border-gray-400'}`} /> <div className="flex-1 min-w-0"> <p className="text-sm font-semibold text-brand-text truncate">{emp.name}</p> <p className="text-sm text-brand-subtle-text truncate">{emp.role}</p> </div> </li>))} </ul>
                    )}
                    {activeTab === 'teams' && (
                        <ul>
                            {conversations.filter(c => c.isGroup).length === 0 && (
                                <li className="p-4 text-center text-sm text-gray-400">
                                    Nenhuma equipe encontrada.
                                </li>
                            )}
                            {conversations.filter(c => c.isGroup).map(conv => (
                                <li key={conv.id} onClick={() => handleSelectConversation(conv.id)}>
                                    <div className={`p-4 flex items-center space-x-3 cursor-pointer border-l-4 ${selectedConversationId === conv.id ? 'bg-emerald-50 border-brand-primary' : 'border-transparent hover:bg-gray-50'}`}>
                                        <div className="relative">
                                            <img src={conv.participantAvatarUrl} alt={conv.participantName} className="w-10 h-10 rounded-full border-2 border-gray-400" />
                                            {conv.unreadCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 bg-red-500 text-white text-xs rounded-full">{conv.unreadCount}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-semibold text-brand-text truncate">{conv.participantName}</p>
                                                <p className="text-xs text-gray-400">{conv.lastMessageTimestamp}</p>
                                            </div>
                                            <p className="text-sm text-brand-subtle-text truncate">{conv.lastMessage}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Middle: Chat Area */}
            <div className={`flex-1 flex-col bg-brand-secondary ${selectedConversationId !== null ? 'flex' : 'hidden md:flex'}`}>
                {selectedConversation ? (
                    <>
                        <div className="flex items-center justify-between p-4 bg-white border-b">
                            <div className="flex items-center space-x-3">
                                <button onClick={() => setSelectedConversationId(null)} className="md:hidden -ml-2 mr-2 p-2 text-gray-500 rounded-full hover:bg-gray-100">
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <img src={selectedConversation.participantAvatarUrl} alt={selectedConversation.participantName} className="w-10 h-10 rounded-full" />
                                <div>
                                    <p className="font-bold text-brand-text">{selectedConversation.participantName}</p>
                                    {typingStatus[selectedConversation.id] ? (
                                        <p className="text-xs text-brand-primary animate-pulse">Digitando...</p>
                                    ) : (
                                        <p className="text-xs text-green-500">Online</p>
                                    )}
                                </div>
                            </div>
                            {selectedConversation.isGroup && (
                                <button
                                    onClick={() => setShowMembersModal(true)}
                                    className="p-2 text-gray-500 hover:text-brand-primary hover:bg-gray-100 rounded-full transition-colors"
                                    title="Ver membros"
                                >
                                    <UserGroupIcon className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto"> {selectedConversation.messages.map(msg => (<MessageBubble key={msg.id} message={msg} />))} <div ref={messagesEndRef} /> </div>
                        <div className="p-4 bg-white border-t">
                            {replyingToMessage && (<div className="mb-2 p-2 bg-gray-100 rounded-lg text-sm"> <div className="flex justify-between items-center"> <div> <p className="font-semibold text-brand-primary">Respondendo a {replyingToMessage.senderName}</p> <p className="text-gray-600 truncate">{replyingToMessage.text}</p> </div> <button onClick={() => setReplyingToMessage(null)}> <XCircleIcon className="w-5 h-5 text-gray-500 hover:text-red-500" /> </button> </div> </div>)}
                            {attachedFile && (<div className="mb-2 p-2 bg-gray-100 rounded-lg text-sm"> <div className="flex justify-between items-center"> <p className="text-gray-600">Anexo: {attachedFile.name}</p> <button onClick={() => setAttachedFile(null)}> <XCircleIcon className="w-5 h-5 text-gray-500 hover:text-red-500" /> </button> </div> </div>)}
                            <form onSubmit={handleSendMessage} className="relative flex items-center space-x-3">
                                {showEmojiPicker && (
                                    <div className="absolute bottom-14 left-0 bg-white border rounded-lg shadow-lg p-2 flex flex-wrap w-64 max-h-60 overflow-y-auto z-50">
                                        {availableEmojis.map(emoji => (
                                            <button key={emoji} type="button" onClick={() => setNewMessage(prev => prev + emoji)} className="text-2xl p-1 hover:bg-gray-200 rounded-md">
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showStickerPicker && (
                                    <div className="absolute bottom-14 left-10 bg-white border rounded-lg shadow-lg w-72 h-80 z-50 flex flex-col">
                                        <div className="flex border-b">
                                            <button type="button" onClick={() => setStickerTab('gallery')} className={`flex-1 py-2 text-sm font-medium ${stickerTab === 'gallery' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500'}`}>Galeria</button>
                                            <button type="button" onClick={() => setStickerTab('saved')} className={`flex-1 py-2 text-sm font-medium ${stickerTab === 'saved' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500'}`}>Salvos</button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2">
                                            {stickerTab === 'gallery' ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {/* Mock Gallery GIFs */}
                                                    {['https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXg0d3F6aG55b3F6aG55b3F6aG55b3F6aG55b3F6aG55b3F/3o7TKs6KZp6lW2q64I/giphy.gif', 'https://media.giphy.com/media/l0HlHJGHe3yAMhdQY/giphy.gif', 'https://media.giphy.com/media/3o6Zt481isNVuQIqZm/giphy.gif'].map((url, i) => (
                                                        <div key={i} className="group relative cursor-pointer">
                                                            <img src={url} alt="GIF" className="w-full h-full object-cover rounded" onClick={() => { setAttachedFile(new File([""], "sticker.gif", { type: "image/gif" })); setShowStickerPicker(false); }} />
                                                            <button type="button" className="absolute top-0 right-0 p-1 bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-bl text-xs" title="Salvar">★</button>
                                                        </div>
                                                    ))}
                                                    <div className="col-span-3 text-center text-xs text-gray-400 mt-2">Mais GIFs em breve...</div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500 text-sm">
                                                    <p>Nenhum sticker salvo.</p>
                                                    <p className="text-xs mt-1">Clique na ★ para salvar.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false); }} className="p-2 text-gray-500 hover:text-brand-primary">
                                    <FaceSmileIcon className="w-6 h-6" />
                                </button>
                                <button type="button" onClick={() => { setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false); }} className="p-2 text-gray-500 hover:text-brand-primary" title="Stickers & GIFs">
                                    <PhotoIcon className="w-6 h-6" />
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileAttach} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-brand-primary">
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
                                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite uma mensagem..." className="flex-1 w-full px-4 py-2 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                                <button type="submit" className="p-2 bg-brand-primary text-white rounded-full hover:bg-emerald-600 disabled:bg-emerald-300" disabled={(!newMessage.trim() && !attachedFile)}>
                                    <PaperAirplaneIcon className="w-6 h-6" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (<div className="flex-1 flex-col items-center justify-center text-gray-500 hidden md:flex"> <p className="text-lg">Selecione uma conversa</p><p className="text-sm">Escolha uma pessoa da lista para ver as mensagens.</p> </div>)}
            </div>

            {/* Right Sidebar: Sticky Notes */}
            <div className="hidden lg:flex flex-col w-64 bg-gray-50 border-l p-4 overflow-y-auto">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="text-xl">📝</span> Notas Rápidas
                </h3>

                {noteWarning && (
                    <div className="mb-4 p-3 bg-orange-100 border-l-4 border-orange-500 text-orange-700 text-xs rounded animate-pulse">
                        <p className="font-bold">Aviso!</p>
                        <p>Criar mais uma nota excluirá a mais antiga.</p>
                    </div>
                )}

                <div className="space-y-3 mb-4 flex-1">
                    {notes.map((note) => {
                        const color = NOTE_COLORS.find(c => c.id === note.colorId) || NOTE_COLORS[0];
                        return (
                            <div key={note.id} className={`p-3 relative rounded-lg shadow-sm ${color.bg} ${color.border} border group animate-fade-in-up transition-all hover:scale-102`}>
                                <button onClick={() => handleDeleteNote(note.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity">
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap font-handwriting leading-snug">{note.text}</p>
                            </div>
                        );
                    })}
                    {notes.length === 0 && (
                        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            <p className="text-sm">Nenhuma nota ainda.</p>
                        </div>
                    )}
                </div>

                <div className="mt-auto">
                    <textarea
                        value={newNoteText}
                        onChange={(e) => {
                            setNewNoteText(e.target.value);
                            if (noteWarning && notes.length < 6) setNoteWarning(false); // Clear warning if user deletes one manually
                        }}
                        placeholder="Nova nota..."
                        className="w-full p-2 border rounded-md text-sm mb-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddNote();
                            }
                        }}
                    />
                    <button
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim()}
                        className="w-full py-2 bg-brand-primary text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
                    >
                        {noteWarning ? 'Adicionar e Substituir' : 'Adicionar Nota'}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-2">
                        {notes.length}/6 notas • FIFO ativado
                    </p>
                </div>
            </div>
            {/* Team Members Modal */}
            {showMembersModal && selectedConversation?.isGroup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-bold text-gray-900">Membros do Grupo</h3>
                            <button
                                onClick={() => setShowMembersModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-0 max-h-[60vh] overflow-y-auto">
                            {(() => {
                                const teamName = selectedConversation.groupName;
                                const members = companyEmployees.filter(e => e.team === teamName);

                                if (members.length === 0) {
                                    return <div className="p-4 text-center text-gray-500">Nenhum membro encontrado.</div>;
                                }

                                return (
                                    <ul className="divide-y divide-gray-100">
                                        {members.map(member => (
                                            <li key={member.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                                                <div className="relative">
                                                    <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-full border border-gray-200" />
                                                    {member.isOnline && (
                                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
                                                    <p className="text-xs text-gray-500">{member.role}</p>
                                                </div>
                                                {member.id === selectedConversation.admins?.[0] && (
                                                    <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full font-medium">Admin</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )
                            })()}
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-right">
                            <span className="text-xs text-gray-500">
                                Total: {companyEmployees.filter(e => e.team === selectedConversation.groupName).length} membros
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;