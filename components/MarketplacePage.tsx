import React, { useState, useMemo } from 'react';
import Card from './Card';
import { SearchIcon, XCircleIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
// FIX: Correcting the import path for types.
import type { MarketplaceItem, Employee } from '../types';

interface MarketplacePageProps {
    items: MarketplaceItem[];
    setItems: (items: MarketplaceItem[]) => void;
    currentUser: Employee;
}


const ItemDetailModal: React.FC<{ 
    item: MarketplaceItem; 
    onClose: () => void; 
    onReserve: (itemId: number) => void;
    currentUser: Employee;
}> = ({ item, onClose, onReserve, currentUser }) => {
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
                <div className="w-full md:w-1/2 relative">
                    <img src={item.imageUrls[currentImageIndex]} alt={item.title} className="w-full h-64 md:h-full object-cover rounded-t-lg md:rounded-l-lg md:rounded-t-none" />
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
                    </div>
                    <div className="mt-auto pt-4 border-t">
                        {item.status === 'Disponível' ? (
                             <button onClick={() => onReserve(item.id)} className="w-full py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors">Tenho Interesse!</button>
                        ) : (
                             <button className="w-full py-3 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed" disabled>
                                {item.status === 'Reservado' ? `Reservado por ${item.reservedBy}` : 'Item Indisponível'}
                             </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const MarketplacePage: React.FC<MarketplacePageProps> = ({ items, setItems, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);

    const categories = ['Todos', ...new Set(items.map(item => item.category))];

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [items, searchTerm, selectedCategory]);

    const handleReserveItem = (itemId: number) => {
        setItems(items.map(item =>
            item.id === itemId
                ? { ...item, status: 'Reservado', reservedBy: currentUser.name }
                : item
        ));
        setSelectedItem(null);
    };

    const getStatusBorder = (status: MarketplaceItem['status']) => {
        if (status === 'Vendido') return 'border-gray-300';
        if (status === 'Reservado') return 'border-yellow-400';
        return 'border-transparent';
    };

    return (
        <div className="space-y-6">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold text-brand-text">Marketplace da Empresa</h1>
                <p className="text-brand-subtle-text mt-1">Encontre equipamentos usados com um ótimo custo-benefício!</p>
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
                            <img src={item.imageUrls[0]} alt={item.title} className="h-48 w-full object-cover" />
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

            {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onReserve={handleReserveItem} currentUser={currentUser} />}
        </div>
    );
};

export default MarketplacePage;