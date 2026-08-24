import React from 'react';

// Basic types
export type Page =
  | 'home'
  | 'messages'
  | 'email'
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
  | 'profile-page'
  | 'saas-dashboard'
  | 'admin'
  | 'support-inbox'
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
  | 'infosec'
  // New Expansion Pages
  | 'jobs'
  | 'meu-rh'
  | 'org-chart'
  | 'kpi-dashboard'
  | 'job-manager'
  | 'whatspanda'
  | 'manual-usuario'
  // CRM Pages
  | 'crm-dashboard'
  | 'crm-customers'
  | 'crm-sales'
  | 'crm-proposals'
  | 'crm-estimates'
  | 'crm-invoices'
  | 'crm-payments'
  | 'crm-credit-notes'
  | 'crm-items'
  | 'crm-subscriptions'
  | 'crm-contracts'
  | 'crm-tasks'
  | 'crm-calendar'
  | 'crm-customer-detail';

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
  user_id?: string; // Target user for database notifications
  company_id?: string;
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
  meeting_url?: string;
  is_specific_audience?: boolean;
  imageUrl?: string;
  category: 'Social' | 'Corporativo' | 'Treinamento' | 'Outro';
  imageType?: 'url' | 'upload';
  invited_ids?: string[]; // IDs de usuários especificamente convidados/convocados
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
  participants?: string[];
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
  viewEmail: boolean;

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

  // Expansion Permissions
  viewJobs: boolean;
  manageJobs: boolean;
  viewMeuRH: boolean;
  viewOrgChart: boolean;
  viewKPIDashboard: boolean;
  manageKPIs: boolean;

  // RH Management
  viewEmployeeDetails: boolean;
  editEmployeeProfile: boolean;
  deleteEmployeeProfile: boolean;
  viewVacationRequests: boolean;
  manageVacationRequests: boolean;

  // New Global Permissions
  createEvents: boolean;
  manageMarketplace: boolean;
  viewWhatsPanda: boolean;

  // AI Assistant Config
  ai_assistant: boolean;
}

// WhatsApp Permissions
export interface WhatsAppPermissions {
  can_view_contacts: boolean;
  can_edit_contacts: boolean;
  can_view_chats: boolean;
  can_send_messages: boolean;
  can_send_media: boolean;
  can_manage_settings: boolean;
  can_transfer: boolean; // New: Can transfer conversations
  can_see_all_departments: boolean; // New: Can see conversations from all departments
  can_manage_tags: boolean; // New: Can manage tags
  allowed_connections?: string[]; // IDs of Allowed connections
  assigned_queues?: string[]; // IDs of assigned queues
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
  whatspanda_permissions?: WhatsAppPermissions; // New field
  phone?: string;
  officeLocation?: string;
  bio?: string;
  following: string[]; // Array de IDs de usuários que este funcionário segue
  department_id?: string;
  department_name?: string;
  address?: string; // Localização para previsão do tempo
  // Personal Data (RH only)
  rg?: string;
  cpf?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  health_insurance?: string;
  blood_type?: string;
  marital_status?: string;
  education_level?: string;
  status?: 'pending' | 'active' | 'rejected';

  // Panda IA Assistant
  ai_api_key?: string | null;
  ai_provider?: 'gemini' | 'openai' | null;
  ai_behavior?: 'popup' | 'sidebar' | 'tab' | null;
}

export interface AIMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Recognition {
  id: string;
  fromId?: string;
  toId?: string;
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
  file?: { name: string; url: string; type?: string };
  replyingTo?: Message;
  replied_message?: Message | any;
  sender_deleted_at?: string;
}

export interface Reaction {
  emoji: string;
  user: string;
}

export interface Conversation {
  id: string; // Changed to string
  company_id?: string;
  is_closed?: boolean;
  participantName: string;
  participantAvatarUrl: string;
  participantId?: string; // Add this for nudge and notifications
  messages: Message[];
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  isGroup?: boolean;
  groupName?: string;
  admins?: string[]; // IDs de usuários
}

export type TicketStatus = 'Aberto' | 'Em Andamento' | 'Pendente' | 'Resolvido' | 'Fechado';
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
  media_urls?: string[];
  media_type?: 'image' | 'video';
  resolution_note?: string;
}

export type CalendarEventCategory = 'Reunião' | 'Evento da Empresa' | 'Feriado' | 'Aniversário';

