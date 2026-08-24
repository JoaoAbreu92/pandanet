import type { Company, Plan, EmployeePermissions, AppData, ResourceDocument, Benefit, Poll, Post, Conversation, Employee } from './types';

const basePermissions: EmployeePermissions = {
    viewMessages: true,
    viewCalendar: true,
    useMarketplace: true,

    canPostText: true,
    canPostImage: true,
    canPostVideo: true,

    viewDirectory: true,
    viewForms: true,
    viewBenefits: true,
    viewOnboarding: true,
    viewRecognition: true,
    viewDocuments: true,
    viewWellbeing: true,
    viewTiDashboard: true,
    openTickets: true,
    openTiRequests: true,

    // New Permissions
    viewTraining: true,
    viewSurveys: true,
    viewPolicies: true,
    viewKnowledgeBase: true,
    viewServiceStatus: true,
    viewInfoSec: true,
};

const proPlanFeatures: Plan['features'] = {
    ...basePermissions,
};

const enterprisePlanFeatures: Plan['features'] = {
    ...proPlanFeatures,
};

export const mockPlans: Plan[] = [
    { id: 'free', name: 'Grátis', userLimit: 10, features: { ...basePermissions, viewTiDashboard: false, openTiRequests: false } },
    { id: 'pro', name: 'Pro', userLimit: 50, features: proPlanFeatures },
    { id: 'enterprise', name: 'Empresarial', userLimit: 1000, features: enterprisePlanFeatures },
];

// CLEARED MOCK DATA ARRAYS
const mockDocuments: ResourceDocument[] = [];
const mockBenefits: Benefit[] = [];
const mockPolls: Poll[] = [];
const employees: Employee[] = [];
const mockFeedPosts: Post[] = [];
const mockTrainings: any[] = [];
const mockKBArticles: any[] = [];
const mockServices: any[] = [];
const mockSecurityAlerts: any[] = [];
const conversations: Conversation[] = [];

export const mockCompanies: Company[] = [
    {
        domain: 'demo.com',
        name: 'Minha Intranet',
        plan: {
            id: 'enterprise',
            name: 'Enterprise',
            userLimit: 1000,
            features: {
                viewMessages: true, viewCalendar: true, useMarketplace: true,
                canPostText: true, canPostImage: true, canPostVideo: true,
                viewDirectory: true, viewForms: true, viewBenefits: true,
                viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                viewTiDashboard: true, openTickets: true, openTiRequests: true,
                viewTraining: true, viewSurveys: true, viewPolicies: true, viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true
            }
        },
        subscriptionEndDate: '2030-12-31',
        settings: {
            companyName: 'Minha Intranet',
            logoUrl: ''
        },
        data: {
            employees: employees,
            announcements: [],
            banners: [],
            conversations: [],
            tickets: [],
            marketplaceItems: [],
            formSubmissions: [],
            tiRequests: [],
            documents: [],
            benefits: [],
            polls: [],
            feedPosts: [],
            events: [],
            trainings: [],
            kbArticles: [],
            services: [],
            securityAlerts: [],
            recognitions: [],
            wellnessItems: []
        }
    }
]; 