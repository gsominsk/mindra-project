"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BusinessNavigation } from "../components/BusinessNavigation";
import { Send } from "lucide-react";

export default function BusinessContact() {
    const [formData, setFormData] = useState({
        name: "",
        date: "",
        eventType: "",
        message: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus("idle");

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: formData.name,
                    contact: formData.date, // Using date as contact info to match main contact form logic
                    eventType: formData.eventType,
                    date: formData.date,
                    message: formData.message,
                }),
            });

            if (response.ok) {
                setSubmitStatus("success");
                setFormData({ name: "", date: "", eventType: "", message: "" });
            } else {
                setSubmitStatus("error");
            }
        } catch (error) {
            setSubmitStatus("error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-black font-inter selection:bg-[#70b5f9] selection:text-black">
            {/* Navigation */}
            <div className="relative z-50">
                <BusinessNavigation />
            </div>

            {/* Content */}
            <div className="pt-24 pb-12 px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-8 text-center"
                    >
                        <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 tracking-tight">
                            Зв'язатися з нами
                        </h1>
                    </motion.div>

                    {/* Two Column Layout */}
                    <div className="grid lg:grid-cols-[1fr_0.8fr] gap-6 items-start">
                        {/* Left Column - Form */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="bg-[#1b1f23] rounded-xl p-6 shadow-sm border border-[#38434f]"
                        >
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Name Field */}
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
                                        Ім'я
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-black border border-[#38434f] rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#70b5f9] focus:ring-1 focus:ring-[#70b5f9] transition-colors"
                                        placeholder="Ваше ім'я"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Date Field */}
                                    <div>
                                        <label htmlFor="date" className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Дата
                                        </label>
                                        <input
                                            type="text"
                                            id="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleChange}
                                            className="w-full px-3.5 py-2.5 bg-black border border-[#38434f] rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#70b5f9] focus:ring-1 focus:ring-[#70b5f9] transition-colors"
                                            placeholder="Дата події"
                                        />
                                    </div>

                                    {/* Event Type Field */}
                                    <div>
                                        <label htmlFor="eventType" className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Тип події
                                        </label>
                                        <div className="relative">
                                            <select
                                                id="eventType"
                                                name="eventType"
                                                value={formData.eventType}
                                                onChange={handleChange}
                                                className="w-full px-3.5 py-2.5 bg-black border border-[#38434f] rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#70b5f9] focus:ring-1 focus:ring-[#70b5f9] transition-colors appearance-none"
                                            >
                                                <option value="" disabled>Оберіть тип</option>
                                                <option value="Party">Вечірка</option>
                                                <option value="Business">Бізнес</option>
                                                <option value="Wedding">Весілля</option>
                                                <option value="Other">Інше</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Message Field */}
                                <div>
                                    <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1.5">
                                        Повідомлення
                                    </label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        rows={4}
                                        className="w-full px-3.5 py-2.5 bg-black border border-[#38434f] rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#70b5f9] focus:ring-1 focus:ring-[#70b5f9] transition-colors resize-none"
                                        placeholder="Розкажіть про вашу подію..."
                                    />
                                </div>

                                {/* Submit Button */}
                                <div className="flex justify-center">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-2/3 px-8 py-3 bg-[#0a66c2] text-white font-semibold rounded-full hover:bg-[#004182] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group shadow-sm"
                                    >
                                        {isSubmitting ? (
                                            "Відправка..."
                                        ) : (
                                            <>
                                                Відправити
                                                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Status Messages */}
                                {submitStatus === "success" && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 bg-green-900/20 border border-green-800 rounded-md text-green-400 text-center text-sm"
                                    >
                                        Дякуємо! Ваше повідомлення успішно відправлено.
                                    </motion.div>
                                )}

                                {submitStatus === "error" && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 bg-red-900/20 border border-red-800 rounded-md text-red-400 text-center text-sm"
                                    >
                                        Щось пішло не так. Спробуйте ще раз.
                                    </motion.div>
                                )}
                            </form>
                        </motion.div>

                        {/* Right Column - Why Hire */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="bg-[#1b1f23] rounded-xl p-6 shadow-sm border border-[#38434f] lg:self-center"
                        >
                            <div>
                                <h2 className="text-xl font-bold text-white mb-4">
                                    Чому обрати нас?
                                </h2>
                                <div className="space-y-3">
                                    {/* Benefit 1 */}
                                    <div className="flex gap-3 items-start">
                                        <div className="flex-shrink-0 w-6 h-6 bg-[#0A66C2] rounded-full flex items-center justify-center mt-0.5">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white mb-0.5">
                                                Професійний підхід
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                Досвід організації понад 100+ успішних подій різного масштабу
                                            </p>
                                        </div>
                                    </div>

                                    {/* Benefit 2 */}
                                    <div className="flex gap-3 items-start">
                                        <div className="flex-shrink-0 w-6 h-6 bg-[#0A66C2] rounded-full flex items-center justify-center mt-0.5">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white mb-0.5">
                                                Повний цикл послуг
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                Від концепції до реалізації - ми беремо на себе всі організаційні питання
                                            </p>
                                        </div>
                                    </div>

                                    {/* Benefit 3 */}
                                    <div className="flex gap-3 items-start">
                                        <div className="flex-shrink-0 w-6 h-6 bg-[#0A66C2] rounded-full flex items-center justify-center mt-0.5">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white mb-0.5">
                                                Індивідуальний підхід
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                Кожна подія унікальна - ми створюємо рішення під ваші потреби
                                            </p>
                                        </div>
                                    </div>

                                    {/* Benefit 4 */}
                                    <div className="flex gap-3 items-start">
                                        <div className="flex-shrink-0 w-6 h-6 bg-[#0A66C2] rounded-full flex items-center justify-center mt-0.5">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white mb-0.5">
                                                Технічна підтримка
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                Сучасне обладнання та технології для вашої події
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </main>
    );
}
