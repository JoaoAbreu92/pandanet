import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { ResourceDocument } from '../types';
import { SearchIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const ResourceCenter: React.FC = () => {
    const { currentUser } = useAuth();
    const [documents, setDocuments] = useState<ResourceDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchDocuments = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                const formattedDocs: ResourceDocument[] = data.map((doc: any) => ({
                    id: doc.id,
                    title: doc.title,
                    category: doc.category,
                    type: doc.file_type as any,
                    url: doc.url,
                    updatedAt: new Date(doc.created_at).toISOString().split('T')[0]
                }));
                setDocuments(formattedDocs);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [currentUser?.company_id]);

    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'PDF': return 'bg-red-100 text-red-800';
            case 'DOCX': return 'bg-blue-100 text-blue-800';
            case 'PPTX': return 'bg-orange-100 text-orange-800';
            case 'XLSX': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando documentos...</div>;

    return (
        <Card title="Biblioteca Corporativa" headerAction={
            <div className="relative w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar documentos..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-2 w-full border rounded-md bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
            </div>
        }>
            <div className="overflow-x-auto">
                {documents.length > 0 ? (
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Título do Documento</th>
                                <th scope="col" className="px-6 py-3">Categoria</th>
                                <th scope="col" className="px-6 py-3">Tipo</th>
                                <th scope="col" className="px-6 py-3">Última Atualização</th>
                                <th scope="col" className="px-6 py-3">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocuments.map(doc => (
                                <tr key={doc.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{doc.title}</td>
                                    <td className="px-6 py-4">{doc.category}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${getTypeStyle(doc.type)}`}>{doc.type}</span></td>
                                    <td className="px-6 py-4">{new Date(doc.updatedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                    <td className="px-6 py-4">
                                        <a href={doc.url} download target="_blank" rel="noreferrer" className="font-medium text-brand-primary hover:underline">Baixar</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-8 text-gray-500">Nenhum documento encontrado.</div>
                )}
            </div>
        </Card>
    );
};

export default ResourceCenter;