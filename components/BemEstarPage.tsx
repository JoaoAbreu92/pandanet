import React from 'react';
import Card from './Card';
import { HeartIcon, SparklesIcon } from './icons';

const BemEstarPage: React.FC = () => {
    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-brand-text">Portal de Bem-Estar</h1>
                <p className="mt-2 text-lg text-brand-subtle-text">Recursos e dicas para cuidar da sua saúde física e mental.</p>
            </div>

            <Card title="Saúde Mental" className="bg-blue-50 border-blue-200">
                <div className="space-y-3">
                    <p className="text-brand-subtle-text">Sua saúde mental é importante. Oferecemos suporte e recursos para ajudá-lo a manter o equilíbrio.</p>
                    <div>
                        <h4 className="font-semibold text-brand-text">Recursos Disponíveis:</h4>
                        <ul className="list-disc list-inside text-brand-subtle-text text-sm space-y-1 mt-2">
                            <li>Sessões de terapia online com nossos parceiros.</li>
                            <li>Acesso a aplicativos de meditação e mindfulness.</li>
                            <li>Workshops sobre gerenciamento de estresse e ansiedade.</li>
                            <li>Canal de apoio confidencial e seguro.</li>
                        </ul>
                    </div>
                    <a href="#" className="font-medium text-blue-600 hover:underline">Acessar portal de saúde mental</a>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <Card title="Atividade Física" className="bg-green-50 border-green-200">
                     <div className="space-y-3">
                        <p className="text-brand-subtle-text">Movimente-se! Encontre atividades que você ama e mantenha um estilo de vida ativo.</p>
                        <div>
                            <h4 className="font-semibold text-brand-text">Iniciativas:</h4>
                            <ul className="list-disc list-inside text-brand-subtle-text text-sm space-y-1 mt-2">
                                <li>Desafios de passos mensais com prêmios.</li>
                                <li>Aulas de ginástica laboral online.</li>
                                <li>Parceria com academias (Gympass).</li>
                            </ul>
                        </div>
                        <a href="#" className="font-medium text-green-600 hover:underline">Ver desafios do mês</a>
                    </div>
                </Card>
                
                <Card title="Nutrição" className="bg-yellow-50 border-yellow-200">
                    <div className="space-y-3">
                        <p className="text-brand-subtle-text">Alimentar-se bem é a base para ter energia e disposição no dia a dia.</p>
                        <div>
                           <h4 className="font-semibold text-brand-text">Dicas e Programas:</h4>
                             <ul className="list-disc list-inside text-brand-subtle-text text-sm space-y-1 mt-2">
                                <li>Webinars com nutricionistas.</li>
                                <li>Dicas de receitas saudáveis no canal do Slack.</li>
                                <li>Programa de reeducação alimentar.</li>
                            </ul>
                        </div>
                         <a href="#" className="font-medium text-yellow-600 hover:underline">Ver próximas palestras</a>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default BemEstarPage;
