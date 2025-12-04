"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

export const BusinessNavigation = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { language, setLanguage } = useLanguage();

    const navLinks = [
        { href: "/business", label: "Home" },
        { href: "/business/about", label: "About Me" },
        { href: "/business/portfolio", label: "Portfolio" },
        { href: "/business/contact", label: "Contact" },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1b1f23] border-b border-[#38434f] shadow-sm">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/business" className="font-inter font-bold text-2xl tracking-tight text-white">
                        MINDRA <span className="text-slate-400 font-normal">BUSINESS</span>
                    </Link>

                    {/* Desktop Links */}
                    <div className="hidden lg:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-sm font-inter font-medium text-slate-300 hover:text-white transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}

                        {/* Language Switcher */}
                        <div className="flex items-center gap-2 font-inter text-xs font-bold tracking-widest">
                            <button
                                onClick={() => setLanguage("uk")}
                                className={`transition-colors ${language === "uk" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                UA
                            </button>
                            <span className="text-slate-600">/</span>
                            <button
                                onClick={() => setLanguage("en")}
                                className={`transition-colors ${language === "en" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                EN
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="lg:hidden p-2 text-slate-300"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden bg-[#1b1f23] border-t border-[#38434f] absolute w-full">
                    <div className="px-6 py-4 flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-base font-inter font-medium text-slate-300 py-2"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}

                        {/* Language Switcher Mobile */}
                        <div className="flex items-center gap-2 font-inter text-xs font-bold tracking-widest pt-2 border-t border-[#38434f]">
                            <button
                                onClick={() => setLanguage("uk")}
                                className={`transition-colors ${language === "uk" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                UA
                            </button>
                            <span className="text-slate-600">/</span>
                            <button
                                onClick={() => setLanguage("en")}
                                className={`transition-colors ${language === "en" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                EN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};
