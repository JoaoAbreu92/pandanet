import React from 'react';
import Card from './Card';
import { SparklesIcon, PlusIcon } from './icons';
// FIX: Correcting the import path for types.
import type { Recognition } from '../types';

const mockRecognitions: Recognition[] = [
    {
        id: 1,
        to: 'Jane Smith',
        from: 'John Doe',
        toAvatar: 'https://picsum.photos/id/1011/100/100',
        fromAvatar: 'https://picsum.photos/id/1005/100/100',
        message: 'Obrigado pela ajuda incrível no design do novo dashboard. Ficou fantástico!',
        value: 'Trabalho em Equipe'
    },
    {
        id: 2,
        to: 'Peter Jones',
        from: 'Ana Williams',
        toAvatar: 'https://picsum.photos/id/1025/100/100',
        fromAvatar: 'https://picsum.photos/id/237/100/100',
        message: 'Sua solução para o problema no servidor foi genial e nos economizou muito tempo. Inovação pura!',
        value: 'Inovação'
    },
    {
        id: 3,
        to: 'Mary Johnson',
        from: 'Carlos Silva',
        toAvatar: 'https://picsum.photos/id/1027/100/100',
        fromAvatar: 'https://picsum.photos/id/1028/100/100',
        message: 'A análise de dados que você apresentou foi super clara e nos deu insights valiosos. Excelente!',
        value: 'Foco no Cliente'
    },
    {
        id: 4,
        to: 'Carlos Silva',
        from: 'Fernanda Lima',
        toAvatar: 'https://picsum.photos/id/1028/100/100',
        fromAvatar: 'https://picsum.photos/id/106/100/100',
        message: 'Parabéns pela entrega do novo front-end. A performance está incrível e a experiência do usuário melhorou muito.',
        value: 'Qualidade'
    }
];

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
                <img src={recognition.toAvatar} alt={recognition.to} className="w-10 h-10 rounded-full z-10" />
                <img src={recognition.fromAvatar} alt={recognition.from} className="w-10 h-10 rounded-full -ml-4" />
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
    return (
        <Card title="Mural de Reconhecimento" headerAction={
            <button className="flex items-center space-x-2 px-3 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600">
                <PlusIcon className="w-4 h-4" />
                <span>Reconhecer</span>
            </button>
        }>
            <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4">
                {mockRecognitions.map(rec => (
                    <RecognitionCard key={rec.id} recognition={rec} />
                ))}
            </div>
        </Card>
    );
};

export default RecognitionWall;