"use client";

import { motion } from "framer-motion";
import { Instagram, Youtube, Facebook, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export const WeddingFooter = () => {
    const [email, setEmail] = useState("");

    return (
        <footer className="bg-[#F5F0E8] border-t border-[#D4AF37]/20">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">

                    {/* Column 1 - Company Info */}
                    <div>
                        <h3 className="font-playfair italic text-xl text-[#333333] mb-4">
                            Mindra Weddings
                        </h3>
                        <p className="font-lato text-sm text-[#666666] leading-relaxed mb-4">
                            Bespoke Love Stories
                        </p>
                        <div className="font-lato text-sm text-[#666666] space-y-1">
                            <p>+123 456 7900</p>
                            <p>mindraweddings.com</p>
                        </div>
                    </div>

                    {/* Column 2 - Contact Us */}
                    <div className="flex flex-col items-center">
                        <h3 className="font-lato text-sm font-bold tracking-[0.15em] text-[#333333] mb-4 uppercase">
                            Contact Us
                        </h3>
                        <div className="flex items-center gap-4">
                            <Link
                                href="https://facebook.com"
                                target="_blank"
                                className="w-10 h-10 rounded-full border border-[#D4AF37]/40 flex items-center justify-center text-[#333333] hover:bg-[#D4AF37] hover:text-white hover:border-[#D4AF37] transition-all duration-300"
                            >
                                <Facebook className="w-4 h-4" />
                            </Link>
                            <Link
                                href="https://instagram.com"
                                target="_blank"
                                className="w-10 h-10 rounded-full border border-[#D4AF37]/40 flex items-center justify-center text-[#333333] hover:bg-[#D4AF37] hover:text-white hover:border-[#D4AF37] transition-all duration-300"
                            >
                                <Instagram className="w-4 h-4" />
                            </Link>
                            <Link
                                href="https://youtube.com"
                                target="_blank"
                                className="w-10 h-10 rounded-full border border-[#D4AF37]/40 flex items-center justify-center text-[#333333] hover:bg-[#D4AF37] hover:text-white hover:border-[#D4AF37] transition-all duration-300"
                            >
                                <Youtube className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Column 3 - Newsletter */}
                    <div>
                        <h3 className="font-lato text-sm font-bold tracking-[0.15em] text-[#333333] mb-4 uppercase">
                            Stay Connected
                        </h3>
                        <div className="flex">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email..."
                                className="flex-1 bg-white border border-[#D4AF37]/30 px-4 py-2.5 text-sm font-lato text-[#333333] placeholder-[#999999] focus:outline-none focus:border-[#D4AF37] transition-colors"
                            />
                            <button className="px-4 py-2.5 bg-[#D4AF37] text-white hover:bg-[#B8962F] transition-colors">
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-[#D4AF37]/10">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
                    <p className="text-center font-lato text-xs text-[#999999]">
                        © 2024 Mindra Weddings. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
};
