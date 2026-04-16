"use client";

import { motion } from "framer-motion";
import { WeddingNavigation } from "../components/WeddingNavigation";
import { useState } from "react";

export default function WeddingContact() {
    const [formData, setFormData] = useState({
        name: "",
        date: "",
        story: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
    const [isHovered, setIsHovered] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus("idle");

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    contact: formData.date,
                    eventType: "Wedding",
                    message: formData.story,
                }),
            });

            if (response.ok) {
                setSubmitStatus("success");
                setFormData({ name: "", date: "", story: "" });
            } else {
                setSubmitStatus("error");
            }
        } catch {
            setSubmitStatus("error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#F5F0E8] font-lato selection:bg-[#D4AF37]/30 selection:text-[#333333]">
            {/* Navigation */}
            <WeddingNavigation variant="solid" />

            {/* Content */}
            <section className="min-h-screen flex items-center justify-center px-4 py-32">
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                >
                    {/* Card Container */}
                    <div className="bg-[#FDFBF7] relative w-full max-w-[420px] mx-auto shadow-[0_8px_40px_rgba(0,0,0,0.08)]">

                        {/* Outer gold border */}
                        <div className="absolute inset-3 border border-[#D4AF37]/40 pointer-events-none" />

                        {/* Inner gold border */}
                        <div className="absolute inset-5 border border-[#D4AF37]/25 pointer-events-none" />

                        {/* Dried flower stem — SVG decoration */}
                        <div className="absolute left-6 top-[38%] bottom-[20%] pointer-events-none opacity-40">
                            <svg
                                viewBox="0 0 60 300"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-full w-auto"
                                preserveAspectRatio="xMidYMid meet"
                            >
                                {/* Main stem */}
                                <path
                                    d="M30 280 C28 240, 35 200, 30 160 C25 120, 32 80, 28 40"
                                    stroke="#B8962F"
                                    strokeWidth="0.8"
                                    fill="none"
                                />
                                {/* Branch left */}
                                <path d="M30 220 C20 210, 12 195, 8 175" stroke="#B8962F" strokeWidth="0.6" fill="none" />
                                <path d="M30 180 C22 170, 16 155, 15 140" stroke="#B8962F" strokeWidth="0.6" fill="none" />
                                <path d="M30 140 C24 128, 20 115, 22 100" stroke="#B8962F" strokeWidth="0.6" fill="none" />
                                {/* Branch right */}
                                <path d="M30 200 C38 190, 44 175, 45 160" stroke="#B8962F" strokeWidth="0.6" fill="none" />
                                <path d="M30 160 C36 148, 42 135, 40 120" stroke="#B8962F" strokeWidth="0.6" fill="none" />
                                {/* Small buds/dots */}
                                <circle cx="8" cy="173" r="2" fill="#B8962F" opacity="0.5" />
                                <circle cx="15" cy="138" r="1.8" fill="#B8962F" opacity="0.4" />
                                <circle cx="22" cy="98" r="1.5" fill="#B8962F" opacity="0.4" />
                                <circle cx="45" cy="158" r="2" fill="#B8962F" opacity="0.5" />
                                <circle cx="40" cy="118" r="1.8" fill="#B8962F" opacity="0.4" />
                                <circle cx="28" cy="38" r="2.5" fill="#B8962F" opacity="0.5" />
                                {/* Additional tiny buds at branch tips */}
                                <circle cx="6" cy="174" r="1.2" fill="#B8962F" opacity="0.3" />
                                <circle cx="10" cy="172" r="1" fill="#B8962F" opacity="0.3" />
                                <circle cx="43" cy="160" r="1.2" fill="#B8962F" opacity="0.3" />
                                <circle cx="47" cy="157" r="1" fill="#B8962F" opacity="0.3" />
                            </svg>
                        </div>

                        {/* Form Content */}
                        <div className="relative z-10 px-12 sm:px-16 py-14 sm:py-16">
                            {/* Header */}
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.6 }}
                                className="text-center mb-10"
                            >
                                <h1 className="font-playfair italic text-[#333333] text-4xl sm:text-5xl mb-3">
                                    Save the Date
                                </h1>
                                <p className="font-lato text-[#666666] text-sm tracking-wide">
                                    Tell us about your special day.
                                </p>
                            </motion.div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* Name */}
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4, duration: 0.5 }}
                                >
                                    <label className="font-lato text-[#333333] text-sm tracking-wide">
                                        Name:
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent border-b border-[#333333]/30 py-2 text-[#333333] font-lato focus:border-[#D4AF37] focus:outline-none transition-colors disabled:opacity-50"
                                    />
                                </motion.div>

                                {/* Date */}
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5, duration: 0.5 }}
                                >
                                    <label className="font-lato text-[#333333] text-sm tracking-wide">
                                        Date:
                                    </label>
                                    <input
                                        type="text"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent border-b border-[#333333]/30 py-2 text-[#333333] font-lato focus:border-[#D4AF37] focus:outline-none transition-colors disabled:opacity-50"
                                    />
                                </motion.div>

                                {/* Extra line */}
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.55, duration: 0.5 }}
                                >
                                    <div className="w-full border-b border-[#333333]/30" />
                                </motion.div>

                                {/* Your Story */}
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.6, duration: 0.5 }}
                                >
                                    <label className="font-lato text-[#333333] text-sm tracking-wide">
                                        Your Story:
                                    </label>
                                    <textarea
                                        name="story"
                                        value={formData.story}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                        rows={4}
                                        className="w-full bg-transparent py-2 text-[#333333] font-lato focus:outline-none transition-colors resize-none disabled:opacity-50"
                                        style={{
                                            backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, rgba(51,51,51,0.2) 27px, rgba(51,51,51,0.2) 28px)",
                                            lineHeight: "28px",
                                        }}
                                    />
                                </motion.div>

                                {/* Status Messages */}
                                {submitStatus === "success" && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center text-sm text-green-700 font-lato"
                                    >
                                        Thank you! We&apos;ll be in touch soon.
                                    </motion.div>
                                )}
                                {submitStatus === "error" && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center text-sm text-red-700 font-lato"
                                    >
                                        Something went wrong. Please try again.
                                    </motion.div>
                                )}

                                {/* Submit Button */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.7, duration: 0.5 }}
                                    className="flex justify-center pt-2"
                                >
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        onMouseEnter={() => setIsHovered(true)}
                                        onMouseLeave={() => setIsHovered(false)}
                                        className="px-10 py-3 border border-[#D4AF37] font-lato text-sm tracking-[0.15em] transition-all duration-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{
                                            backgroundColor: isHovered && !isSubmitting ? "#D4AF37" : "transparent",
                                            color: isHovered && !isSubmitting ? "#FDFBF7" : "#D4AF37",
                                        }}
                                    >
                                        {isSubmitting ? "Sending..." : "Check Availability"}
                                    </button>
                                </motion.div>
                            </form>
                        </div>
                    </div>
                </motion.div>
            </section>
        </main>
    );
}
