import React, { useState } from 'react';
import Card from './Card';
import type { OnboardingCategory } from '../types';
// FIX: Using local icon for consistency
import { CheckCircleIcon } from './icons';

const initialOnboardingData: OnboardingCategory[] = [
    {
        title: 'Sua Primeira Semana',
        steps: [
            { id: 1, title: 'Configure suas ferramentas', description: 'Acesse seu e-mail, Slack e outras ferramentas essenciais.', completed: true, link: {text: 'Guia de Ferramentas', url: '#'} },
            { id: 2, title: 'Conheça seu time', description: 'Participe da reunião de boas-vindas e agende cafés virtuais.', completed: true },
            { id: 3, title: 'Entenda nossos valores', description: 'Leia sobre nossa cultura e os valores que nos guiam.', completed: false, link: {text: 'Nosso Código de Cultura', url: '#'} },
            { id: 4, title: 'Complete os treinamentos iniciais', description: 'Acesse a plataforma de treinamento e conclua os módulos de integração.', completed: false },
        ]
    },
    {
        title: 'Seu Primeiro Mês',
        steps: [
            { id: 5, title: 'Alinhe suas metas com seu gestor', description: 'Converse sobre suas responsabilidades e expectativas para o primeiro trimestre.', completed: false },
            { id: 6, title: 'Explore a Base de Conhecimento', description: 'Navegue pelos documentos da sua área e entenda nossos processos.', completed: false, link: {text: 'Acessar Documentos', url: '#'} },
            { id: 7, title: 'Participe de um projeto', description: 'Comece a colaborar ativamente em um dos projetos da sua equipe.', completed: false },
        ]
    }
];

const OnboardingPage: React.FC = () => {
    const [onboardingData, setOnboardingData] = useState(initialOnboardingData);

    const toggleStep = (stepId: number) => {
        setOnboardingData(prevData =>
            prevData.map(category => ({
                ...category,
                steps: category.steps.map(step =>
                    step.id === stepId ? { ...step, completed: !step.completed } : step
                )
            }))
        );
    };
    
    const totalSteps = onboardingData.reduce((acc, cat) => acc + cat.steps.length, 0);
    const completedSteps = onboardingData.reduce((acc, cat) => acc + cat.steps.filter(s => s.completed).length, 0);
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

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
                                    <button onClick={() => toggleStep(step.id)} className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-gray-300">
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