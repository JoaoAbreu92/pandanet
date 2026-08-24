import React from 'react';

// Basic types
export type Page =
  | 'home'
  | 'messages'
  | 'tickets'
  | 'calendar'
  | 'directory'
  | 'resources' // Kept for legacy, corresponds to 'documentos'
  | 'recognition'
  | 'marketplace'
  | 'forms'
  | 'benefits'
  | 'bem-estar'
  | 'onboarding'
  | 'ti-dashboard'
  | 'ti-requests'
  | 'profile'
  | 'admin'
  | 'announcement-detail'
  | 'documentos'
  | 'documentos'
  | 'feed'
  // New RH Pages
  | 'training'
  | 'surveys'
  | 'policies'
  // New TI Pages
  | 'knowledge-base'
  | 'service-status'
  | 'infosec';

export type NotificationType = 'message' | 'ticket' | 'event' | 'mention' | 'system';

export interface Notification {
  id: string; // Changed to string to support different ID sources
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string; // ISO string or relative time
  isRead: boolean;
  linkTo?: Page; // Optional link to a page
  actionLabel?: string;
  avatarUrl?: string;
}

export interface QuickLink {
  label: string;
  icon: React.ReactNode;
  page: Page;
}

export interface Announcement {
  title: string;
  summary: string;
  category: 'Notícias da Empresa' | 'Atualização de Produto' | 'RH & Cultura' | 'Evento';
  date: string;
  imageUrl?: string;
  videoUrl?: string; // YouTube URL
  videoFile?: string; // Direct upload URL (Blob)
  reactions?: { emoji: string; users: string[] }[];
}

export interface Banner {
  id: number;
  imageUrl: string;
  title: string;
  subtitle: string;
  link: string;
}

export interface UpcomingEvent {
  id: number;
  title: string;
  date: string; // e.g., 'AGO 02'
  time: string;
  location: string;
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
  id: number;
  name: string;
  email: string;
  password?: string; // Should not be stored in frontend state in a real app
  role: string;
  team: string;
  avatarUrl: string;
  coverUrl?: string;
  joinDate: string; // YYYY-MM-DD
  birthDate: string; // YYYY-MM-DD
  isAdmin: boolean;
  isOnline?: boolean;
  permissions: EmployeePermissions;
  phone?: string;
  officeLocation?: string;
  bio?: string;
  following: number[]; // Array of user IDs this employee follows
}

export interface Task {
  id: number;
  text: string;
  completed: boolean;
}

export interface Recognition {
  id: number;
  to: string;
  from: string;
  toAvatar: string;
  fromAvatar: string;
  message: string;
  value: 'Trabalho em Equipe' | 'Inovação' | 'Foco no Cliente' | 'Qualidade';
}

export interface Poll {
  id: number;
  question: string;
  options: { id: number; text: string; votes: number }[];
}

export interface Message {
  id: number;
  sender: 'me' | string; // 'me' for the current user
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
  id: number;
  participantName: string;
  participantAvatarUrl: string;
  messages: Message[];
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
}

export type TicketStatus = 'Aberto' | 'Em Andamento' | 'Resolvido' | 'Fechado';
export type TicketPriority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export interface TicketComment {
  id: number;
  author: string;
  authorAvatarUrl: string;
  text: string;
  timestamp: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  requester: string;
  assignedTo?: string;
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
  id: number;
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
  id: number;
  title: string;
  category: string;
  type: 'PDF' | 'DOCX' | 'PPTX' | 'XLSX' | 'OUTRO';
  url: string;
  updatedAt: string; // YYYY-MM-DD
}

export type MarketplaceItemStatus = 'Disponível' | 'Reservado' | 'Vendido';
export type MarketplaceItemCondition = 'Novo' | 'Quase Novo' | 'Bom' | 'Usado';

export interface MarketplaceItem {
  id: number;
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
  id: number;
  requesterId: number;
  requesterName: string;
  requesterAvatarUrl: string;
  formType: 'Solicitação de Férias';
  status: FormStatus;
  submittedAt: string; // YYYY-MM-DD
  // Form-specific data
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
}

export type TIRequestStatus = 'Pendente' | 'Em Análise' | 'Aprovado' | 'Pedido Realizado' | 'Entregue' | 'Rejeitado';
export type TIRequestType = 'Hardware' | 'Software';

export interface TIRequest {
  id: number;
  requesterId: number;
  requesterName: string;
  requesterAvatarUrl: string;
  requestType: TIRequestType;
  itemName: string;
  justification: string;
  status: TIRequestStatus;
  submittedAt: string; // YYYY-MM-DD
}

export interface OnboardingStep {
  id: number;
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
  id: number;
  title: string;
  description: string;
  features: string[];
  link: string;
}

// Feed Types
export interface PostComment {
  id: number;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  text: string;
  timestamp: string;
}

export interface PostReaction {
  emoji: string;
  userId: number;
}

export interface Post {
  id: number;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: string;
  reactions: PostReaction[];
  comments: PostComment[];
  mentions: number[]; // IDs of mentioned users
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
}

export interface CompanySettings {
  companyName: string;
  logoUrl?: string;
}

export interface PlanFeatures extends EmployeePermissions {
  // Future plan-specific features can be added here
}

export interface Plan {
  id: string;
  name: string;
  userLimit: number;
  features: PlanFeatures;
}

export interface Company {
  domain: string;
  name: string;
  plan: Plan;
  subscriptionEndDate: string; // YYYY-MM-DD
  settings: CompanySettings;
  data: AppData;
}