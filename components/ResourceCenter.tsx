import React, { useState } from 'react';
import Card from './Card';
import type { ResourceDocument, Employee } from '../types';
import { SearchIcon, PlusIcon, XCircleIcon, PencilIcon, TrashIcon } from './icons';

interface ResourceCenterProps {
    documents: ResourceDocument[];
    setDocuments: (documents: ResourceDocument[]) => void;
    currentUser: Employee;
}

const DocumentFormModal: React.FC<{
    document: Partial<ResourceDocument> | null;
    onClose: () => void;
    onSave: (doc: Omit<ResourceDocument, 'id' | 'updatedAt' | 'type' | 'url'> | ResourceDocument, file?: File) => void;
}> = ({ document: doc, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: doc?.title || '',
        category: doc?.category || 'RH & Cultura',
    });
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!doc?.id && !file) {
            alert("Por favor, anexe um arquivo.");
            return;
        }
        onSave(doc?.id ? { ...doc, ...formData } as ResourceDocument : formData, file || undefined);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{doc?.id ? 'Editar Documento' : 'Adicionar Novo Documento'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Título</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Categoria</label><input type="text" name="category" value={formData.category} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Arquivo</label><input type="file" onChange={handleFileChange} required={!doc?.id} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100"/>{file && <p className="text-xs mt-1 text-gray-500">Selecionado: {file.name}</p>}</div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Salvar Documento</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ResourceCenter: React.FC<ResourceCenterProps> = ({ documents, setDocuments, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ResourceDocument | null>(null);

    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const getFileType = (fileName: string): ResourceDocument['type'] => {
        const extension = fileName.split('.').pop()?.toUpperCase();
        switch (extension) {
            case 'PDF': return 'PDF';
            case 'DOCX': return 'DOCX';
            case 'PPTX': return 'PPTX';
            case 'XLSX': return 'XLSX';
            default: return 'OUTRO';
        }
    };

    const handleSave = (docData: Omit<ResourceDocument, 'id' | 'updatedAt' | 'type' | 'url'> | ResourceDocument, file?: File) => {
        if ('id' in docData) { // Editing
            setDocuments(documents.map(d => d.id === docData.id ? { ...docData, updatedAt: new Date().toISOString().split('T')[0] } : d));
        } else { // Creating
            if (!file) return;
            const newDoc: ResourceDocument = {
                ...docData,
                id: Date.now(),
                type: getFileType(file.name),
                url: URL.createObjectURL(file),
                updatedAt: new Date().toISOString().split('T')[0],
            };
            setDocuments([newDoc, ...documents]);
        }
        setModalOpen(false);
        setEditingDoc(null);
    };

    const handleEdit = (doc: ResourceDocument) => {
        setEditingDoc(doc);
        setModalOpen(true);
    };

    const handleDelete = (docId: number) => {
        if (window.confirm("Tem certeza que deseja apagar este documento?")) {
            setDocuments(documents.filter(d => d.id !== docId));
        }
    };

    const getTypeStyle = (type: ResourceDocument['type']) => {
        switch (type) {
            case 'PDF': return 'bg-red-100 text-red-800';
            case 'DOCX': return 'bg-blue-100 text-blue-800';
            case 'PPTX': return 'bg-orange-100 text-orange-800';
            case 'XLSX': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <>
            <Card title="Central de Documentos" headerAction={
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Buscar documentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-2 w-full border rounded-md bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                    </div>
                    {currentUser.isAdmin && (
                        <button onClick={() => { setEditingDoc(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                            <PlusIcon className="w-4 h-4" />
                            <span>Adicionar</span>
                        </button>
                    )}
                </div>
            }>
                <div className="overflow-x-auto">
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
                                        <a href={doc.url} download className="font-medium text-brand-primary hover:underline">Baixar</a>
                                        {currentUser.isAdmin && (
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
                </div>
            </Card>
            {isModalOpen && <DocumentFormModal document={editingDoc} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default ResourceCenter;