"use client";

import { useLanguage } from "../context/LanguageContext";


export const LanguageSwitcher = () => {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-2 font-inter text-xs font-bold tracking-widest z-50">
            <button
                onClick={() => setLanguage("uk")}
                className={`transition-colors ${language === "uk" ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}
            >
                UA
            </button>
            <span className="text-zinc-700">/</span>
            <button
                onClick={() => setLanguage("en")}
                className={`transition-colors ${language === "en" ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}
            >
                EN
            </button>
        </div>
    );
};
