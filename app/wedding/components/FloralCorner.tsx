"use client";

import { motion } from "framer-motion";

interface FloralCornerProps {
    position: "top-left" | "bottom-right";
    color?: string;
    className?: string;
}

export const FloralCorner = ({ position, color = "white", className = "" }: FloralCornerProps) => {
    const isTopLeft = position === "top-left";

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.7, scale: 1 }}
            transition={{ duration: 1.5, delay: isTopLeft ? 0.5 : 0.8, ease: "easeOut" }}
            className={`absolute pointer-events-none z-10 ${isTopLeft ? "top-0 left-0" : "bottom-0 right-0"
                } ${className}`}
            style={{
                transform: isTopLeft ? "none" : "rotate(180deg)",
            }}
        >
            <svg
                width="220"
                height="220"
                viewBox="0 0 220 220"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] lg:w-[220px] lg:h-[220px]"
            >
                {/* Main flower */}
                <g stroke={color} strokeWidth="1.2" opacity="0.8">
                    {/* Petals */}
                    <path d="M45 45 C55 20, 70 15, 75 35 C80 15, 95 20, 85 45" />
                    <path d="M45 45 C20 55, 15 70, 35 75 C15 80, 20 95, 45 85" />
                    <path d="M45 45 C55 70, 70 75, 75 55 C80 75, 95 70, 85 45" />
                    <path d="M45 45 C70 35, 75 20, 55 15 C75 10, 70 -5, 45 5" />

                    {/* Center */}
                    <circle cx="45" cy="45" r="6" strokeWidth="1" />
                    <circle cx="45" cy="45" r="3" strokeWidth="0.8" />
                </g>

                {/* Branch 1 - diagonal */}
                <g stroke={color} strokeWidth="0.9" opacity="0.6">
                    <path d="M65 65 C90 90, 120 110, 160 140" fill="none" />
                    {/* Leaves on branch 1 */}
                    <path d="M90 88 C85 75, 95 70, 100 82" fill="none" />
                    <path d="M110 105 C118 92, 125 95, 118 108" fill="none" />
                    <path d="M130 120 C122 112, 128 105, 135 115" fill="none" />
                    <path d="M145 133 C152 122, 158 126, 150 136" fill="none" />
                </g>

                {/* Branch 2 - going right */}
                <g stroke={color} strokeWidth="0.9" opacity="0.5">
                    <path d="M70 40 C100 38, 140 42, 190 60" fill="none" />
                    {/* Leaves */}
                    <path d="M100 37 C105 25, 112 28, 108 40" fill="none" />
                    <path d="M130 39 C128 27, 136 26, 135 38" fill="none" />
                    <path d="M158 48 C162 36, 170 38, 164 50" fill="none" />
                </g>

                {/* Branch 3 - going down */}
                <g stroke={color} strokeWidth="0.9" opacity="0.5">
                    <path d="M40 70 C38 100, 42 140, 60 190" fill="none" />
                    {/* Leaves */}
                    <path d="M37 100 C25 105, 28 112, 40 108" fill="none" />
                    <path d="M39 130 C27 128, 26 136, 38 135" fill="none" />
                    <path d="M48 158 C36 162, 38 170, 50 164" fill="none" />
                </g>

                {/* Small secondary flower */}
                <g stroke={color} strokeWidth="0.8" opacity="0.4">
                    <path d="M170 55 C175 45, 182 45, 180 55 C188 50, 190 58, 182 60 C188 65, 185 72, 178 67 C178 75, 170 72, 172 64 C165 68, 163 60, 170 58" />
                    <circle cx="176" cy="58" r="3" strokeWidth="0.6" />
                </g>

                {/* Small buds */}
                <g stroke={color} strokeWidth="0.7" opacity="0.35">
                    <path d="M55 170 C52 162, 58 160, 60 168" fill="none" />
                    <path d="M55 170 C48 165, 50 160, 56 165" fill="none" />
                    <circle cx="55" cy="172" r="1.5" />
                </g>
            </svg>
        </motion.div>
    );
};
