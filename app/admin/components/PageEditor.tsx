"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageState, PageBlock, EventType, TextStyle, BlockLayout } from '../types';
import BlockRenderer from './BlockRenderer';
import { Icons } from './Icons';
import { Plus } from 'lucide-react';

// Default Styles Helper
const createDefaultTextStyle = (): TextStyle => ({
    align: 'left',
    size: 'base',
    family: 'sans',
    bold: false,
    italic: false,
    color: '#333333'
});

const createNewBlock = (layout?: BlockLayout): PageBlock => ({
    id: crypto.randomUUID(),
    layout: layout || 'media-left',
    content: {
        text: '',
        textStyle: createDefaultTextStyle(),
        mediaUrl: null,
        mediaType: null
    }
});

interface PageEditorProps {
    initialData?: PageState & { id?: string, slug?: string };
    isEditing?: boolean;
}

export default function PageEditor({ initialData, isEditing = false }: PageEditorProps) {
    const [state, setState] = useState<PageState>(initialData || {
        title: 'My Awesome Event',
        eventType: 'business',
        blocks: [createNewBlock()]
    });

    const [addQuantity, setAddQuantity] = useState<number>(1);
    const router = useRouter();

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setState(prev => ({ ...prev, title: e.target.value }));
    };

    const handleTypeChange = (type: EventType) => {
        setState(prev => ({ ...prev, eventType: type }));
    };

    const updateBlock = (id: string, updates: Partial<PageBlock>) => {
        setState(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
        }));
    };

    const deleteBlock = (id: string) => {
        setState(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== id)
        }));
    };

    const moveBlock = (id: string, direction: 'up' | 'down') => {
        const index = state.blocks.findIndex(b => b.id === id);
        if (index === -1) return;

        const newBlocks = [...state.blocks];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex >= 0 && swapIndex < newBlocks.length) {
            [newBlocks[index], newBlocks[swapIndex]] = [newBlocks[swapIndex], newBlocks[index]];
            setState(prev => ({ ...prev, blocks: newBlocks }));
        }
    };

    const handleAddBlocks = () => {
        const newBlocks: PageBlock[] = [];
        const layouts: BlockLayout[] = ['media-left', 'media-right', 'media-only', 'text-only'];

        for (let i = 0; i < addQuantity; i++) {
            const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
            newBlocks.push(createNewBlock(randomLayout));
        }

        setState(prev => ({
            ...prev,
            blocks: [...prev.blocks, ...newBlocks]
        }));
    };

    // Theme Config based on Event Type
    const getTheme = () => {
        switch (state.eventType) {
            case 'wedding':
                return {
                    bg: 'bg-[#faf7f2]',
                    accent: 'text-rose-900',
                    button: 'bg-rose-900 hover:bg-rose-800',
                    border: 'border-rose-200',
                    font: 'font-serif',
                    card: 'bg-white/80 border-rose-100'
                };
            case 'party':
                return {
                    bg: 'bg-slate-900',
                    accent: 'text-purple-400',
                    button: 'bg-purple-600 hover:bg-purple-500',
                    border: 'border-purple-500/30',
                    font: 'font-mono',
                    card: 'bg-slate-800 border-slate-700'
                };
            case 'business':
            default:
                return {
                    bg: 'bg-gray-50',
                    accent: 'text-blue-900',
                    button: 'bg-blue-900 hover:bg-blue-800',
                    border: 'border-blue-200',
                    font: 'font-sans',
                    card: 'bg-white border-gray-200'
                };
        }
    };

    const theme = getTheme();



    const handleSave = async () => {
        try {
            const url = isEditing && initialData?.id
                ? `/api/admin/pages/${initialData.id}`
                : '/api/admin/pages';

            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state),
            });

            if (res.ok) {
                const data = await res.json();
                // Redirect to the new page or stay on edit?
                // For now, redirect to the public page
                router.push(`/${data.slug}`);
            } else {
                const errorData = await res.json();
                throw new Error(errorData.details || 'Failed to save');
            }
        } catch (error: unknown) {
            console.error(error);
            alert(`Error publishing page: ${(error as Error).message}`);
        }
    };

    return (
        <div className={`min-h-screen transition-colors duration-500 ${theme.bg} ${state.eventType === 'party' ? 'text-white' : 'text-gray-900'}`}>

            {/* Header / Nav */}
            <header className={`sticky top-0 z-50 backdrop-blur-md border-b ${state.eventType === 'party' ? 'border-gray-800 bg-slate-900/80' : 'border-gray-200 bg-white/80'} px-6 py-4 flex justify-between items-center`}>
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${state.eventType === 'party' ? 'bg-purple-500' : state.eventType === 'wedding' ? 'bg-rose-200' : 'bg-blue-100'}`}>
                        <Icons.Layout className={state.eventType === 'party' ? 'text-white' : 'text-gray-800'} size={20} />
                    </div>
                    <span className={`font-bold text-lg hidden sm:block ${theme.font}`}>
                        {isEditing ? 'Edit Page' : 'PageBuilder'}
                    </span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/admin/dashboard')}
                        className={`hidden sm:block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${state.eventType === 'party' ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-white border hover:bg-gray-50 text-gray-700'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={handleSave}
                        className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 ${theme.button}`}
                    >
                        {isEditing ? 'Update' : 'Publish'}
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-12 pb-32">

                {/* Title Section */}
                <div className="mb-12 text-center animate-fade-in">
                    <input
                        type="text"
                        value={state.title}
                        onChange={handleTitleChange}
                        className={`w-full text-center bg-transparent border-b-2 border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-all py-2 text-3xl md:text-5xl lg:text-6xl font-black placeholder-opacity-50 ${theme.accent} ${theme.font}`}
                        placeholder="Event Title"
                    />
                    <p className={`mt-4 text-sm opacity-60 ${state.eventType === 'party' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Start by customizing your title above
                    </p>
                </div>

                {/* Event Type Selector */}
                <div className="flex justify-center mb-16 animate-slide-up">
                    <div className={`inline-flex flex-row p-1.5 rounded-2xl ${state.eventType === 'party' ? 'bg-gray-800' : 'bg-white shadow-sm border border-gray-200'}`}>
                        {[
                            { id: 'business', icon: Icons.Business, label: 'Business' },
                            { id: 'wedding', icon: Icons.Wedding, label: 'Wedding' },
                            { id: 'party', icon: Icons.Party, label: 'Party' }
                        ].map((type) => (
                            <button
                                key={type.id}
                                onClick={() => handleTypeChange(type.id as EventType)}
                                className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-sm font-bold transition-all duration-300 ${state.eventType === type.id
                                    ? 'bg-white shadow-md text-gray-900 scale-105'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
                                    } ${state.eventType === type.id && state.eventType === 'party' ? '!bg-purple-600 !text-white' : ''}
                  ${state.eventType === type.id && state.eventType === 'wedding' ? '!bg-rose-100 !text-rose-900' : ''}
                  ${state.eventType === type.id && state.eventType === 'business' ? '!bg-blue-100 !text-blue-900' : ''}
                `}
                            >
                                <type.icon size={18} />
                                <span>{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dynamic Blocks */}
                <div className="space-y-8">
                    {state.blocks.map((block, index) => (
                        <div key={block.id} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                            <BlockRenderer
                                block={block}
                                onUpdate={updateBlock}
                                onDelete={deleteBlock}
                                onMoveUp={() => moveBlock(block.id, 'up')}
                                onMoveDown={() => moveBlock(block.id, 'down')}
                                isFirst={index === 0}
                                isLast={index === state.blocks.length - 1}
                            />
                        </div>
                    ))}
                </div>

                {/* Add Blocks Unified Control */}
                <div className="mt-12 flex justify-center pb-20">
                    <div className={`inline-flex items-stretch rounded-2xl shadow-xl overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1 ${theme.button}`}>

                        <button
                            type="button"
                            onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}
                            className="px-5 py-4 hover:bg-black/20 text-white/90 transition-colors border-r border-white/10 active:bg-black/30"
                            aria-label="Decrease quantity"
                        >
                            <Icons.Minus size={20} />
                        </button>

                        <button
                            type="button"
                            onClick={handleAddBlocks}
                            className="px-8 py-4 font-bold text-white flex items-center gap-3 hover:bg-white/5 transition-colors active:bg-black/10 min-w-[200px] justify-center"
                        >
                            <span className="text-lg">Add {addQuantity} {addQuantity > 1 ? 'Blocks' : 'Block'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setAddQuantity(Math.min(20, addQuantity + 1))}
                            className="px-5 py-4 hover:bg-black/20 text-white/90 transition-colors border-l border-white/10 active:bg-black/30"
                            aria-label="Increase quantity"
                        >
                            <Plus size={20} />
                        </button>

                    </div>
                </div>

                {/* Footer info */}
                <div className="mt-10 border-t border-gray-200/20 pt-8 text-center text-gray-400 text-sm">
                    <p>Mindra Admin Panel</p>
                </div>

            </main>
        </div>
    );
}