export interface CalendarInvite {
  id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  decline_reason?: string;
  invitee_name?: string; // Para exibir na UI
  invitee_avatar?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  category: CalendarEventCategory;
  location: string;
  attendees: Employee[];
  invitedIds?: string[];
  notes: string;
  invites?: CalendarInvite[]; // Relacionados via nova tabela
  isPrivate?: boolean;
  isSystem?: boolean;
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
  seller: string;
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

export type TIRequestStatus = 'Pendente' | 'Em Análise' | 'Aprovado' | 'Pedido Realizado' | 'Entregue' | 'Rejeitado' | 'Finalizado';
export type TIRequestType = 'Hardware' | 'Software';

export interface TIRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  requestType: TIRequestType;
  itemName: string;
  justification: string;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedUserAvatarUrl?: string;
  comments: Array<{
    id: string;
    author: string;
    authorAvatarUrl: string;
    text: string;
    timestamp: string;
  }>;
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

export interface ManualVideo {
  id: string;
  title: string;
  url: string; // YouTube URL
  thumbnail: string;
  duration: string;
  category: string;
  description: string;
}

export interface ManualCategory {
  id: string;
  title: string;
  description: string;
  icon: string; // Icon name from our library
  type: 'video' | 'patch' | 'info';
}

export interface UpdatePatch {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  changes: string[];
}


export interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string;
  requirements: string[];
  location: string;
  salary_range?: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  status: 'open' | 'closed';
  created_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  employee_id: string;
  applied_at: string;
  status: 'pending' | 'reviewing' | 'interviewing' | 'accepted' | 'rejected';
  notes?: string;
}

export interface KPI {
  id: string;
  company_id: string;
  name: string;
  target: number;
  current: number;
  unit: string; // %, R$, qtd, etc.
  category: string;
  period: string; // Mês/Ano
  powerbi_url?: string;
  updated_at: string;
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
  created_at?: string;
  settings: CompanySettings;
  data: AppData;
  employees?: Employee[];
}

// WhatsApp Types
export interface WhatsAppConversation {
  id: string;
  company_id: string;
  contact_name: string;
  contact_phone: string;
  status: 'aberto' | 'pendente' | 'fechado';
  assigned_to?: string; // profile_id
  department_id?: string;
  connection_id?: string; // connection ID for Multi-channel
  kanban_column_id?: string | null;
  queue_id?: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  message_text: string | null;
  media_url?: string;
  media_type?: string;
  is_from_customer: boolean;
  sent_by?: string; // profile_id (null if customer)
  created_at: string;
}

export interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  tags?: string[]; // Array of Tag IDs or Names
  queue_id?: string;
  is_blocked?: boolean;
  ignore_contact?: boolean;
  disable_transcription?: boolean;
  disable_kanban?: boolean;
  assigned_to?: string;
}

export interface WhatsAppSettings {
  id: string;
  company_id: string;
  phone_number?: string;
  connection_name?: string;
  reject_calls?: boolean;
  rejection_message?: string;
  is_connected: boolean;
  qr_code?: string;
  channel_type?: 'whatsapp' | 'telegram' | 'instagram' | 'messenger';
  api_token?: string;
}

export interface WhatsAppQueue {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppTag {
  id: string;
  company_id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppContactNote {
  id: string;
  conversation_id: string;
  user_id: string;
  company_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConversationTag {
  id: string;
  conversation_id: string;
  tag_id: string;
  user_id?: string | null;
  department_id?: string | null;
  company_id: string;
  created_at: string;
  created_by?: string | null;
  tag?: WhatsAppTag; // Populated via join
}

export interface WhatsAppConversationWithDetails extends WhatsAppConversation {
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  department?: {
    id: string;
    name: string;
  };
  channel?: {
    channel_type?: 'whatsapp' | 'telegram' | 'instagram' | 'messenger';
    connection_name?: string;
  };
  tags?: WhatsAppConversationTag[];
  notes_count?: number;
}

// CRM Specific Types
export interface CRMCustomer {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  vat?: string;
  phone?: string;
  website?: string;
  groups?: string[];
  currency: string;
  default_language: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  billing_address: any;
  shipping_address: any;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface CRMTask {
  id: string;
  company_id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'testing' | 'awaiting_feedback' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date?: string;
  due_date?: string;
  created_by?: string;
  assigned_to?: string[];
  followers?: string[];
  tags?: string[];
  rel_id?: string;
  rel_type?: string;
  is_public: boolean;
  is_billable: boolean;
  hourly_rate?: number;
  created_at: string;
}

export interface CRMInvoice {
  id: string;
  company_id: string;
  customer_id: string;
  number: string;
  status: 'unpaid' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'draft';
  date: string;
  due_date: string;
  total: number;
  currency: string;
  created_at: string;
}

export interface CRMProposal {
  id: string;
  company_id: string;
  rel_id: string;
  rel_type: string;
  subject: string;
  status: 'draft' | 'sent' | 'open' | 'revised' | 'declined' | 'accepted';
  date: string;
  open_till: string;
  total: number;
  currency: string;
  created_at: string;
}

export interface CRMLead {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualified' | 'working' | 'proposal_sent' | 'customer' | 'lost';
  assigned_to?: string;
  created_at: string;
}

export interface CRMProject {
  id: string;
  company_id: string;
  name: string;
  customer_id: string;
  status: 'not_started' | 'in_progress' | 'on_hold' | 'cancelled' | 'finished';
  start_date?: string;
  deadline?: string;
  created_at: string;
}


export interface CRMItem {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  rate: number;
  tax_1?: number;
  tax_2?: number;
  unit?: string;
  item_group?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface CRMSubscription {
  id: string;
  company_id: string;
  customer_id: string;
  name: string;
  description?: string;
  quantity: number;
  currency: string;
  stripe_plan_id?: string;
  terms?: string;
  next_billing_cycle?: string;
  status: 'active' | 'inactive';
  created_at: string;
}