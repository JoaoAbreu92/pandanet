import React, { useState } from 'react';
import Card from './Card';
import { 
    EnvelopeIcon, 
    InboxIcon, 
    PaperAirplaneIcon, 
    PencilSquareIcon, 
    TrashIcon, 
    ArchiveBoxIcon, 
    ExclamationCircleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    XMarkIcon,
    PaperClipIcon,
    FaceSmileIcon,
    EllipsisVerticalIcon,
    ArrowPathIcon,
    StarIcon
} from './icons';

interface Email {
    id: string;
    from: {
        name: string;
        email: string;
        avatar?: string;
    };
    subject: string;
    preview: string;
    content: string;
    date: string;
    isRead: boolean;
    isStarred: boolean;
    attachments?: { name: string; size: string; type: string }[];
}

const MOCK_EMAILS: Email[] = [
    {
        id: '1',
        from: { name: 'João Silva', email: 'joao.silva@empresa.com', avatar: 'https://i.pravatar.cc/150?u=joao' },
        subject: 'Relatório Trimestral de Vendas',
        preview: 'Olá equipe, segue o relatório consolidado do último trimestre para revisão...',
        content: '<p>Olá equipe,</p><p>Segue o relatório consolidado do último trimestre para revisão. Tivemos um crescimento de 15% em relação ao período anterior.</p><p>Atenciosamente,<br/>João Silva</p>',
        date: '10:45',
        isRead: false,
        isStarred: true
    },
    {
        id: '2',
        from: { name: 'Mariana Costa', email: 'mariana.c@empresa.com' },
        subject: 'Atualização da Política de Home Office',
        preview: 'Prezados, informamos que a partir do próximo mês teremos novos critérios...',
        content: '<p>Prezados,</p><p>Informamos que a partir do próximo mês teremos novos critérios para o regime de home office.</p><p>Maiores detalhes seguem em anexo.</p>',
        date: '09:12',
        isRead: true,
        isStarred: false,
        attachments: [{ name: 'politica_rh_2024.pdf', size: '1.2 MB', type: 'pdf' }]
    },
    {
        id: '3',
        from: { name: 'Suporte TI', email: 'suporte@empresa.com', avatar: 'https://i.pravatar.cc/150?u=ti' },
        subject: 'Manutenção Programada - Servidores',
        preview: 'Comunicamos que no próximo domingo realizaremos uma manutenção preventiva...',
        content: '<p>Olá,</p><p>Comunicamos que no próximo domingo realizaremos uma manutenção preventiva nos nossos servidores centrais.</p><p>O sistema poderá ficar instável entre 02:00 e 05:00.</p>',
        date: 'Ontem',
        isRead: true,
        isStarred: false
    }
];

