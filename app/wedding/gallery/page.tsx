"use client";

import { motion } from "framer-motion";
import { WeddingNavigation } from "../components/WeddingNavigation";
import { WeddingFooter } from "../components/WeddingFooter";
import { useState } from "react";

interface GalleryItem {
    id: number;
    title: string;
    caption: string;
    color: string;
    aspectRatio: string;
}

const galleryItems: GalleryItem[] = [
    { id: 1, title: "Sarah & David, June 2023", caption: "A day full of love", color: "#E8D5B7", aspectRatio: "aspect-[4/3]" },
    { id: 2, title: "The Rings", caption: "Symbol of forever", color: "#D4C5A9", aspectRatio: "aspect-[3/4]" },
    { id: 3, title: "A Moment of Joy", caption: "Pure happiness", color: "#C9B896", aspectRatio: "aspect-[4/3]" },
    { id: 4, title: "Outdoor Vows", caption: "Under the open sky", color: "#BFA97E", aspectRatio: "aspect-[4/3]" },
    { id: 5, title: "Sarah & David, June 2023", caption: "Golden hour portrait", color: "#D9C9A8", aspectRatio: "aspect-[3/4]" },
    { id: 6, title: "Table Details", caption: "Elegance in every detail", color: "#E0D2B8", aspectRatio: "aspect-[4/3]" },
    { id: 7, title: "Tierter Cake", caption: "Sweet perfection", color: "#CCBB99", aspectRatio: "aspect-[3/4]" },
    { id: 8, title: "The First Look", caption: "Breathtaking moment", color: "#D6C4A0", aspectRatio: "aspect-[4/3]" },
    { id: 9, title: "Dancing the Night Away", caption: "Celebration of love", color: "#C4B28E", aspectRatio: "aspect-[4/3]" },
    { id: 10, title: "Bridal Prep", caption: "Getting ready", color: "#DDD0B8", aspectRatio: "aspect-[3/4]" },
];

export default function WeddingGallery() {
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    return (
        <main className="min-h-screen bg-[#FDFBF7] font-lato selection:bg-[#D4AF37]/30 selection:text-[#333333]">
            {/* Navigation — solid variant for inner pages */}
            <WeddingNavigation variant="solid" />

            {/* Header */}
            <section className="pt-32 pb-12 lg:pt-40 lg:pb-16 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                >
                    <h1 className="font-playfair italic text-[#333333] text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.1] mb-6">
                        Love Stories
                    </h1>
                    <p className="font-lato text-[#666666] text-base md:text-lg tracking-wide max-w-xl mx-auto">
                        Real weddings, emotional moments, bespoke details.
                    </p>
                </motion.div>
            </section>

            {/* Gallery Grid — 5 columns masonry-style */}
            <section className="pb-20 lg:pb-28 px-4 md:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="columns-2 md:columns-3 lg:columns-5 gap-4 lg:gap-5">
                        {galleryItems.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.6,
                                    delay: index * 0.08,
                                    ease: "easeOut",
                                }}
                                onMouseEnter={() => setHoveredId(item.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                className="break-inside-avoid mb-4 lg:mb-5 cursor-pointer group"
                            >
                                <motion.div
                                    animate={{
                                        rotate: hoveredId === item.id ? 2 : 0,
                                        y: hoveredId === item.id ? -4 : 0,
                                    }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="bg-white p-2.5 pb-4 rounded-sm transition-shadow duration-300"
                                    style={{
                                        boxShadow: hoveredId === item.id
                                            ? "0 12px 30px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)"
                                            : "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
                                    }}
                                >
                                    {/* Image Placeholder — warm color */}
                                    <div
                                        className={`w-full ${item.aspectRatio} rounded-sm overflow-hidden relative`}
                                        style={{ backgroundColor: item.color }}
                                    >
                                        {/* Subtle texture overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5" />
                                        {/* Centered icon hint */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1">
                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <path d="M21 15l-5-5L5 21" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Caption */}
                                    <div className="mt-3 px-1">
                                        <p className="font-playfair text-[#333333] text-sm leading-snug">
                                            {item.title}
                                        </p>
                                    </div>
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <WeddingFooter />
        </main>
    );
}
