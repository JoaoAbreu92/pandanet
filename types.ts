import React from 'react';

// Basic types
export type Page =
  | 'home'
  | 'messages'
  | 'tickets'
  | 'calendar'
  | 'directory'
  | 'resources' // Mantido para legado, corresponde a 'documentos'
  | 'recognition'
  | 'marketplace'
  | 'forms'
  | 'benefits'
  | 'bem-estar'
  | 'onboarding'
  | 'ti-dashboard'
  | 'ti-requests'
  | 'profile-page' // Era apenas 'profile' mas mantido consistente
  | 'admin'
  | 'announcement-detail'
  | 'documentos'
  | 'documentos'
  | 'feed'
  | 'events' // New Page
  // New RH Pages
  | 'training'
  | 'surveys'
  | 'policies'
  // New TI Pages
  | 'knowledge-base'
  | 'service-status'
  | 'infosec';

export type NotificationType = 'message' | 'ticket' | 'event' | 'mention' | 'like' | 'system';

export interface Department {
  id: string;
  name: string;
  company_id: string;
}

export interface Notification {
  id: string; // Alterado para string para suportar diferentes fontes de ID
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string; // String ISO ou tempo relativo
  isRead: boolean;
  link?: string; // Link flexível para navegação
  linkTo?: Page; // Link opcional para uma página interna
  actionLabel?: string;
  avatarUrl?: string;
}

export interface QuickLink {
  label: string;
  icon: React.ReactNode;
  page: Page;
}

export interface Announcement {
  id: string; // Add UUID
  title: string;
  summary: string;
  category: 'Notícias da Empresa' | 'Atualização de Produto' | 'RH & Cultura' | 'Evento';
  date: string;
  imageUrl?: string;
  videoUrl?: string; // URL do YouTube
  videoFile?: string; // URL de upload direto (Blob)
  reactions?: { emoji: string; users: string[] }[];
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  link: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string; // e.g., 'AGO 02'
  time: string;
  location: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  imageUrl?: string;
  category: 'Social' | 'Corporativo' | 'Treinamento' | 'Outro';
  imageType?: 'url' | 'upload';
  invitees?: string[]; // IDs de usuários especificamente convidados/convocados
  attendees: string[]; // IDs de usuários que CONFIRMARAM
  declined?: { userId: string; reason: string }[]; // Usuários que recusaram e o motivo
}

export interface TrainingModule {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  videoUrl?: string;
  category?: string;
}

export interface KBArticle {
  id: string;
  title: string;
  category: string;
  views: number;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export interface ServiceStatusItem {
  id: string;
  name: string;
  status: 'operational' | 'maintenance' | 'outage';
  uptime: string;
  imageUrl?: string;
}

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  level: 'info' | 'warning' | 'critical';
  date: string;
}

export interface EmployeePermissions {
  // General
  viewMessages: boolean;
  viewCalendar: boolean;
  useMarketplace: boolean;

  // Social Feed Permissions
  canPostText: boolean;
  canPostImage: boolean;
  canPostVideo: boolean;

  // RH
  viewDirectory: boolean;
  viewForms: boolean;
  viewBenefits: boolean;
  viewOnboarding: boolean;
  viewRecognition: boolean;
  viewDocuments: boolean; // Policies & Documents
  viewWellbeing: boolean;

  // T.I.
  viewTiDashboard: boolean;
  openTickets: boolean;
  openTiRequests: boolean;

  // New RH Permissions
  viewTraining: boolean;
  viewSurveys: boolean;
  viewPolicies: boolean;

  // New TI Permissions
  viewKnowledgeBase: boolean;
  viewServiceStatus: boolean;
  viewInfoSec: boolean;
}

export interface Employee {
  id: string;
  company_id?: string;
  name: string;
  email: string;
  password?: string; // Não deve ser armazenado no estado do frontend em um app real
  role: string;
  team: string;
  sectorManager?: string; // Gestor do Setor
  employeeManager?: string; // Gerente do Funcionário
  avatarUrl: string;
  coverUrl?: string;
  joinDate: string; // YYYY-MM-DD
  birthDate: string; // YYYY-MM-DD
  isAdmin: boolean;
  isCompanyAdmin?: boolean; // Changed from is_company_admin
  isOnline?: boolean;
  permissions: EmployeePermissions;
  phone?: string;
  officeLocation?: string;
  bio?: string;
  following: string[]; // Array de IDs de usuários que este funcionário segue
  department_id?: string;
  department_name?: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Recognition {
  id: string;
  to: string;
  from: string;
  toAvatar: string;
  fromAvatar: string;
  message: string;
  value: 'Trabalho em Equipe' | 'Inovação' | 'Foco no Cliente' | 'Qualidade';
}

export interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
}

export interface Message {
  id: string;
  sender: 'me' | string; // 'me' para o usuário atual
  senderName: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
  reactions: Reaction[];
  file?: { name: string; url: string };
  replyingTo?: Message;
}

