import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import type { Employee } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Employee | null;
    currentUser: Employee | null;
    realProfile: Employee | null;
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
    realProfile: null,
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
    const [realProfile, setRealProfile] = useState<Employee | null>(null);
    // Ghost nunca nasce autorizado apenas por localStorage.
    // A restauracao somente acontece depois que o perfil REAL
    // autenticado for carregado e confirmado como Super Admin.
    const [impersonatedUser, setImpersonatedUser] = useState<Employee | null>(null);
    const [isGhostMode, setIsGhostMode] = useState(false);
    const [loading, setLoading] = useState(true);

    const clearGhostStorage = () => {
        localStorage.removeItem('pixel_is_ghost_mode');
        localStorage.removeItem('pixel_ghost_user_data');
        localStorage.removeItem('pixel_is_impersonating');
        localStorage.removeItem('pixel_impersonated_company');
    };

    const setGhostData = (isGhost: boolean, ghostUser: Employee | null = null) => {
        if (!isGhost) {
            setIsGhostMode(false);
            setImpersonatedUser(null);
            clearGhostStorage();
            return;
        }

        const realGhostAuthority =
            realProfile?.role === 'Super Admin'
            && (
                !(realProfile as any)?.status
                || (realProfile as any)?.status === 'active'
            );

        if (!realGhostAuthority) {
            console.error(
                '[Ghost Audit] Ativacao recusada: perfil real sem autoridade.'
            );

            setIsGhostMode(false);
            setImpersonatedUser(null);
            clearGhostStorage();
            return;
        }

        if (!ghostUser?.id || !ghostUser?.company_id) {
            console.error(
                '[Ghost Audit] Ativacao recusada: contexto Ghost invalido.'
            );

            setIsGhostMode(false);
            setImpersonatedUser(null);
            clearGhostStorage();
            return;
        }

        setIsGhostMode(true);
        setImpersonatedUser(ghostUser);

        localStorage.setItem(
            'pixel_is_ghost_mode',
            'true'
        );

        localStorage.setItem(
            'pixel_ghost_user_data',
            JSON.stringify(ghostUser)
        );
    };

    // Restaura Ghost somente depois de validar o perfil REAL.
    useEffect(() => {
        if (loading) return;

        const storedGhost =
            localStorage.getItem('pixel_is_ghost_mode') === 'true';

        if (!storedGhost) return;

        const authorized =
            realProfile?.role === 'Super Admin'
            && (
                !(realProfile as any)?.status
                || (realProfile as any)?.status === 'active'
            );

        if (!authorized) {
            setIsGhostMode(false);
            setImpersonatedUser(null);
            clearGhostStorage();
            return;
        }

        const raw =
            localStorage.getItem('pixel_ghost_user_data');

        if (!raw) {
            setIsGhostMode(false);
            setImpersonatedUser(null);
            clearGhostStorage();
            return;
        }

        try {
            const restored = JSON.parse(raw) as Employee;

            if (
                !restored?.id
                || !restored?.company_id
            ) {
                throw new Error(
                    'Contexto Ghost persistido invalido'
                );
            }

            setImpersonatedUser(restored);
            setIsGhostMode(true);

        } catch (error) {
            console.error(
                '[Ghost Audit] Restauracao recusada:',
                error
            );

            setIsGhostMode(false);
            setImpersonatedUser(null);
            clearGhostStorage();
        }

    }, [
        loading,
        realProfile?.id,
        realProfile?.role,
        (realProfile as any)?.status
    ]);

    const fetchProfile = async (userId: string, email?: string) => {
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
                            ai_assistant: true, viewScheduling: true, viewAgenda: true, viewReservations: true,
                            viewTimeBank: true, manageTimeBank: true, viewEmployeeBenefitsAdmin: true, viewPerformance: true, managePerformance: true
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
                        quick_links: data?.quick_links || [],
                        xp: data?.xp || 0,
                        level: data?.level || 1,
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
                    setRealProfile(masterAdmin);
                    return;
                }
                return;
            }

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
                viewJobs: true, manageJobs: true, viewMeuRH: true, viewOrgChart: true, viewKPIDashboard: true, manageKPIs: true,
                viewScheduling: true, viewAgenda: true, viewReservations: true,
                viewTimeBank: true, manageTimeBank: true, viewEmployeeBenefitsAdmin: true, viewPerformance: true, managePerformance: true,
                admin_view_dp: true, admin_view_gestao_rh: true, admin_view_administrativo: true
            };

            const defaultEmployeePermissions = {
                viewMessages: true, viewCalendar: true, useMarketplace: true,
                canPostText: true, canPostImage: true, canPostVideo: true,
                viewDirectory: true, viewForms: true, viewBenefits: true,
                viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                viewTiDashboard: false, openTickets: true, openTiRequests: true,
                viewTraining: true, viewSurveys: true, viewPolicies: true,
                viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true,
                createEvents: false, manageMarketplace: false, viewEmail: true, viewWhatsPanda: false, viewProjects: true,
                viewEmployeeDetails: false, editEmployeeProfile: false, deleteEmployeeProfile: false,
                viewVacationRequests: false, manageVacationRequests: false,
                viewJobs: true, manageJobs: false, viewMeuRH: true, viewOrgChart: true, viewKPIDashboard: true, manageKPIs: false,
                viewScheduling: true, viewAgenda: true, viewReservations: true,
                viewTimeBank: true, manageTimeBank: false, viewEmployeeBenefitsAdmin: false, viewPerformance: true, managePerformance: false,
                admin_view_dp: false, admin_view_gestao_rh: false, admin_view_administrativo: false
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
                } : {
                    ...defaultEmployeePermissions,
                    ...(data.permissions || {})
                },
                    following: data.following || [],
                    phone: data.phone || '',
                    officeLocation: data.office_location || '',
                    bio: data.bio || '',
                    rg: data.rg || '',
                    cpf: data.cpf || '',
                    emergency_contact_name: data.emergency_contact_name || '',
                    emergency_contact_phone: data.emergency_contact_phone || '',
                    health_insurance: data.health_insurance || '',
                    blood_type: data.blood_type || '',
                    marital_status: data.marital_status || '',
                    education_level: data.education_level || '',
                    isCompanyAdmin: data.is_company_admin || false,
                    quick_links: data.quick_links || [],
                    company_id: data.company_id,
                    status: data.status,
                    xp: data.xp || 0,
                    level: data.level || 1,
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
                    plan_whatsapp_limit: isMasterAdmin ? 100 : planWhatsappLimit,
                    company: data.company
                };

                // Carregar níveis da empresa e salvar no localStorage
                if (data.company_id) {
                    try {
                        const { data: levelsData, error: levelsError } = await supabase
                            .from('company_levels')
                            .select('*')
                            .eq('company_id', data.company_id)
                            .order('level_number', { ascending: true });

                        if (levelsError || !levelsData || levelsData.length === 0) {
                            const defaultLevels = [
                                { level_number: 1, name: 'Membro', required_xp: 0 },
                                { level_number: 2, name: 'Bronze', required_xp: 100 },
                                { level_number: 3, name: 'Prata', required_xp: 250 },
                                { level_number: 4, name: 'Ouro', required_xp: 500 },
                                { level_number: 5, name: 'Platina', required_xp: 800 },
                                { level_number: 6, name: 'Esmeralda', required_xp: 1200 },
                                { level_number: 7, name: 'Safira', required_xp: 1700 },
                                { level_number: 8, name: 'Rubi', required_xp: 2300 },
                                { level_number: 9, name: 'Diamante', required_xp: 3000 },
                                { level_number: 10, name: 'Lendário', required_xp: 4000 }
                            ];
                            const insertPayload = defaultLevels.map(lvl => ({
                                company_id: data.company_id,
                                level_number: lvl.level_number,
                                name: lvl.name,
                                required_xp: lvl.required_xp
                            }));
                            const { data: insertedData } = await supabase.from('company_levels').insert(insertPayload).select();
                            localStorage.setItem('pixel_company_levels', JSON.stringify(insertedData || insertPayload));
                        } else {
                            localStorage.setItem('pixel_company_levels', JSON.stringify(levelsData));
                        }
                    } catch (levelsErr) {
                        console.error("Erro ao carregar níveis da empresa:", levelsErr);
                    }
                }

                setRealProfile(employee);
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
                setRealProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        setRealProfile(null);
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
            profile: impersonatedUser || realProfile,
            currentUser: impersonatedUser || realProfile,
            realProfile,
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
