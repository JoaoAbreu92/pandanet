import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { ResourceDocument } from '../types';
import { SearchIcon, PlusIcon, XCircleIcon, PencilIcon, TrashIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const DocumentFormModal: React.FC<{
    document: Partial<ResourceDocument> | null;
    onClose: () => void;
    onSave: (doc: any, file?: File) => void;
}> = ({ document: doc, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: doc?.title || '',
        category: doc?.category || 'RH & Cultura',
    });
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!doc?.id && !file) {
            alert("Por favor, anexe um arquivo.");
            return;
        }
        setUploading(true);
        await onSave(doc?.id ? { ...doc, ...formData } : formData, file || undefined);
        setUploading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{doc?.id ? 'Editar Documento' : 'Adicionar Novo Documento'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Título</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Categoria</label><input type="text" name="category" value={formData.category} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Arquivo</label><input type="file" onChange={handleFileChange} required={!doc?.id} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100" />{file && <p className="text-xs mt-1 text-gray-500">Selecionado: {file.name}</p>}</div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={uploading} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:opacity-50">
                            {uploading ? 'Salvando...' : 'Salvar Documento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ResourceCenter: React.FC = () => {
    const { currentUser } = useAuth();
    const [documents, setDocuments] = useState<ResourceDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ResourceDocument | null>(null);
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
                    id: doc.id, // UUID
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

    const getFileType = (fileName: string): string => {
        const extension = fileName.split('.').pop()?.toUpperCase() || 'FILE';
        return extension;
    };

    const handleSave = async (docData: any, file?: File) => {
        if (!currentUser) return;
        try {
            let fileUrl = docData.url;
            let fileType = docData.type;
            let fileSize = 0;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const filePath = `${currentUser.company_id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath);

                fileUrl = data.publicUrl;
                fileType = getFileType(file.name);
                fileSize = file.size;
            }

            if (docData.id) {
                // Update
                const { error } = await supabase
                    .from('documents')
                    .update({
                        title: docData.title,
                        category: docData.category,
                        ...(file && {
                            url: fileUrl,
                            file_type: fileType,
                            size: fileSize
                        })
                    })
                    .eq('id', docData.id);

                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('documents')
                    .insert([{
                        title: docData.title,
                        category: docData.category,
                        file_type: fileType,
                        url: fileUrl,
                        size: fileSize,
                        company_id: currentUser.company_id
                    }]);

                if (error) throw error;
            }

            await fetchDocuments();
            setModalOpen(false);
            setEditingDoc(null);
            alert('Documento salvo com sucesso!');
        } catch (error) {
            console.error('Error saving document:', error);
            alert('Erro ao salvar documento.');
        }
    };

    const handleEdit = (doc: ResourceDocument) => {
        setEditingDoc(doc);
        setModalOpen(true);
    };

    const handleDelete = async (docId: string) => {
        if (window.confirm("Tem certeza que deseja apagar este documento?")) {
            try {
                const { error } = await supabase
                    .from('documents')
                    .delete()
                    .eq('id', docId);

                if (error) throw error;
                // Note: Not deleting from storage to avoid orphan issues if used elsewhere or complexity. Can be added later.
                setDocuments(documents.filter(d => d.id !== docId));
            } catch (error) {
                console.error('Error deleting document:', error);
                alert('Erro ao apagar documento.');
            }
        }
    };

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
        <>
            <Card title="Central de Documentos" headerAction={
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Buscar documentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-2 w-full border rounded-md bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                    </div>
                    {currentUser?.isAdmin && (
                        <button onClick={() => { setEditingDoc(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                            <PlusIcon className="w-4 h-4" />
                            <span>Adicionar</span>
                        </button>
                    )}
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
                                        <td className="px-6 py-4 flex items-center space-x-2">
                                            <a href={doc.url} download target="_blank" rel="noreferrer" className="font-medium text-brand-primary hover:underline">Baixar</a>
                                            {currentUser?.isAdmin && (
                                                <>
                                                    <button onClick={() => handleEdit(doc)} className="p-1 text-brand-subtle-text hover:text-brand-primary"><PencilIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(doc.id)} className="p-1 text-brand-subtle-text hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                                </>
                                            )}
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
            {isModalOpen && <DocumentFormModal document={editingDoc} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default ResourceCenter;