export interface Reaction {
  emoji: string;
  user: string;
}

export interface Conversation {
  id: string; // Changed to string
  participantName: string;
  participantAvatarUrl: string;
  messages: Message[];
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  isGroup?: boolean;
  groupName?: string;
  admins?: string[]; // IDs de usuários
}

export type TicketStatus = 'Aberto' | 'Em Andamento' | 'Resolvido' | 'Fechado';
export type TicketPriority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export interface TicketComment {
  id: string;
  author: string;
  authorAvatarUrl: string;
  text: string;
  timestamp: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  requester: string;
  requester_id?: string;
  assignedTo?: string; // Legacy field
  assignedToId?: string; // Legacy field
  assigned_user_id?: string; // New field matching migration
  department_id?: string; // New field matching migration
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  lastUpdate: string;
  comments: TicketComment[];
  hasNotification?: boolean;
  rating?: number;
}

export type CalendarEventCategory = 'Reunião' | 'Evento da Empresa' | 'Feriado' | 'Aniversário';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  category: CalendarEventCategory;
  location: string;
  attendees: Employee[];
  notes: string;
}

export interface ResourceDocument {
  id: string;
  title: string;
  category: string;
  type: 'PDF' | 'DOCX' | 'PPTX' | 'XLSX' | 'OUTRO';
  url: string;
  updatedAt: string; // YYYY-MM-DD
}

export type MarketplaceItemStatus = 'Disponível' | 'Reservado' | 'Vendido';
export type MarketplaceItemCondition = 'Novo' | 'Quase Novo' | 'Bom' | 'Usado';

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: MarketplaceItemCondition;
  imageUrls: string[];
  listedBy: string;
  listedAt: string; // YYYY-MM-DD
  status: MarketplaceItemStatus;
  reservedBy?: string;
}

export type FormStatus = 'Pendente' | 'Aprovado' | 'Rejeitado';

export interface FormSubmission {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  formType: 'Solicitação de Férias';
  status: FormStatus;
  submittedAt: string; // YYYY-MM-DD
  // Form-specific data
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
  sectorManager?: string; // New field
  employeeManager?: string; // New field
}

export type TIRequestStatus = 'Pendente' | 'Em Análise' | 'Aprovado' | 'Pedido Realizado' | 'Entregue' | 'Rejeitado';
export type TIRequestType = 'Hardware' | 'Software';

export interface TIRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  requestType: TIRequestType;
  itemName: string;
  justification: string;
  status: TIRequestStatus;
  submittedAt: string; // YYYY-MM-DD
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  link?: { text: string; url: string };
}

export interface OnboardingCategory {
  title: string;
  steps: OnboardingStep[];
}

export interface Benefit {
  id: string;
  title: string;
  description: string;
  features: string[];
  link: string;
}

// Feed Types
export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  timestamp: string;
}

export interface PostReaction {
  emoji: string;
  userId: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: string;
  reactions: PostReaction[];
  comments: PostComment[];
  mentions: string[]; // IDs de usuários mencionados
}

// Main App Data Structure
export interface AppData {
  employees: Employee[];
  announcements: Announcement[];
  banners: Banner[];
  conversations: Conversation[];
  tickets: Ticket[];
  marketplaceItems: MarketplaceItem[];
  formSubmissions: FormSubmission[];
  tiRequests: TIRequest[];
  documents: ResourceDocument[];
  benefits: Benefit[];
  polls: Poll[];
  feedPosts: Post[];
  events: Event[];
  trainings: TrainingModule[];
  kbArticles: KBArticle[];
  services: ServiceStatusItem[];
  securityAlerts: SecurityAlert[];
  recognitions: Recognition[];
  wellnessItems: WellnessItem[];
}

export interface WellnessItem {
  id: string;
  title: string;
  description: string;
  category: 'Saúde Mental' | 'Atividade Física' | 'Nutrição' | 'Outro';
  videoUrl?: string;
  linkUrl?: string;
  linkText?: string;
}

export interface CompanySettings {
  companyName: string;
  logoUrl?: string;
}

export interface PlanFeatures extends EmployeePermissions {
  // Recursos futuros específicos do plano podem ser adicionados aqui
}

export interface Plan {
  id: string;
  name: string;
  userLimit: number;
  features: PlanFeatures;
  price?: number; // Added to match migration
}

export interface Company {
  id?: string;
  domain: string;
  name: string;
  cnpj?: string; // Added
  plan_id?: string; // FK
  plan?: Plan;
  custom_features?: Record<string, boolean>; // Overrides for plan features
  subscriptionEndDate?: string; // YYYY-MM-DD
  status?: 'active' | 'inactive' | 'expired';
  responsible_name?: string;
  responsible_email?: string;
  settings: CompanySettings;
  data: AppData;
  employees?: Employee[];
}