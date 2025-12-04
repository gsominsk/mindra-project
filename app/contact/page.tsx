"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Instagram, Send } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

const GrainOverlay = () => (
    <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.07] mix-blend-overlay">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <filter id="noiseFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
    </div>
);

export default function ContactPage() {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: '',
        date: '',
        eventType: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    contact: formData.date, // Using date as contact info
                    eventType: formData.eventType,
                    date: formData.date,
                    message: formData.message,
                }),
            });

            if (response.ok) {
                setSubmitStatus('success');
                setFormData({ name: '', date: '', eventType: '', message: '' });
            } else {
                setSubmitStatus('error');
            }
        } catch {
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen w-full bg-[#050505] text-white selection:bg-white selection:text-black flex flex-col relative overflow-hidden">
            <GrainOverlay />

            {/* Navigation */}
            <nav className="w-full px-6 py-6 lg:px-8 lg:py-8 flex justify-between items-center z-10">
                <Link href="/" className="flex items-center gap-2 text-xs font-inter font-bold tracking-widest hover:opacity-60 transition-opacity text-zinc-400">
                    <ArrowLeft className="w-4 h-4" />
                    {t.contact.back}
                </Link>

                <div className="flex items-center gap-4 lg:gap-8">
                    <LanguageSwitcher />
                    <span className="font-syne font-bold text-sm tracking-widest uppercase">Mindra</span>
                </div>
            </nav>

            <div className="flex-1 w-full max-w-[1920px] mx-auto px-6 py-8 lg:px-24 lg:py-24 z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 h-full">

                    {/* Left Section */}
                    <div className="lg:col-span-5 flex flex-col justify-between h-full">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h1 className="font-roboto font-extrabold text-[12vw] md:text-[8vw] lg:text-[5vw] leading-[1.1] tracking-tighter mb-8 lg:mb-12 text-center lg:text-left">
                                {t.contact.title.map((line, i) => (
                                    <span key={i} className="block">{line}</span>
                                ))}
                            </h1>

                            <div className="space-y-6 lg:space-y-8 font-inter text-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">{t.contact.emailLabel}</span>
                                        <a href="mailto:hello@mindra.com" className="text-2xl lg:text-3xl font-syne hover:text-zinc-300 transition-colors">hello@mindra.com</a>
                                    </div>

                                    <div className="flex gap-3 lg:gap-4">
                                        <Link
                                            href="https://ig.me/m/grubngodeliveryigormindra"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-14 h-14 lg:w-16 lg:h-16 border border-white/20 flex items-center justify-center hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            <Instagram className="w-5 h-5 lg:w-6 lg:h-6" />
                                        </Link>
                                        <Link
                                            href="https://t.me/igormindra"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-14 h-14 lg:w-16 lg:h-16 border border-white/20 flex items-center justify-center hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            <Send className="w-5 h-5 lg:w-6 lg:h-6" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Section: Form */}
                    <div className="lg:col-start-7 lg:col-span-6 flex flex-col justify-center">
                        <motion.form
                            onSubmit={handleSubmit}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                            className="w-full space-y-6 lg:space-y-8"
                        >
                            <div className="group relative">
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    disabled={isSubmitting}
                                    className="w-full bg-transparent border-b border-zinc-800 py-2 lg:py-3 text-lg lg:text-xl font-syne font-bold focus:outline-none focus:border-white transition-colors placeholder-zinc-700 disabled:opacity-50"
                                    placeholder={t.contact.form.namePlaceholder}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                <div className="group relative">
                                    <input
                                        type="text"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent border-b border-zinc-800 py-2 lg:py-3 text-lg lg:text-xl font-syne font-bold focus:outline-none focus:border-white transition-colors placeholder-zinc-700 disabled:opacity-50"
                                        placeholder={t.contact.form.datePlaceholder}
                                    />
                                </div>
                                <div className="group relative">
                                    <select
                                        value={formData.eventType}
                                        onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent border-b border-zinc-800 py-2 lg:py-3 text-lg lg:text-xl font-syne font-bold focus:outline-none focus:border-white transition-colors appearance-none rounded-none text-zinc-400 focus:text-white disabled:opacity-50"
                                    >
                                        <option>{t.contact.form.types.default}</option>
                                        <option>{t.contact.form.types.party}</option>
                                        <option>{t.contact.form.types.business}</option>
                                        <option>{t.contact.form.types.wedding}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="group relative">
                                <textarea
                                    rows={3}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    disabled={isSubmitting}
                                    className="w-full bg-transparent border-b border-zinc-800 py-2 lg:py-3 text-lg lg:text-xl font-syne font-medium focus:outline-none focus:border-white transition-colors resize-none placeholder-zinc-700 disabled:opacity-50"
                                    placeholder={t.contact.form.detailsPlaceholder}
                                />
                            </div>

                            {submitStatus === 'success' && (
                                <div className="text-green-400 text-sm font-roboto">Message sent successfully!</div>
                            )}
                            {submitStatus === 'error' && (
                                <div className="text-red-400 text-sm font-roboto">Failed to send message. Please try again.</div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-white text-black py-4 lg:py-5 text-lg lg:text-xl font-syne font-bold tracking-widest hover:bg-zinc-200 transition-colors mt-4 lg:mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'SENDING...' : t.contact.form.sendButton}
                            </button>
                        </motion.form>
                    </div>

                </div>
            </div>
        </main>
    );
}
