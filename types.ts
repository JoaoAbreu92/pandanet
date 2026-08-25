import React from 'react';

// Basic types
export type Page =
  | 'home'
  | 'personal-notes'
  | 'personal-tasks'
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
  | 'manual-usuario'
  | 'projects'
  | 'projects-planning'
  | 'projects-list'
  | 'projects-calendar'
  | 'projects-metrics'
  | 'whatspanda'
  | 'scheduling'
  | 'scheduling-events'
  | 'scheduling-book'
  | 'agenda'
  | 'reservas';

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
  showButton?: boolean;
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
  category: 'Social' | 'Corporativo' | 'Treinamento' | 'Outro' | 'Comemorativo' | 'Evento da Empresa';
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
  startDate?: string;
  endDate?: string;
  pdfUrl?: string;
  quiz?: any;
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
  viewProjects: boolean;

  // AI Assistant Config
  ai_assistant: boolean;

  // Agenda Permission
  viewScheduling: boolean;
  viewAgenda: boolean;
  viewReservations: boolean;

  // Novas Permissões de RH
  viewTimeBank: boolean;
  manageTimeBank: boolean;
  viewEmployeeBenefitsAdmin: boolean;
  viewPerformance: boolean;
  managePerformance: boolean;

  // Admin View Permissions (Submenus)
  admin_view_dp?: boolean;
  admin_view_gestao_rh?: boolean;
  admin_view_administrativo?: boolean;
  admin_view_social?: boolean;
  admin_view_ti?: boolean;
  admin_view_comercial?: boolean;
  admin_view_configuracoes?: boolean;

  // Admin Tab Permissions
  admin_tab_users?: boolean;
  admin_tab_departments?: boolean;
  admin_tab_teams?: boolean;
  admin_tab_training?: boolean;
  admin_tab_hr?: boolean;
  admin_tab_forms?: boolean;
  admin_tab_policies?: boolean;
  admin_tab_onboarding?: boolean;
  admin_tab_documentos?: boolean;
  admin_tab_benefits?: boolean;
  admin_tab_jobs?: boolean;
  admin_tab_org_flow?: boolean;
  admin_tab_badges?: boolean;
  admin_tab_reservas_admin?: boolean;
  admin_tab_dashboard?: boolean;
  admin_tab_mural?: boolean;
  admin_tab_polls?: boolean;
  admin_tab_events?: boolean;
  admin_tab_marketplace?: boolean;
  admin_tab_wellbeing?: boolean;
  admin_tab_ti_requests?: boolean;
  admin_tab_status?: boolean;
  admin_tab_kb?: boolean;
  admin_tab_infosec?: boolean;
  admin_tab_scheduling?: boolean;
  admin_tab_scheduling_events?: boolean;
  admin_tab_settings?: boolean;

  // Admin Actions
  action_view_holerite?: boolean;
  action_register_hours?: boolean;
  action_approve_reservations?: boolean;
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
  assigned_queues?: string[]; // IDs of assigned queues
  allowed_connections?: string[]; // IDs of Allowed connections
  can_view_others_chats?: boolean; // New: Can view chats from other sectors/users
  can_view_groups?: boolean; // New: Can view and send messages in groups
  can_start_chats?: boolean; // New: Can initiate new conversations
}

export interface Employee {
  id: string;
  company_id?: string;
  company?: Company;
  name: string;
  email: string;
  password?: string; // Não deve ser armazenado no estado do frontend em um app real
  role: string;
  team: string;
  sectorManager?: string; // Gestor do Setor (nome ou ID legado)
  employeeManager?: string; // Gerente do Funcionário (nome ou ID legado)
  reports_to?: string; // ID do Gestor Direto (UUID)
  sector_manager_id?: string; // ID do Gestor do Setor (UUID)
  avatarUrl: string;
  coverUrl?: string;
  joinDate: string; // YYYY-MM-DD
  birthDate: string; // YYYY-MM-DD
  isAdmin: boolean;
  isCompanyAdmin?: boolean; // Changed from is_company_admin
  isOnline?: boolean;
  full_name?: string;
  plan_email_limit?: number;
  plan_whatsapp_limit?: number;
  notification_sound?: string;
  permissions: EmployeePermissions;
  whatspanda_permissions?: WhatsAppPermissions; // New field
  email_permissions?: any; // New field for multi-email support
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
  status_text?: string;

  // Panda IA Assistant
  ai_api_key?: string | null;
  ai_provider?: 'gemini' | 'openai' | null;
  ai_behavior?: 'popup' | 'sidebar' | 'tab' | null;
  whatsapp_signature?: string;
  use_whatsapp_signature?: boolean;
  can_nudge?: boolean;
  nudge_cooldown?: number; // In seconds
  is_whatsapp_agent?: boolean;
  is_manager?: boolean;
  quick_links?: string[];
  xp?: number;
  level?: number;
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
  cover_url?: string;
  show_button?: boolean;
  link?: string;
  button_style?: any;
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
  payload?: any;
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
  creatorId?: string;
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
  reservedAt?: string;
  seller: string;
}

