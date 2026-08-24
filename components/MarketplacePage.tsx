import React, { useState, useMemo, useEffect } from 'react';
import Card from './Card';
import { SearchIcon, XCircleIcon, ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon } from './icons';
import type { MarketplaceItem } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const SellItemModal: React.FC<{ onClose: () => void; onAddItem: () => void; currentUser: any }> = ({ onClose, onAddItem, currentUser }) => {
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('Eletrônicos');
    const [condition, setCondition] = useState('Bom');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !price || !description || !currentUser) return;

        setUploading(true);
        try {
            let imageUrls: string[] = [];

            if (image) {
                const fileExt = image.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${currentUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('marketplace-media')
                    .upload(filePath, image);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('marketplace-media')
                    .getPublicUrl(filePath);

                if (data) imageUrls.push(data.publicUrl);
            }

            const { error } = await supabase
                .from('marketplace_items')
                .insert([{
                    title,
                    price: parseFloat(price),
                    category,
                    condition,
                    description,
                    company_id: currentUser.company_id,
                    listed_by: currentUser.id,
                    status: 'Disponível',
                    image_urls: imageUrls
                }]);

            if (error) throw error;

            onAddItem();
            onClose();
            alert('Item anunciado com sucesso!');
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Erro ao anunciar item. Tente novamente.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XCircleIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-brand-text mb-4">Anunciar Novo Item</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text">Título do Anúncio</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-text">Preço (R$)</label>
                            <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-text">Condição</label>
                            <select value={condition} onChange={e => setCondition(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm">
                                <option>Novo</option>
                                <option>Quase Novo</option>
                                <option>Bom</option>
                                <option>Usado</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-text">Categoria</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm">
                            <option>Eletrônicos</option>
                            <option>Móveis</option>
                            <option>Livros</option>
                            <option>Roupas</option>
                            <option>Outros</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-text">Descrição</label>
                        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm" required></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-text">Foto do Item</label>
                        <input type="file" accept="image/*" onChange={e => setImage(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-emerald-600" />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button type="button" onClick={onClose} className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
                        <button type="submit" disabled={uploading} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:opacity-50">
                            {uploading ? 'Publicando...' : 'Publicar Anúncio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const ItemDetailModal: React.FC<{
    item: MarketplaceItem;
    onClose: () => void;
    onReserve: (itemId: number | string) => void;
    currentUserId: string;
}> = ({ item, onClose, onReserve, currentUserId }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const nextImage = () => setCurrentImageIndex(prev => (prev + 1) % item.imageUrls.length);
    const prevImage = () => setCurrentImageIndex(prev => (prev - 1 + item.imageUrls.length) % item.imageUrls.length);

    const getStatusChip = (status: MarketplaceItem['status']) => {
        switch (status) {
            case 'Disponível': return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Disponível</span>;
            case 'Reservado': return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Reservado</span>;
            case 'Vendido': return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Vendido</span>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="w-full md:w-1/2 relative bg-gray-100 flex items-center justify-center">
                    {item.imageUrls.length > 0 ? (
                        <img src={item.imageUrls[currentImageIndex]} alt={item.title} className="w-full h-64 md:h-full object-cover rounded-t-lg md:rounded-l-lg md:rounded-t-none" />
                    ) : (
                        <div className="text-gray-400">Sem imagem</div>
                    )}

                    {item.imageUrls.length > 1 && (
                        <>
                            <button onClick={prevImage} className="absolute top-1/2 left-2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60"><ChevronLeftIcon className="w-6 h-6" /></button>
                            <button onClick={nextImage} className="absolute top-1/2 right-2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60"><ChevronRightIcon className="w-6 h-6" /></button>
                        </>
                    )}
                </div>
                <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hidden md:block"><XCircleIcon className="w-6 h-6" /></button>
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-2xl font-bold text-brand-text">{item.title}</h2>
                        <button onClick={onClose} className="p-2 -mr-2 text-gray-500 md:hidden"><XCircleIcon className="w-6 h-6" /></button>
                    </div>
                    <div className="flex items-center space-x-2 mb-4">
                        {getStatusChip(item.status)}
                        <span className="text-sm text-brand-subtle-text">· {item.category}</span>
                        <span className="text-sm text-brand-subtle-text">· {item.condition}</span>
                    </div>
                    <p className="text-3xl font-bold text-brand-primary mb-4">R$ {item.price.toFixed(2)}</p>
                    <div className="text-brand-subtle-text space-y-2 text-sm mb-6 flex-grow">
                        <p className="whitespace-pre-wrap">{item.description}</p>
                        <p className="text-xs text-gray-400 mt-4">Anunciado por: {item.seller} em {item.listedAt}</p>
                    </div>
                    <div className="mt-auto pt-4 border-t">
                        {item.status === 'Disponível' ? (
                            <button onClick={() => onReserve(item.id)} className="w-full py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors">Tenho Interesse!</button>
                        ) : (
                            <button className="w-full py-3 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed" disabled>
                                {item.status === 'Reservado' ? `Reservado por ${item.reservedBy || 'alguém'}` : 'Item Indisponível'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MarketplacePage: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const [items, setItems] = useState<MarketplaceItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
    const [isSellModalOpen, setSellModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        if (!currentUser?.company_id) {
            console.warn('Marketplace: currentUser.company_id is missing', currentUser);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('marketplace_items')
                .select(`
                    *,
                    reserver:reserved_by(full_name),
                    seller:listed_by(full_name)
                `)
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedItems: MarketplaceItem[] = data.map((item: any) => ({
                    id: item.id, // Keep as string (UUID)
                    title: item.title,
                    price: item.price,
                    imageUrls: item.image_urls || [], // Default to empty array if null
                    category: item.category,
                    condition: item.condition,
                    description: item.description,
                    status: item.status,
                    reservedBy: item.reserver?.full_name,
                    seller: item.profiles?.full_name || 'Usuário Excluído',
                    listedBy: item.listed_by,
                    listedAt: new Date(item.created_at).toLocaleDateString('pt-BR')
                }));
                setItems(formattedItems);
            }
        } catch (error) {
            console.error('Error fetching marketplace items:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [currentUser?.company_id]);

    const categories = ['Todos', ...new Set(items.map(item => item.category))];

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [items, searchTerm, selectedCategory]);

    const handleReserveItem = async (itemId: number | string) => {
        if (!currentUser) return;
        try {
            const { error } = await supabase
                .from('marketplace_items')
                .update({
                    status: 'Reservado',
                    reserved_by: currentUser.id
                })
                .eq('id', itemId);

            if (error) throw error;

            // Optimistic update
            setItems(items.map(item =>
                item.id === itemId
                    ? { ...item, status: 'Reservado', reservedBy: currentUser.name }
                    : item
            ));
            setSelectedItem(null);
            alert('Item reservado com sucesso! Entre em contato com o vendedor para combinar o pagamento e a retirada.');
        } catch (error) {
            console.error('Error reserving item:', error);
            alert('Erro ao reservar item.');
        }
    };

    const getStatusBorder = (status: MarketplaceItem['status']) => {
        if (status === 'Vendido') return 'border-gray-300';
        if (status === 'Reservado') return 'border-yellow-400';
        return 'border-transparent';
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando marketplace...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
                <div>
                    <h1 className="text-3xl font-bold text-brand-text">Marketplace da Empresa</h1>
                    <p className="text-brand-subtle-text mt-1">Encontre equipamentos usados com um ótimo custo-benefício!</p>
                </div>
                {currentUser?.permissions?.manageMarketplace && (
                    <button
                        onClick={() => setSellModalOpen(true)}
                        className="mt-4 md:mt-0 flex items-center space-x-2 px-6 py-2 bg-brand-primary text-white rounded-full hover:bg-emerald-600 transition-colors shadow-lg"
                    >
                        <PlusCircleIcon className="w-5 h-5" />
                        <span>Anunciar um Item</span>
                    </button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Buscar por item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-full bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full md:w-48 px-4 py-2 border rounded-full bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary">
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => (
                    <div key={item.id} onClick={() => setSelectedItem(item)} className={`rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer bg-white flex flex-col overflow-hidden border-2 ${getStatusBorder(item.status)}`}>
                        <div className="relative">
                            {item.imageUrls.length > 0 ? (
                                <img src={item.imageUrls[0]} alt={item.title} className="h-48 w-full object-cover" />
                            ) : (
                                <div className="h-48 w-full bg-gray-200 flex items-center justify-center text-gray-400">Sem Imagem</div>
                            )}

                            {item.status !== 'Disponível' && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="text-white font-bold text-lg px-4 py-2 bg-black/60 rounded-md">{item.status}</span>
                                </div>
                            )}
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                            <h3 className="font-bold text-brand-text truncate">{item.title}</h3>
                            <p className="text-sm text-brand-subtle-text">{item.condition}</p>
                            <p className="mt-2 text-xl font-bold text-brand-primary flex-grow">R$ {item.price.toFixed(2)}</p>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }} className="mt-4 w-full text-center px-4 py-2 text-sm font-medium text-brand-primary bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors">
                                Ver Detalhes
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {filteredItems.length === 0 && <p className="text-center text-gray-500 py-12">Nenhum item encontrado. Tente ajustar sua busca.</p>}

            {selectedItem && currentUser && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onReserve={handleReserveItem} currentUserId={currentUser.id} />}

            {isSellModalOpen && <SellItemModal onClose={() => setSellModalOpen(false)} onAddItem={fetchItems} currentUser={currentUser} />}
        </div>
    );
};

export default MarketplacePage;