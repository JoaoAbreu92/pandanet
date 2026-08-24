import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon } from './icons';
import type { Recognition, Employee } from '../types';
import RecognitionModal from './RecognitionModal';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const RecognitionCard: React.FC<{ recognition: Recognition }> = ({ recognition }) => {
    const valueColors: { [key: string]: string } = {
        'Trabalho em Equipe': 'bg-blue-100 text-blue-800',
        'Inovação': 'bg-purple-100 text-purple-800',
        'Foco no Cliente': 'bg-green-100 text-green-800',
        'Qualidade': 'bg-yellow-100 text-yellow-800',
    };

    return (
        <div className="flex-shrink-0 w-72 bg-white p-4 rounded-lg shadow-md border space-y-3">
            <div className="flex items-center">
                <img src={recognition.toAvatar} alt={recognition.to} className="w-10 h-10 rounded-full z-10 object-cover" />
                <img src={recognition.fromAvatar} alt={recognition.from} className="w-10 h-10 rounded-full -ml-4 object-cover" />
                <div className="ml-3">
                    <p className="font-semibold text-sm text-brand-text">{recognition.to}</p>
                    <p className="text-xs text-brand-subtle-text">Reconhecido por {recognition.from}</p>
                </div>
            </div>
            <p className="text-sm text-brand-subtle-text italic">"{recognition.message}"</p>
            <div className="pt-2">
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${valueColors[recognition.value] || 'bg-gray-100 text-gray-800'}`}>
                    #{recognition.value.replace(' ', '')}
                </span>
            </div>
        </div>
    );
};

const RecognitionWall: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const { addNotification } = useNotifications();
    const [recognitions, setRecognitions] = useState<Recognition[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser?.company_id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch employees for the modal
                const { data: employeesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, role')
                    .eq('company_id', currentUser.company_id);

                if (employeesData) {
                    setEmployees(employeesData.map((e: any) => ({
                        id: e.id,
                        name: e.full_name,
                        role: e.role,
                        avatarUrl: e.avatar_url,
                        email: '', // Not needed for this
                        department: '',
                        joinDate: '',
                    })));
                }

                // Fetch recognitions
                const { data: recognitionsData, error } = await supabase
                    .from('recognitions')
                    .select(`
                        id,
                        message,
                        type,
                        created_at,
                        from:from_id(full_name, avatar_url),
                        to:to_id(full_name, avatar_url)
                    `)
                    .eq('company_id', currentUser.company_id)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching recognitions:', error);
                } else if (recognitionsData) {
                    const formattedRecognitions: Recognition[] = recognitionsData.map((r: any) => ({
                        id: r.id,
                        from: (r.from as any)?.full_name || 'Desconhecido',
                        fromAvatar: (r.from as any)?.avatar_url || 'https://via.placeholder.com/150',
                        to: (r.to as any)?.full_name || 'Desconhecido',
                        toAvatar: (r.to as any)?.avatar_url || 'https://via.placeholder.com/150',
                        message: r.message,
                        value: r.type as any,
                        date: r.created_at
                    }));
                    setRecognitions(formattedRecognitions);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Realtime subscription
        const subscription = supabase
            .channel('public:recognitions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recognitions', filter: `company_id=eq.${currentUser.company_id}` }, () => {
                fetchData(); // Refetch on change to simplify joins
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentUser?.company_id]);

    const handleRecognitionSubmit = async (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'> & { toUserId: string }) => {
        if (!currentUser) return;

        try {
            const { data: insertedData, error: insertError } = await supabase
                .from('recognitions')
                .insert([{
                    company_id: currentUser.company_id,
                    from_id: currentUser.id,
                    to_id: data.toUserId,
                    message: data.message,
                    type: data.value
                }])
                .select();

            if (insertError) throw insertError;

            // Enviar notificação para o usuário reconhecido
            await addNotification({
                user_id: data.toUserId,
                company_id: currentUser.company_id,
                type: 'mention',
                title: 'Novo Reconhecimento!',
                description: `${currentUser.full_name} reconheceu você: "${data.message}"`,
                avatarUrl: currentUser.avatar_url,
                link: '/'
            });
            // Subscription will handle refresh
        } catch (error: any) {
            console.error('Error adding recognition:', error);
            alert('Erro ao enviar reconhecimento: ' + (error.message || 'Erro desconhecido.'));
        }
    };

    return (
        <>
            <Card title="Mural de Reconhecimento" headerAction={
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!currentUser}
                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>Reconhecer</span>
                </button>
            }>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Carregando reconhecimentos...</div>
                ) : recognitions.length > 0 ? (
                    <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        {recognitions.map(rec => (
                            <RecognitionCard key={rec.id} recognition={rec} />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500 italic">
                        Nenhum reconhecimento ainda. Seja o primeiro a reconhecer um colega!
                    </div>
                )}
            </Card>

            {currentUser && (
                <RecognitionModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleRecognitionSubmit}
                    employees={employees}
                    currentUserId={currentUser.id}
                />
            )}
        </>
    );
};

export default RecognitionWall;