export type FormStatus = 'Pendente' | 'Aprovado' | 'Rejeitado';

export interface FormSubmission {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  formType: 'Solicitação de Férias' | 'Solicitação de Ausência' | string;
  status: FormStatus;
  submittedAt: string; // YYYY-MM-DD
  // Form-specific data
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
  sectorManager?: string; // New field
  employeeManager?: string; // New field
  attachment_url?: string;
  attachment_name?: string;
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
  imageUrl?: string;
}

// Feed Types
export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorLevel?: number;
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
  authorLevel?: number;
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
    banners?: boolean;
    [key: string]: boolean | string | number | undefined;
}

export interface Plan {
  id: string;
  name: string;
  userLimit: number;
  whatsappLimit: number; // Novo campo
  emailLimit: number; // Novo campo
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
  custom_features?: Record<string, boolean | string>; // Overrides for plan features
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
  is_muted?: boolean; // Novo: silenciar notificações
  is_group?: boolean;
  last_away_message_at?: string | null;
  protocol_number?: string | null;
  protocol_created_at?: string | null;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  message_text: string | null;
  media_url?: string;
  media_type?: string;
  is_from_customer: boolean;
  sent_by?: string; // profile_id (null if customer)
  sender_phone?: string;
  sender_name?: string;
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
  user_id?: string; // New: vincula a conexão a um usuário específico
  phone_number?: string;
  connection_name?: string;
  reject_calls?: boolean;
  rejection_message?: string;
  is_connected: boolean;
  qr_code?: string;
  channel_type?: 'whatsapp' | 'telegram' | 'instagram' | 'messenger';
  api_token?: string;
  last_sync_error?: string;
  pairing_code?: string;
  transfer_message_client?: string;
  transfer_message_agent?: string;
  send_transfer_message_to_client?: boolean;
}

export interface WhatsAppQueue {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  custom_hours?: boolean;
  business_hours?: any;
  away_message?: string | null;
}

export interface WhatsAppTag {
  id: string;
  company_id: string;
  name: string;
  color: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppKanbanColumn {
  id: string;
  company_id: string;
  name: string;
  color: string;
  order_index: number;
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
  queue?: {
    id: string;
    name: string;
    color?: string;
  };
  channel?: {
    channel_type?: 'whatsapp' | 'telegram' | 'instagram' | 'messenger';
    connection_name?: string;
  };
  tags?: WhatsAppConversationTag[];
  kanban_column?: WhatsAppKanbanColumn;
  notes_count?: number;
  is_billable: boolean;
  hourly_rate?: number;
  created_at: string;
}

export interface ActiveChatHead {
  conversationId: string;
  participantName: string;
  participantAvatarUrl: string;
  participantId?: string;
}

export interface CompanyBadge {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  created_at?: string;
  xp?: number;
}

export interface UserBadge {
  id: string;
  company_id: string;
  user_id: string;
  badge_id: string;
  awarded_by?: string;
  reason?: string;
  is_equipped: boolean;
  created_at?: string;
  company_badges?: CompanyBadge; // Quando carregado via join
}

export interface SchedulingEventType {
  id: string;
  company_id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  duration: number;
  duration_unit?: 'minutes' | 'hours' | 'days';
  disable_time_slots?: boolean;
  is_paid: boolean;
  price: number;
  requirements: {
    phone?: boolean;
    cnpj?: boolean;
    company_name?: boolean;
    cpf?: boolean;
    allow_multiple_bookings?: boolean;
    event_mode?: 'appointments' | 'events';
  };
  availability: {
    days: number[]; // ex: [1, 2, 3, 4, 5]
    startTime: string; // "09:00"
    endTime: string; // "18:00"
    specific_date?: string | null;
  };
  is_active: boolean;
  has_capacity_limit: boolean;
  capacity_limit: number;
  show_capacity_to_guest: boolean;
  has_lunch_break: boolean;
  lunch_start_time?: string;
  lunch_end_time?: string;
  photos?: string[];
  created_at?: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

export interface SchedulingBooking {
  id: string;
  company_id: string;
  event_type_id: string;
  host_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_company_name?: string;
  guest_cnpj?: string;
  guest_cpf?: string;
  booking_date: string; // YYYY-MM-DD
  booking_time: string; // HH:MM
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'free';
  price: number;
  notes?: string;
  created_at?: string;
  event_types?: SchedulingEventType;
}

export interface SchedulingSettings {
  company_id: string;
  company_name?: string;
  logo_url?: string;
  created_at?: string;
}

export interface SchedulingTemplate {
  id: string;
  company_id: string;
  owner_id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at?: string;
}

