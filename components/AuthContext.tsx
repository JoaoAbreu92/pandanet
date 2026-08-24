import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import type { Employee } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Employee | null;
    currentUser: Employee | null;
    /** @deprecated Use profile for real user, currentUser for context user */
    impersonatedUser: Employee | null;
    isGhostMode: boolean;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    setGhostData: (isGhost: boolean, ghostUser?: Employee | null) => void;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    currentUser: null,
    impersonatedUser: null,
    isGhostMode: false,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
    setGhostData: () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Employee | null>(null);
    const [impersonatedUser, setImpersonatedUser] = useState<Employee | null>(() => {
        const saved = localStorage.getItem('pixel_ghost_user_data');
        return saved ? JSON.parse(saved) : null;
    });
    const [isGhostMode, setIsGhostMode] = useState(() => localStorage.getItem('pixel_is_ghost_mode') === 'true');
    const [loading, setLoading] = useState(true);

    const setGhostData = (isGhost: boolean, ghostUser: Employee | null = null) => {
        setIsGhostMode(isGhost);
        setImpersonatedUser(ghostUser);
        if (isGhost) {
            localStorage.setItem('pixel_is_ghost_mode', 'true');
            if (ghostUser) {
                localStorage.setItem('pixel_ghost_user_data', JSON.stringify(ghostUser));
            } else {
                localStorage.removeItem('pixel_ghost_user_data');
            }
        } else {
            localStorage.removeItem('pixel_is_ghost_mode');
            localStorage.removeItem('pixel_ghost_user_data');
        }
    };

    const fetchProfile = async (userId: string, email?: string) => {
        // ... (resto da função permanece igual, vou omitir para o replacement mas manter no arquivo)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, company:companies(*, plan:plans(*))')
                .eq('id', userId)
                .single();

            if (error || !data) {
                const isMaster = (email || '').toLowerCase() === 'ti@grupopixel.com.br';
                if (isMaster) {
                    let targetId = undefined;
                    try {
                        const { data: comp } = await supabase.from('companies').select('id').eq('domain', 'grupopixel.com.br').single();
                        if (comp) targetId = comp.id;
                    } catch (e) { }

                    const masterAdmin: Employee = {
                        id: userId,
                        name: 'Master Admin',
                        email: email || 'ti@grupopixel.com.br',
                        role: 'Super Admin',
                        team: 'Admin',
                        avatarUrl: data?.avatar_url || 'https://ui-avatars.com/api/?name=Master+TI',
                        joinDate: new Date().toISOString(),
                        birthDate: new Date().toISOString(),
                        isAdmin: true,
                        isOnline: true,
                        company_id: targetId,
                        permissions: {
                            viewMessages: true, viewCalendar: true, useMarketplace: true,
                            canPostText: true, canPostImage: true, canPostVideo: true,
                            viewDirectory: true, viewForms: true, viewBenefits: true,
                            viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                            viewTiDashboard: true, openTickets: true, openTiRequests: true,
                            viewTraining: true, viewSurveys: true, viewPolicies: true,
                            viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true,
                            createEvents: true, manageMarketplace: true, viewEmail: true, viewWhatsPanda: true, viewProjects: true,
                            viewEmployeeDetails: true, editEmployeeProfile: true, deleteEmployeeProfile: true,
                            viewVacationRequests: true, manageVacationRequests: true,
                            viewJobs: true, manageJobs: true, viewMeuRH: true, viewOrgChart: true, viewKPIDashboard: true, manageKPIs: true,
                            ai_assistant: true
                        },
                        following: [],
                        phone: '',
                        officeLocation: '',
                        bio: '',
                        rg: '',
                        cpf: '',
                        emergency_contact_name: '',
                        emergency_contact_phone: '',
                        health_insurance: '',
                        blood_type: '',
                        marital_status: '',
                        education_level: '',
                        status: 'active',
                        ai_api_key: data?.ai_api_key || null,
                        ai_provider: data?.ai_provider || null,
                        ai_behavior: data?.ai_behavior || null,
                        can_nudge: true,
                        nudge_cooldown: 30,
                        email_permissions: {
                            can_manage_accounts: true,
                            can_view_all_accounts: true,
                            account_limit: 100
                        },
                        plan_email_limit: 100,
                        plan_whatsapp_limit: 100
                    };
                    setProfile(masterAdmin);
                    return;
                }
                return;
            }

            if (data) {
                const isMasterAdmin = (email || '').toLowerCase() === 'ti@grupopixel.com.br';
                const defaultAdminPermissions = {
                    viewMessages: true, viewCalendar: true, useMarketplace: true,
                    canPostText: true, canPostImage: true, canPostVideo: true,
                    viewDirectory: true, viewForms: true, viewBenefits: true,
                    viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                    viewTiDashboard: true, openTickets: true, openTiRequests: true,
                    viewTraining: true, viewSurveys: true, viewPolicies: true,
                    viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true,
                    createEvents: true, manageMarketplace: true, viewEmail: true, viewWhatsPanda: true, viewProjects: true,
                    viewEmployeeDetails: true, editEmployeeProfile: true, deleteEmployeeProfile: true,
                    viewVacationRequests: true, manageVacationRequests: true,
                    viewJobs: true, manageJobs: true, viewMeuRH: true, viewOrgChart: true, viewKPIDashboard: true, manageKPIs: true
                };

                const planEmailLimit = data.company?.plan?.email_limit;
                const planWhatsappLimit = data.company?.plan?.whatsapp_limit;

                const employee: Employee = {
                    id: data.id,
                    name: isMasterAdmin ? 'Master Admin' : (data.full_name || 'Usuário'),
                    email: email || '',
                    role: isMasterAdmin ? 'Super Admin' : (data.role || 'Visitante'),
                    team: isMasterAdmin ? 'Admin' : (data.team || 'Geral'),
                    avatarUrl: data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name || 'User')}`,
                    coverUrl: data.cover_url,
                    joinDate: data.join_date || new Date().toISOString(),
                    birthDate: data.birth_date || new Date().toISOString(),
                    isAdmin: isMasterAdmin ? true : (data.is_admin || false),
                    isOnline: true,
                    permissions: (isMasterAdmin || data.is_company_admin || data.is_admin) ? {
                        ...defaultAdminPermissions,
                        ...(data.permissions || {})
                    } : (data.permissions || {}),
                    following: data.following || [],
                    phone: data.phone || '',
                    officeLocation: data.office_location || '',
                    bio: data.bio || '',
                    isCompanyAdmin: data.is_company_admin || false,
                    company_id: data.company_id,
                    status: data.status,
                    ai_api_key: data.ai_api_key || null,
                    ai_provider: data.ai_provider || null,
                    ai_behavior: data.ai_behavior || null,
                    whatsapp_signature: data.whatsapp_signature || '',
                    use_whatsapp_signature: data.use_whatsapp_signature || false,
                    whatspanda_permissions: data.whatspanda_permissions || null,
                    can_nudge: data.can_nudge ?? true,
                    nudge_cooldown: data.nudge_cooldown ?? 30,
                    email_permissions: data.email_permissions || {
                        can_manage_accounts: isMasterAdmin || data.is_company_admin || false,
                        can_view_all_accounts: isMasterAdmin || data.is_company_admin || false,
                        account_limit: isMasterAdmin ? 100 : (planEmailLimit || 1)
                    },
                    plan_email_limit: isMasterAdmin ? 100 : planEmailLimit,
                    plan_whatsapp_limit: isMasterAdmin ? 100 : planWhatsappLimit
                };
                setProfile(employee);
            }
        } catch (err) { }
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id, user.email);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false));
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        setProfile(null);
        setSession(null);
        setUser(null);
        localStorage.removeItem('pixel_is_ghost_mode');
        localStorage.removeItem('pixel_ghost_user_data');
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            session,
            user,
            profile,
            currentUser: impersonatedUser || profile,
            impersonatedUser,
            isGhostMode,
            loading,
            signOut,
            refreshProfile,
            setGhostData
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