const EmailPage: React.FC = () => {
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(MOCK_EMAILS[0]);
    const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-3xl font-bold text-brand-text flex items-center gap-3">
                    <EnvelopeIcon className="w-8 h-8 text-brand-primary" />
                    E-mail Corporativo
                </h1>
                <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-brand-primary/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    Novo E-mail
                </button>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Coluna 1: Pastas */}
                <div className="w-64 flex flex-col gap-2">
                    <Card className="p-3 flex flex-col gap-1">
                        <button 
                            onClick={() => setActiveTab('inbox')}
                            className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'inbox' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <InboxIcon className="w-5 h-5" />
                                <span>Entrada</span>
                            </div>
                            <span className="bg-brand-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">2</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('sent')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'sent' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                            <span>Enviados</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('drafts')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'drafts' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <PencilSquareIcon className="w-5 h-5" />
                            <span>Rascunhos</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('trash')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'trash' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <TrashIcon className="w-5 h-5" />
                            <span>Lixeira</span>
                        </button>
                    </Card>

                    <Card className="p-4 mt-auto">
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center text-xs text-gray-400 uppercase font-bold tracking-wider">
                                <span>Contas</span>
                                <PlusIcon className="w-4 h-4 cursor-pointer hover:text-brand-primary" />
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded-lg border border-emerald-100 bg-emerald-50/30">
                                <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-bold">
                                    PA
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-bold truncate">suporte@pandanet.com</span>
                                    <span className="text-[10px] text-brand-primary">Conectado (SMTP/IMAP)</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Coluna 2: Lista de E-mails */}
                <div className="w-1/3 flex flex-col gap-4 overflow-hidden">
                    <Card className="p-3">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Pesquisar mensagens..."
                                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-primary transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </Card>

                    <Card className="flex-1 overflow-y-auto no-scrollbar p-1">
                        <div className="divide-y divide-gray-100">
                            {MOCK_EMAILS.map((email) => (
                                <div 
                                    key={email.id}
                                    onClick={() => setSelectedEmail(email)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-gray-50 group border-l-4 ${selectedEmail?.id === email.id ? 'bg-emerald-50/50 border-brand-primary' : 'border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-sm ${!email.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                            {email.from.name}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {email.date}
                                        </span>
                                    </div>
                                    <h3 className={`text-sm truncate mb-1 ${!email.isRead ? 'font-bold' : 'text-gray-700'}`}>
                                        {email.subject}
                                    </h3>
                                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                        {email.preview}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {email.isStarred ? (
                                            <StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />
                                        ) : (
                                            <StarIcon className="w-4 h-4 text-gray-300 hover:text-amber-400" />
                                        )}
                                        {email.attachments && <PaperClipIcon className="w-4 h-4 text-gray-300" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Coluna 3: Leitura */}
                <div className="flex-1 overflow-hidden">
                    {selectedEmail ? (
                        <Card className="h-full flex flex-col overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-brand-primary shadow-sm border border-transparent hover:border-gray-100">
                                        <ArchiveBoxIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-red-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-amber-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <ExclamationCircleIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{selectedEmail.subject}</h2>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            {selectedEmail.from.avatar ? (
                                                <img src={selectedEmail.from.avatar} alt="" className="w-12 h-12 rounded-2xl object-cover shadow-md" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-lg shadow-sm border border-brand-primary/20">
                                                    {selectedEmail.from.name.charAt(0)}
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{selectedEmail.from.name}</span>
                                                <span className="text-xs text-gray-400">{selectedEmail.from.email}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-sm font-medium text-gray-500">{selectedEmail.date}</span>
                                            <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Via Servidor Corporativo</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed border-t border-gray-50 pt-8" 
                                     dangerouslySetInnerHTML={{ __html: selectedEmail.content }} />

                                {selectedEmail.attachments && (
                                    <div className="mt-8 pt-8 border-t border-gray-50">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Anexos ({selectedEmail.attachments.length})</h4>
                                        <div className="flex flex-wrap gap-3">
                                            {selectedEmail.attachments.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                                                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-brand-primary shadow-sm border border-gray-50">
                                                        <PaperClipIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold group-hover:text-brand-primary transition-colors">{file.name}</span>
                                                        <span className="text-[10px] text-gray-400">{file.size}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Resposta Rápida */}
                            <div className="p-4 border-t border-gray-100 bg-gray-50/20">
                                <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all">
                                    <input 
                                        type="text" 
                                        placeholder="Clique para responder rápido..." 
                                        className="flex-1 border-none focus:ring-0 text-sm bg-transparent"
                                    />
                                    <button className="bg-brand-primary text-white p-2 rounded-xl hover:bg-emerald-600 transition-all shadow-md">
                                        <PaperAirplaneIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card className="h-full flex items-center justify-center text-gray-400 flex-col gap-4 opacity-70">
                            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                                <EnvelopeIcon className="w-10 h-10" />
                            </div>
                            <p className="font-medium">Selecione uma mensagem para visualizar</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* Modal de Composição */}
            {isComposeOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-end p-6 pointer-events-none">
                    <Card className="w-full max-w-2xl h-[600px] shadow-2xl flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom duration-300">
                        <div className="p-4 bg-brand-primary text-white flex justify-between items-center">
                            <h3 className="font-bold">Nova Mensagem</h3>
                            <div className="flex items-center gap-2">
                                <button className="p-1 hover:bg-white/20 rounded transition-all"><XMarkIcon className="w-5 h-5" onClick={() => setIsComposeOpen(false)} /></button>
                            </div>
                        </div>
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <span className="text-gray-400 text-sm font-bold min-w-[60px]">Para:</span>
                            <input type="text" className="flex-1 border-none focus:ring-0 text-sm" placeholder="nome@exemplo.com" />
                        </div>
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <span className="text-gray-400 text-sm font-bold min-w-[60px]">Assunto:</span>
                            <input type="text" className="flex-1 border-none focus:ring-0 text-sm" placeholder="Digite o assunto" />
                        </div>
                        <div className="flex-1 p-6">
                            <textarea 
                                className="w-full h-full border-none focus:ring-0 resize-none text-sm placeholder:text-gray-300" 
                                placeholder="Escreva sua mensagem aqui..."
                            />
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-white rounded-lg text-gray-500 hover:text-brand-primary transition-all"><PaperClipIcon className="w-5 h-5" /></button>
                                <button className="p-2 hover:bg-white rounded-lg text-gray-500 hover:text-brand-primary transition-all"><FaceSmileIcon className="w-5 h-5" /></button>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setIsComposeOpen(false)}
                                    className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-white rounded-xl transition-all"
                                >
                                    Descartar
                                </button>
                                <button className="flex items-center gap-2 bg-brand-primary text-white px-8 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-brand-primary/20">
                                    Enviar
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default EmailPage;
