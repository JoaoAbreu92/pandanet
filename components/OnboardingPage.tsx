import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { OnboardingCategory, OnboardingStep } from '../types';
import { CheckCircleIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const OnboardingPage: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const [onboardingData, setOnboardingData] = useState<OnboardingCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            // Fetch all steps
            const { data: stepsData, error: stepsError } = await supabase
                .from('onboarding_steps')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('order', { ascending: true });

            if (stepsError) throw stepsError;

            // Fetch user progress
            const { data: progressData, error: progressError } = await supabase
                .from('user_onboarding')
                .select('step_id, completed')
                .eq('user_id', currentUser.id);

            if (progressError) throw progressError;

            // Create a map of completed steps
            const completedStepIds = new Set(
                progressData?.filter(p => p.completed).map(p => p.step_id) || []
            );

            // Group steps by category
            const groupedData: { [key: string]: OnboardingStep[] } = {};
            stepsData?.forEach((step: any) => {
                const category = step.category || 'Geral';
                if (!groupedData[category]) {
                    groupedData[category] = [];
                }
                groupedData[category].push({
                    id: step.id,
                    title: step.title,
                    description: step.description,
                    completed: completedStepIds.has(step.id),
                    link: step.link_text ? { text: step.link_text, url: step.link_url } : undefined
                });
            });

            // Convert to array format
            const categories: OnboardingCategory[] = Object.keys(groupedData).map(title => ({
                title,
                steps: groupedData[title]
            }));

            setOnboardingData(categories);
        } catch (error) {
            console.error('Error fetching onboarding data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUser?.company_id]);

    const toggleStep = async (stepId: number | string) => {
        if (!currentUser) return;

        // Find current status
        let isCurrentlyCompleted = false;
        onboardingData.forEach(cat => {
            const step = cat.steps.find(s => s.id === stepId);
            if (step) isCurrentlyCompleted = step.completed;
        });

        const newStatus = !isCurrentlyCompleted;

        // Optimistic update
        setOnboardingData(prevData =>
            prevData.map(category => ({
                ...category,
                steps: category.steps.map(step =>
                    step.id === stepId ? { ...step, completed: newStatus } : step
                )
            }))
        );

        try {
            // Upsert progress
            const { error } = await supabase
                .from('user_onboarding')
                .upsert(
                    {
                        user_id: currentUser.id,
                        step_id: stepId,
                        completed: newStatus,
                        completed_at: newStatus ? new Date().toISOString() : null,
                        company_id: currentUser.company_id
                    },
                    { onConflict: 'user_id, step_id' }
                );

            if (error) throw error;
        } catch (error) {
            console.error('Error updating step:', error);
            // Revert on error
            setOnboardingData(prevData =>
                prevData.map(category => ({
                    ...category,
                    steps: category.steps.map(step =>
                        step.id === stepId ? { ...step, completed: isCurrentlyCompleted } : step
                    )
                }))
            );
            alert('Erro ao atualizar progresso. Tente novamente.');
        }
    };

    const totalSteps = onboardingData.reduce((acc, cat) => acc + cat.steps.length, 0);
    const completedSteps = onboardingData.reduce((acc, cat) => acc + cat.steps.filter(s => s.completed).length, 0);
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando guia de integração...</div>;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="p-8 bg-brand-primary text-white rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold">Bem-vindo(a) à Equipe!</h1>
                <p className="mt-2 text-emerald-100 text-lg">Estamos muito felizes em ter você conosco. Este guia irá ajudá-lo(a) em seus primeiros passos.</p>
            </div>

            <Card title="Progresso da Integração">
                <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                        className="bg-green-500 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                    ></div>
                </div>
                <p className="text-right text-sm text-brand-subtle-text mt-2">{completedSteps} de {totalSteps} passos concluídos</p>
            </Card>

            {onboardingData.map(category => (
                <Card key={category.title} title={category.title}>
                    <div className="space-y-4">
                        {category.steps.map(step => (
                            <div key={step.id} className={`p-4 rounded-lg flex items-start space-x-4 transition-colors ${step.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                                <div className="flex-shrink-0">
                                    <button onClick={() => toggleStep(step.id)} className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-gray-300 hover:border-brand-primary transition-colors">
                                        {step.completed && <CheckCircleIcon className="w-6 h-6 text-brand-primary" />}
                                    </button>
                                </div>
                                <div className="flex-grow">
                                    <h4 className={`font-semibold text-brand-text ${step.completed ? 'line-through text-gray-400' : ''}`}>
                                        {step.title}
                                    </h4>
                                    <p className={`text-sm text-brand-subtle-text ${step.completed ? 'line-through' : ''}`}>
                                        {step.description}
                                    </p>
                                    {step.link && (
                                        <a href={step.link.url} className="mt-1 inline-block text-sm font-medium text-brand-primary hover:underline">
                                            {step.link.text} &rarr;
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default OnboardingPage;