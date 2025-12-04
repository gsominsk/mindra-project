"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BusinessNavigation } from "./components/BusinessNavigation";
import { getMediaUrl } from "../lib/media";

export default function BusinessHome() {
    return (
        <main className="min-h-screen bg-black font-inter selection:bg-[#70b5f9] selection:text-black">
            <BusinessNavigation />

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-black">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                        {/* Left Content */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="flex flex-col gap-8"
                        >
                            <div className="space-y-4">
                                <h1 className="font-inter font-extrabold text-5xl lg:text-7xl text-white leading-[1.1] tracking-tight">
                                    Elevate Your <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Corporate Event.</span>
                                </h1>
                                <p className="text-lg lg:text-xl text-slate-400 max-w-lg leading-relaxed">
                                    Professional hosting for conferences, summits, and award ceremonies. Delivering stability, trust, and ROI for your brand.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    href="/business/contact"
                                    className="inline-flex items-center justify-center gap-2 bg-[#0a66c2] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#004182] transition-colors"
                                >
                                    Request Proposal <ArrowRight className="w-4 h-4" />
                                </Link>
                                <Link
                                    href="/business/portfolio"
                                    className="inline-flex items-center justify-center gap-2 bg-transparent text-white border border-white px-8 py-4 rounded-full text-base font-semibold hover:bg-white/10 transition-colors"
                                >
                                    View Portfolio
                                </Link>
                            </div>
                        </motion.div>

                        {/* Right Image */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="relative h-[400px] lg:h-[550px] w-full rounded-lg overflow-hidden border border-[#38434f] bg-[#1b1f23]"
                        >
                            {/* Using a placeholder color/gradient until actual image is available, or reusing one if possible */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-slate-500 font-medium">Host on Stage Image</span>
                            </div>
                            {/* If we had the image, it would be here:
                <Image
                 src={getMediaUrl('images/corporate-host.jpg')}
                 alt="Corporate Host on Stage"
                 fill
                 className="object-cover"
               />
               */}
                        </motion.div>

                    </div>
                </div>
            </section>
        </main>
    );
}
