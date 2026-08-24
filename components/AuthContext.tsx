import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import type { Employee } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Employee | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string, email?: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error || !data) {
                // FALLBACK FOR MASTER ADMIN
                if ((email || '').toLowerCase() === 'ti@acrilight.com.br') {
                    console.log("Profile not found for Master Admin, using fallback.");
                    const masterAdmin: Employee = {
                        id: userId,
                        name: 'Master TI',
                        email: email || 'ti@grupopixel.com.br',
                        role: 'Super Admin',
                        team: 'Admin',
                        avatarUrl: data?.avatar_url || 'https://ui-avatars.com/api/?name=Master+TI',
                        joinDate: new Date().toISOString(),
                        birthDate: new Date().toISOString(),
                        isAdmin: true,
                        isOnline: true,
                        permissions: {
                            viewMessages: true, viewCalendar: true, useMarketplace: true,
                            canPostText: true, canPostImage: true, canPostVideo: true,
                            viewDirectory: true, viewForms: true, viewBenefits: true,
                            viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                            viewTiDashboard: true, openTickets: true, openTiRequests: true,
                            viewTraining: true, viewSurveys: true, viewPolicies: true, viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true
                        },
                        following: [],
                        phone: '',
                        officeLocation: '',
                        bio: ''
                    };
                    setProfile(masterAdmin);
                    return;
                }

                console.error('Erro ao buscar perfil:', error);
                return;
            }

            if (data) {
                const isMasterAdmin = (email || '').toLowerCase() === 'ti@acrilight.com.br';

                const employee: Employee = {
                    id: data.id,
                    name: isMasterAdmin ? 'Master TI' : (data.full_name || 'Usuário'),
                    email: email || '',
                    role: isMasterAdmin ? 'Super Admin' : (data.role || 'Visitante'),
                    team: isMasterAdmin ? 'Admin' : (data.team || 'Geral'),
                    avatarUrl: data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name || 'User')}`,
                    joinDate: data.join_date || new Date().toISOString(),
                    birthDate: data.birth_date || new Date().toISOString(),
                    isAdmin: isMasterAdmin ? true : (data.is_admin || false),
                    isOnline: true, // Isso seria em tempo real em um app completo
                    permissions: isMasterAdmin ? {
                        viewMessages: true, viewCalendar: true, useMarketplace: true,
                        canPostText: true, canPostImage: true, canPostVideo: true,
                        viewDirectory: true, viewForms: true, viewBenefits: true,
                        viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                        viewTiDashboard: true, openTickets: true, openTiRequests: true,
                        viewTraining: true, viewSurveys: true, viewPolicies: true, viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true
                    } : (data.permissions || {}),
                    following: data.following || [],
                    phone: data.phone || '',
                    officeLocation: data.office_location || '',
                    bio: data.bio || '',
                    isCompanyAdmin: data.is_company_admin || false
                };
                setProfile(employee);
            }
        } catch (err) {
            console.error('Erro inesperado ao buscar perfil:', err);
        }
    };

    useEffect(() => {
        // Obter sessão inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email);
            } else {
                setLoading(false);
            }
        });

        // Ouvir por mudanças na autenticação
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
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
