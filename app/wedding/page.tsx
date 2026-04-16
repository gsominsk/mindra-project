"use client";

import { motion } from "framer-motion";
import { WeddingNavigation } from "./components/WeddingNavigation";
import { FloralCorner } from "./components/FloralCorner";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function WeddingHome() {
    return (
        <main className="min-h-screen bg-[#FDFBF7] font-lato selection:bg-[#D4AF37]/30 selection:text-[#333333]">
            {/* Navigation */}
            <WeddingNavigation variant="transparent" />

            {/* Hero Section - Full Screen */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                {/* Background — color placeholder for hero photo */}
                <div className="absolute inset-0">
                    {/* Warm golden-hour gradient as background placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#8B7355] via-[#A0896B] to-[#6B5B3E]" />

                    {/* Simulated depth with additional overlays */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(218,190,140,0.4)_0%,transparent_60%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(139,115,85,0.3)_0%,transparent_50%)]" />

                    {/* Golden-hour overlay (20% opacity warm tint) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#B8962F]/20 via-transparent to-[#D4AF37]/10" />

                    {/* Subtle bottom vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
                </div>

                {/* Floral Corner Decorations */}
                <FloralCorner position="top-left" color="white" />
                <FloralCorner position="bottom-right" color="white" />

                {/* Hero Content */}
                <div className="relative z-20 text-center px-6">
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="font-playfair italic text-white text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] xl:text-[7rem] leading-[1.1] mb-6"
                    >
                        Creating Memories
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
                        className="font-lato text-white/90 text-lg sm:text-xl md:text-2xl tracking-[0.3em] font-light"
                    >
                        Your story, told beautifully.
                    </motion.p>

                    {/* CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.3 }}
                        className="mt-12"
                    >
                        <Link
                            href="/wedding/contact"
                            className="inline-flex items-center gap-3 px-10 py-4 border-2 border-white/80 text-white font-lato text-sm tracking-[0.2em] hover:bg-white hover:text-[#333333] transition-all duration-500 group"
                        >
                            GET IN TOUCH
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </div>

                {/* Scroll indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
                >
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="w-[1px] h-12 bg-white/50"
                    />
                </motion.div>
            </section>

            {/* About Section */}
            <section id="about" className="py-24 lg:py-32 bg-[#FDFBF7]">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <h2 className="font-playfair italic text-[#D4AF37] text-3xl lg:text-5xl mb-8">
                            Every Love Story is Beautiful
                        </h2>
                        <div className="w-16 h-[1px] bg-[#D4AF37]/50 mx-auto mb-8" />
                        <p className="font-lato text-[#666666] text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto">
                            We believe that your wedding day is one of the most important chapters of your life.
                            Our mission is to capture the essence of your love story and create unforgettable memories
                            that will last a lifetime.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="py-24 lg:py-32 bg-[#F5F0E8]">
                <div className="max-w-6xl mx-auto px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="text-center mb-16"
                    >
                        <h2 className="font-playfair italic text-[#333333] text-3xl lg:text-5xl mb-4">
                            Our Services
                        </h2>
                        <div className="w-16 h-[1px] bg-[#D4AF37]/50 mx-auto" />
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                title: "Ceremony Host",
                                desc: "Professional hosting and guiding of wedding ceremonies with elegance, warmth, and perfect timing.",
                                color: "#E8D5B7",
                            },
                            {
                                title: "Event Coordination",
                                desc: "Comprehensive planning and day-of coordination to ensure every detail is perfectly executed.",
                                color: "#D4C5A9",
                            },
                            {
                                title: "Entertainment",
                                desc: "Curated entertainment experiences from reception hosting to interactive games and dance coordination.",
                                color: "#C9B896",
                            },
                        ].map((service, index) => (
                            <motion.div
                                key={service.title}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: index * 0.15 }}
                                className="bg-[#FDFBF7] p-8 lg:p-10 text-center group hover:shadow-lg transition-shadow duration-500 border border-[#D4AF37]/10"
                            >
                                {/* Icon placeholder — colored circle */}
                                <div
                                    className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: service.color }}
                                >
                                    <div className="w-6 h-6 border-2 border-[#333333]/30 rounded-full" />
                                </div>
                                <h3 className="font-playfair italic text-[#333333] text-xl mb-4">
                                    {service.title}
                                </h3>
                                <p className="font-lato text-[#666666] text-sm leading-relaxed">
                                    {service.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 lg:py-32 bg-[#FDFBF7]">
                <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <h2 className="font-playfair italic text-[#333333] text-3xl lg:text-5xl mb-6">
                            Ready to Begin Your Story?
                        </h2>
                        <p className="font-lato text-[#666666] text-lg mb-10">
                            Let&apos;s create something beautiful together.
                        </p>
                        <Link
                            href="/wedding/contact"
                            className="inline-flex items-center gap-3 px-12 py-4 bg-[#D4AF37] text-white font-lato text-sm tracking-[0.2em] hover:bg-[#B8962F] transition-all duration-300 group"
                        >
                            CONTACT US
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
