"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Edit, ExternalLink, Filter, Calendar, Layout } from "lucide-react";
import { Icons } from "../components/Icons";

// Types
interface DashboardPage {
    id: string;
    title: string;
    slug: string;
    createdAt: string;
    igSyncedAt: string | null;
    eventType: 'business' | 'wedding' | 'party' | 'uncategorized';
    isPublished: boolean;
    blocks: { mediaUrl: string | null, text: string | null }[];
}

const VideoPreview = ({ src }: { src: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.6 } // Play when 60% visible on screen
        );

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!videoRef.current) return;

        // Play if hovered, OR if it's visible AND it's a touch device (no hover capability)
        const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
        
        if (isHovered || (isVisible && isTouchDevice)) {
            videoRef.current.play().catch(() => {
                // Ignore autoplay restrictions errors silently
            });
        } else {
            videoRef.current.pause();
        }
    }, [isHovered, isVisible]);

    return (
        <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            muted
            loop
            playsInline
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        />
    );
};

export default function DashboardPage() {
    const [pages, setPages] = useState<DashboardPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'business' | 'wedding' | 'party' | 'drafts'>('all');
    const router = useRouter();

    useEffect(() => {
        // Fetch pages on mount
        const fetchPages = async () => {
            try {
                const res = await fetch('/api/admin/pages/list'); // Need to create this endpoint or use server action
                if (res.ok) {
                    const data = await res.json();
                    setPages(data);
                }
            } catch (error) {
                console.error("Failed to fetch pages", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPages();
    }, []);

    const filteredPages = filter === 'all'
        ? pages
        : filter === 'drafts'
        ? pages.filter(p => !p.isPublished || p.eventType === 'uncategorized')
        : pages.filter(p => p.eventType === filter);

    const getTheme = (type: string) => {
        switch (type) {
            case 'wedding': return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: Icons.Wedding };
            case 'party': return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', icon: Icons.Party };
            case 'business': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', icon: Icons.Business };
            case 'uncategorized':
            default: return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100', icon: Icons.Draft };
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 lg:p-12">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Layout className="text-gray-400" />
                            Dashboard
                        </h1>
                        <p className="text-gray-500 mt-1 ml-11">Manage your event pages</p>
                    </div>
                    <Link
                        href="/admin"
                        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-gray-900/10 hover:-translate-y-0.5 w-full md:w-auto justify-center"
                    >
                        <Plus size={20} />
                        Create New Page
                    </Link>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {[
                        { id: 'all', label: 'All Events', icon: Filter },
                        { id: 'business', label: 'Business', icon: Icons.Business },
                        { id: 'wedding', label: 'Wedding', icon: Icons.Wedding },
                        { id: 'party', label: 'Party', icon: Icons.Party },
                        { id: 'drafts', label: 'Drafts', icon: Icons.Draft },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setFilter(item.id as 'all' | 'business' | 'wedding' | 'party' | 'drafts')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                ${filter === item.id
                                    ? 'bg-white border-gray-300 text-gray-900 shadow-sm'
                                    : 'bg-transparent border-transparent text-gray-500 hover:bg-white hover:text-gray-700'
                                }`}
                        >
                            <item.icon size={16} />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredPages.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="text-gray-400" size={24} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No pages found</h3>
                        <p className="text-gray-500 mt-1">Try changing filters or create a new page</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPages.map((page) => {
                            const theme = getTheme(page.eventType);
                            const previewImage = page.blocks.find(b => b.mediaUrl)?.mediaUrl;
                            const previewText = page.blocks.find(b => b.text)?.text?.substring(0, 80);

                            const handleQuickPublish = async (type: string) => {
                                try {
                                    const res = await fetch(`/api/admin/pages/${page.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ eventType: type, isPublished: true })
                                    });
                                    if (res.ok) {
                                        setPages(prev => prev.map(p => p.id === page.id ? { ...p, eventType: type as any, isPublished: true } : p));
                                    } else {
                                        throw new Error("Failed to update page");
                                    }
                                } catch (error) {
                                    console.error(error);
                                    alert("Error applying quick action");
                                }
                            };

                            return (
                                <div
                                    key={page.id}
                                    onClick={() => router.push(`/admin/${page.id}`)}
                                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
                                >
                                    {/* Image Preview */}
                                    {previewImage ? (
                                        <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                                            {previewImage.toLowerCase().endsWith('.mp4') ? (
                                                <VideoPreview src={previewImage} />
                                            ) : (
                                                <img
                                                    src={previewImage}
                                                    alt={page.title}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60 pointer-events-none" />
                                            <div className="absolute bottom-3 left-3 pointer-events-none">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm shadow-sm ${theme.text}`}>
                                                    <theme.icon size={12} />
                                                    {page.eventType}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Fallback Header if no image */
                                        <div className={`p-6 pb-4 border-b ${theme.border} ${theme.bg} bg-opacity-50`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white shadow-sm ${theme.text}`}>
                                                    <theme.icon size={12} />
                                                    {page.eventType}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Card Body */}
                                    <div className="p-6 pt-4 flex-grow flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                                                {page.title}
                                            </h3>
                                            <div className="flex justify-between items-center text-xs text-gray-500 mb-4 mt-1 border-b border-gray-50 pb-2">
                                                <span>Imported: {page.igSyncedAt ? new Date(page.igSyncedAt).toLocaleDateString() : '—'}</span>
                                                <span>Created: {new Date(page.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            {previewText && (
                                                <p className="text-sm text-gray-500 mb-4 line-clamp-3 italic">
                                                    "{previewText}{previewText.length === 80 ? '...' : ''}"
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {page.eventType === 'uncategorized' || filter === 'drafts' ? (
                                                <div className="grid grid-cols-3 gap-1 w-full mr-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleQuickPublish('wedding'); }} className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded p-1 transition-colors transition-colors" title="Publish as Wedding">Свадьба</button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleQuickPublish('business'); }} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded p-1 transition-colors" title="Publish as Business">Деловой</button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleQuickPublish('party'); }} className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded p-1 transition-colors" title="Publish as Party">Вечеринка</button>
                                                </div>
                                            ) : (
                                                <Link
                                                    href={`/${page.slug}`}
                                                    target="_blank"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-blue-500 rounded-xl transition-colors"
                                                    title="View Live"
                                                >
                                                    <ExternalLink size={20} />
                                                </Link>
                                            )}
                                            <Link
                                                href={`/admin/${page.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium transition-colors group-hover:bg-gray-900 group-hover:text-white"
                                            >
                                                <Edit size={16} />
                                                Edit
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
