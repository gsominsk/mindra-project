"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WeddingNavigationProps {
    variant?: "transparent" | "solid";
}

export const WeddingNavigation = ({ variant = "transparent" }: WeddingNavigationProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        if (variant !== "transparent") return;

        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [variant]);

    const showSolid = variant === "solid" || isScrolled;

    const navLinksLeft = [
        { href: "/wedding/gallery", label: "Love Stories" },
        { href: "/wedding#about", label: "About" },
    ];

    const navLinksRight = [
        { href: "/wedding#services", label: "Services" },
        { href: "/wedding/contact", label: "Contact" },
    ];

    const allLinks = [
        { href: "/wedding", label: "Home" },
        ...navLinksLeft,
        ...navLinksRight,
    ];

    return (
        <>
            <motion.nav
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${showSolid
                    ? "bg-[#FDFBF7] shadow-sm border-b border-[#D4AF37]/20"
                    : "bg-transparent"
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex items-center justify-center h-20 relative">

                        {/* Desktop Left Links */}
                        <div className="hidden lg:flex items-center gap-10 absolute left-0">
                            {navLinksLeft.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className={`text-sm font-lato font-normal tracking-[0.15em] transition-colors relative group ${showSolid
                                        ? "text-[#333333] hover:text-[#D4AF37]"
                                        : "text-white/90 hover:text-white"
                                        }`}
                                >
                                    {link.label}
                                    <span className={`absolute -bottom-1 left-0 w-0 h-[1px] transition-all duration-300 group-hover:w-full ${showSolid ? "bg-[#D4AF37]" : "bg-white"
                                        }`} />
                                </Link>
                            ))}
                        </div>

                        {/* Center Logo */}
                        <Link
                            href="/wedding"
                            className={`font-playfair italic text-2xl lg:text-3xl tracking-wide transition-colors ${showSolid ? "text-[#333333]" : "text-white"
                                }`}
                        >
                            Mindra Weddings
                        </Link>

                        {/* Desktop Right Links */}
                        <div className="hidden lg:flex items-center gap-10 absolute right-0">
                            {navLinksRight.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className={`text-sm font-lato font-normal tracking-[0.15em] transition-colors relative group ${showSolid
                                        ? "text-[#333333] hover:text-[#D4AF37]"
                                        : "text-white/90 hover:text-white"
                                        }`}
                                >
                                    {link.label}
                                    <span className={`absolute -bottom-1 left-0 w-0 h-[1px] transition-all duration-300 group-hover:w-full ${showSolid ? "bg-[#D4AF37]" : "bg-white"
                                        }`} />
                                </Link>
                            ))}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className={`lg:hidden absolute right-0 p-2 transition-colors ${showSolid ? "text-[#333333]" : "text-white"
                                }`}
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="lg:hidden bg-[#FDFBF7] border-t border-[#D4AF37]/20 overflow-hidden"
                        >
                            <div className="px-6 py-6 flex flex-col gap-1">
                                {allLinks.map((link, index) => (
                                    <motion.div
                                        key={link.label}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Link
                                            href={link.href}
                                            className="block text-base font-lato text-[#333333] py-3 px-4 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] rounded-lg transition-colors tracking-wider"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.nav>
        </>
    );
};
