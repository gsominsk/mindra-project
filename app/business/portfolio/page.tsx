"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Play, Pause, Volume2, VolumeX, ImageIcon, Maximize } from 'lucide-react';
import { BusinessNavigation } from "../components/BusinessNavigation";
import { getMediaUrl } from "../../lib/media";

// --- Types ---

interface PortfolioItem {
    id: string;
    type: 'video' | 'photo';
    title: string;
    client: string;
    link: string;
    src?: string; // Video URL or Image URL
    duration?: string;
}

// --- Data ---

const PORTFOLIO_ITEMS: PortfolioItem[] = [
    {
        id: '1',
        type: 'video',
        title: 'Конференція Mate Academy',
        client: 'Mate Academy',
        link: '#',
        src: getMediaUrl('videos/mate-academy.mp4'), // Placeholder
        duration: '02:30'
    },
    {
        id: '2',
        type: 'photo',
        title: 'Launch Party Diia.City',
        client: 'Diia.City',
        link: '#',
        src: getMediaUrl('images/diia-city.jpg') // Placeholder
    },
    {
        id: '3',
        type: 'video',
        title: 'Charity Gala Dinner',
        client: 'Tabletochki',
        link: '#',
        src: getMediaUrl('videos/charity.mp4'),
        duration: '01:45'
    },
    {
        id: '4',
        type: 'photo',
        title: 'Product Presentation Ajax',
        client: 'Ajax Systems',
        link: '#',
        src: getMediaUrl('images/ajax.jpg')
    },
    {
        id: '5',
        type: 'video',
        title: 'Kyiv International Economic Forum',
        client: 'KIEF',
        link: '#',
        src: getMediaUrl('videos/kief.mp4'),
        duration: '03:15'
    }
];

// --- Components ---

const MainContentDisplay = ({ item }: { item: PortfolioItem }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // Reset state when item changes
    useEffect(() => {
        setIsPlaying(false);
        setProgress(0);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [item.id]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoRef.current.requestFullscreen();
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = videoRef.current.currentTime;
            const total = videoRef.current.duration || 1;
            setProgress((current / total) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (videoRef.current) {
            const progressBar = e.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            const newTime = percentage * (videoRef.current.duration || 0);

            videoRef.current.currentTime = newTime;
            setProgress(percentage * 100);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex flex-col h-full justify-center">
            {/* Main Content Wrapper */}
            <motion.div
                key={item.id} // Animate when item changes
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center w-full"
            >
                <div className="w-full max-w-[600px] mx-auto">
                    {/* Client Name (Above Video, Left) */}
                    <div className="text-left mb-2">
                        <p className="text-zinc-400 font-inter text-xs md:text-sm lg:text-base italic">
                            {item.client}
                        </p>
                    </div>

                    {/* Media Player / Viewer */}
                    <div className="relative w-full aspect-[16/9] bg-[#1b1f23] rounded-xl overflow-hidden group shadow-2xl shadow-black/50 ring-1 ring-[#38434f]">
                        {item.type === 'video' ? (
                            <>
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover opacity-80"
                                    loop
                                    muted={isMuted}
                                    playsInline
                                    poster={item.src} // Using src as poster for now if it's an image, or just placeholder
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onClick={togglePlay}
                                >
                                    {/* In a real app, you'd have a proper video source here */}
                                    <source src={item.src} type="video/mp4" />
                                </video>

                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />

                                {/* Center Play Button */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <button
                                        onClick={togglePlay}
                                        className={`w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center transition-all transform duration-300 pointer-events-auto ${isPlaying ? 'opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:scale-105' : 'opacity-100 hover:bg-white/20 hover:scale-105'}`}
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-5 h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-white fill-current" />
                                        ) : (
                                            <Play className="w-5 h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-white fill-current ml-1" />
                                        )}
                                    </button>
                                </div>

                                {/* Bottom Controls Container */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">

                                    {/* Progress Bar */}
                                    <div
                                        className="w-full h-1 bg-white/30 rounded-full cursor-pointer overflow-hidden hover:h-1.5 transition-all"
                                        onClick={handleSeek}
                                    >
                                        <div
                                            className="h-full bg-white rounded-full"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>

                                    {/* Bottom Buttons */}
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={toggleMute}
                                            className="p-1.5 md:p-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-colors"
                                            title={isMuted ? "Unmute" : "Mute"}
                                        >
                                            {isMuted ? (
                                                <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                            ) : (
                                                <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                            )}
                                        </button>

                                        <button
                                            onClick={toggleFullscreen}
                                            className="p-1.5 md:p-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-colors"
                                            title="Fullscreen"
                                        >
                                            <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#1b1f23]">
                                <ImageIcon className="w-12 h-12 md:w-16 md:h-16 text-zinc-700" />
                                {/* Image would go here: <img src={item.src} alt={item.title} className="w-full h-full object-cover" /> */}
                            </div>
                        )}
                    </div>

                    {/* Bottom Row: Title & Action Button */}
                    <div className="flex items-center justify-between gap-4 md:gap-6 mt-2">
                        {/* Title (Left, max 2 lines) */}
                        <h2 className="text-white font-inter font-bold text-lg md:text-xl lg:text-2xl tracking-tight drop-shadow-md leading-tight line-clamp-2 flex-1">
                            {item.title}
                        </h2>

                        {/* Action Button (Right) */}
                        <Link
                            href={item.link}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black hover:border-white transition-all group shrink-0"
                            title="View Project"
                        >
                            <ArrowRight className="w-3 h-3 md:w-4 md:h-4 group-hover:-rotate-45 transition-transform duration-300" />
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const CarouselItem = ({ item, isActive, onClick }: { item: PortfolioItem; isActive: boolean; onClick: () => void }) => {
    // Video items are wider
    // Responsive widths: Mobile -> Tablet -> Desktop
    const widthClass = item.type === 'video'
        ? 'w-36 md:w-44 lg:w-56'
        : 'w-24 md:w-32 lg:w-40';

    return (
        <motion.div
            onClick={onClick}
            className={`relative flex-shrink-0 h-20 md:h-24 lg:h-32 ${widthClass} bg-[#1b1f23] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group ${isActive ? 'scale-105 z-10 ring-1 ring-white' : 'opacity-60 hover:opacity-100 hover:scale-102 ring-1 ring-[#38434f]'}`}
        >
            <div className="absolute inset-0 flex items-center justify-center bg-[#1b1f23] text-slate-400 font-inter text-[10px] md:text-xs font-bold group-hover:text-white transition-colors">
                {/* Placeholder for thumbnail */}
                <span className="z-10 relative text-center px-2">{item.client}</span>
                {item.type === 'video' && !isActive && (
                    <div className="absolute inset-0 flex items-center justify-center z-0 opacity-20">
                        <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-current" />
                    </div>
                )}
            </div>

            {item.type === 'video' && item.duration && (
                <div className="absolute bottom-1.5 right-1.5 md:bottom-2 md:right-2 bg-black/70 px-1 md:px-1.5 py-0.5 rounded text-[8px] md:text-[9px] text-white font-medium backdrop-blur-sm z-20">
                    {item.duration}
                </div>
            )}

            {/* Progress Overlay (Active Item) */}
            <div
                className={`progress-bar absolute left-0 top-0 bottom-0 bg-white/20 z-20 pointer-events-none transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                style={{ width: '0%' }}
            />

            {/* Inactive Indicator Overlay */}
            <div className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${isActive ? 'opacity-0' : 'opacity-100 hover:opacity-0'}`} />
        </motion.div>
    );
};

const Carousel = ({ items, activeIndex, onActiveChange }: { items: PortfolioItem[], activeIndex: number, onActiveChange: (index: number) => void }) => {
    // Duplicate items to simulate looping (triple the items for buffer)
    // We use a large buffer to allow continuous scrolling
    const loopedItems = [...items, ...items, ...items, ...items, ...items];
    const BUFFER_SETS = 5;
    const MIDDLE_SET_INDEX = 2; // 0, 1, [2], 3, 4

    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);
    const isHoveringRef = useRef(false);
    // New ref to track manual pause state on mobile/tablet
    const isPausedRef = useRef(false);
    const animationFrameRef = useRef<number>(0);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track current translate X position (negative value moves left)
    const currentTranslateX = useRef(0);

    // Track time for smooth animation
    const lastTimeRef = useRef<number | null>(null);

    // Track the exact width of a single set of items for seamless looping
    const singleSetWidthRef = useRef(0);

    // Local state to track the specific visual instance that is active
    const [visualActiveIndex, setVisualActiveIndex] = useState<number>(-1);
    // Ref to track visual index without triggering effect restarts
    const visualActiveIndexRef = useRef<number>(-1);

    // Touch handling refs
    const touchStartRef = useRef(0);
    const touchPreviousRef = useRef(0);
    const touchVelocityRef = useRef(0);
    const isDraggingRef = useRef(false);
    const lastTouchTimeRef = useRef(0);
    const momentumIdRef = useRef<number | null>(null);

    // Auto-scroll speed (pixels per second)
    // 15px/sec is approx 0.25px/frame at 60fps, very slow and smooth
    const SPEED_PX_PER_SEC = 15;

    // Easing function for smooth scroll (easeInOutCubic)
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const smoothScrollTo = (target: number, duration: number, onComplete: () => void) => {
        const start = currentTranslateX.current;
        const change = target - start;
        const startTime = performance.now();

        const animateScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;

            if (elapsed < duration) {
                const t = easeInOutCubic(elapsed / duration);
                const newPos = start + change * t;
                currentTranslateX.current = newPos;
                if (trackRef.current) {
                    trackRef.current.style.transform = `translate3d(${newPos}px, 0, 0)`;
                }
                requestAnimationFrame(animateScroll);
            } else {
                currentTranslateX.current = target;
                if (trackRef.current) {
                    trackRef.current.style.transform = `translate3d(${target}px, 0, 0)`;
                }
                onComplete();
            }
        };

        requestAnimationFrame(animateScroll);
    };

    // Initialize scroll position and measure width
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        const initialize = () => {
            const style = window.getComputedStyle(track);
            const gap = parseFloat(style.columnGap) || 16;

            // Measure width of one set dynamically from the DOM
            // This ensures pixel-perfect looping even with sub-pixel rendering
            let measuredWidth = 0;
            const children = Array.from(track.children) as HTMLElement[];

            // We only need to measure the first 'items.length' children
            for (let i = 0; i < items.length; i++) {
                if (children[i]) {
                    measuredWidth += children[i].offsetWidth + gap;
                }
            }

            singleSetWidthRef.current = measuredWidth;

            if (measuredWidth > 0 && currentTranslateX.current === 0) {
                // Move to start of middle set (negative value)
                currentTranslateX.current = -(measuredWidth * MIDDLE_SET_INDEX);
                track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
            }
        };

        // Small delay to ensure rendering is complete before measuring
        setTimeout(initialize, 100);

        // Re-measure on resize
        window.addEventListener('resize', initialize);
        return () => window.removeEventListener('resize', initialize);
    }, [items]);

    // Auto-scroll loop
    useEffect(() => {
        const animate = (time: number) => {
            const track = trackRef.current;
            if (!track) return;

            // Initialize time tracking
            if (lastTimeRef.current === null) {
                lastTimeRef.current = time;
            }

            const delta = time - lastTimeRef.current;
            lastTimeRef.current = time;

            // Move if not hovering (desktop only), not scrolling manually, not dragging, and not paused (mobile/tablet)
            // On mobile, we ignore isHoveringRef because touch events can leave it 'stuck' on true
            const isMobile = window.innerWidth < 1024;
            const shouldMove = isMobile
                ? (!isScrollingRef.current && !isPausedRef.current && !isDraggingRef.current && Math.abs(touchVelocityRef.current) < 0.1)
                : (!isHoveringRef.current && !isScrollingRef.current);

            if (shouldMove) {
                // Move based on time delta (pixels per second)
                // This ensures constant speed regardless of frame rate
                const move = (SPEED_PX_PER_SEC * delta) / 1000;
                currentTranslateX.current -= move;
                track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
            }

            // Momentum Logic
            if (!isDraggingRef.current && Math.abs(touchVelocityRef.current) > 0.1) {
                currentTranslateX.current += touchVelocityRef.current * (delta / 16); // Scale by frame time
                track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;

                // Friction
                touchVelocityRef.current *= 0.95;

                if (Math.abs(touchVelocityRef.current) < 0.1) {
                    touchVelocityRef.current = 0;
                    // Resume auto-scroll logic will pick up next frame
                }
            }

            // CRITICAL FIX: Only check for infinite loop jumps if NOT manually scrolling (via wheel)
            // But we DO want to check during touch drag/momentum to keep it infinite
            if (!isScrollingRef.current || isDraggingRef.current || Math.abs(touchVelocityRef.current) > 0.1) {
                const singleSetWidth = singleSetWidthRef.current;

                if (singleSetWidth > 0) {
                    // Boundaries for reset
                    // If we scrolled past set 3 (too far left), jump back to set 2
                    // currentTranslateX is negative, so "past" means smaller than
                    const leftBoundary = -(singleSetWidth * (MIDDLE_SET_INDEX + 1));

                    // If we scrolled before set 1 (too far right), jump forward to set 2
                    const rightBoundary = -(singleSetWidth * (MIDDLE_SET_INDEX - 1));

                    if (currentTranslateX.current <= leftBoundary) {
                        currentTranslateX.current += singleSetWidth;
                        track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
                    } else if (currentTranslateX.current >= rightBoundary) {
                        currentTranslateX.current -= singleSetWidth;
                        track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
                    }
                }
            }

            // Center detection & Progress Bar Update
            detectCenterItem(track);

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [items, onActiveChange]);

    const detectCenterItem = (track: HTMLDivElement) => {
        if (!containerRef.current) return;

        // Center of the viewport (container)
        const containerCenter = containerRef.current.clientWidth / 2;

        let closestDistance = Infinity;
        let closestIndex = -1;

        const children = Array.from(track.children) as HTMLElement[];
        const style = window.getComputedStyle(track);
        const gap = parseFloat(style.columnGap) || 16;

        children.forEach((child, index) => {
            // Calculate child's center relative to the track start
            const childWidth = child.offsetWidth;
            const childTrackCenter = child.offsetLeft + childWidth / 2;

            // Calculate child's visual center on screen
            const childVisualCenter = childTrackCenter + currentTranslateX.current;

            const distance = Math.abs(childVisualCenter - containerCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }

            // Update Progress Bar for Active Item
            // We want to update the progress bar for the *currently active* item (visualActiveIndexRef)
            // But we also need to update it for the *newly* active item if it changes.
            // Actually, we should just update the progress bar for THIS child if it is the closest one.
            // Or better: update progress for ALL visible children to handle transitions?
            // No, only the active one needs the bar.

            // Let's calculate progress for this child regardless of whether it's "closest" yet,
            // so we can update the DOM if it IS the closest.

            // Progress Logic:
            // Start of active zone (enters from right): visualCenter = containerCenter + (width + gap)/2
            // End of active zone (exits to left): visualCenter = containerCenter - (width + gap)/2
            // Span = width + gap

            const span = childWidth + gap;
            const start = containerCenter + span / 2;
            // const end = containerCenter - span / 2;

            // Progress 0 -> 1 as visualCenter goes Start -> End
            // progress = (Start - visualCenter) / Span

            let progress = (start - childVisualCenter) / span;

            // Clamp progress
            progress = Math.max(0, Math.min(1, progress));

            // Find the progress bar element
            // We assume it's the 3rd child div based on CarouselItem structure
            // Better to use class selector
            const progressBar = child.querySelector('.progress-bar') as HTMLElement;
            if (progressBar) {
                progressBar.style.width = `${progress * 100}%`;
            }
        });

        if (closestIndex !== -1) {
            if (closestIndex !== visualActiveIndexRef.current) {
                visualActiveIndexRef.current = closestIndex;
                setVisualActiveIndex(closestIndex);

                const originalIndex = closestIndex % items.length;
                onActiveChange(originalIndex);
            }
        }
    };

    // Touch Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = e.touches[0].clientX;
        touchPreviousRef.current = e.touches[0].clientX;
        touchVelocityRef.current = 0;
        isDraggingRef.current = true;
        lastTouchTimeRef.current = performance.now();

        // Pause auto-scroll immediately
        isPausedRef.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingRef.current) return;

        const currentX = e.touches[0].clientX;
        const delta = currentX - touchPreviousRef.current;
        const currentTime = performance.now();
        const timeDelta = currentTime - lastTouchTimeRef.current;

        // Update position
        currentTranslateX.current += delta;
        if (trackRef.current) {
            trackRef.current.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
        }

        // Calculate velocity (pixels per frame approx)
        if (timeDelta > 0) {
            touchVelocityRef.current = delta; // Simplified, we'll smooth it
        }

        touchPreviousRef.current = currentX;
        lastTouchTimeRef.current = currentTime;
    };

    const handleTouchEnd = () => {
        isDraggingRef.current = false;
        // Momentum will be handled in the animation loop
    };

    // Manual Scroll Handling (Wheel)
    const handleWheel = (e: WheelEvent) => {
        const track = trackRef.current;
        if (!track) return;

        isScrollingRef.current = true;
        // Reset lastTimeRef so animation doesn't jump when resuming
        lastTimeRef.current = null;

        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        // Horizontal scroll via vertical wheel
        // Note: deltaY is usually positive for scrolling down (moving right in our case)
        // We want scroll down -> move content left (decrease translateX)
        // But standard horizontal scroll behavior is: scroll down/right -> content moves left
        // Let's stick to standard: scroll down/right -> content moves left

        let delta = 0;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            delta = e.deltaY;
        } else {
            delta = e.deltaX;
        }

        // Subtract delta because moving content left requires negative translateX
        currentTranslateX.current -= delta;
        track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;

        e.preventDefault();

        // Resume auto-scroll after delay
        scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
            // Reset time reference when resuming auto-scroll
            lastTimeRef.current = null;
        }, 1000);
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const handleItemClick = (index: number) => {
        // If dragging, ignore click (it was a swipe)
        if (Math.abs(touchStartRef.current - touchPreviousRef.current) > 10) {
            return;
        }

        const track = trackRef.current;
        if (!track || !containerRef.current) return;

        const child = track.children[index] as HTMLElement;
        if (!child) return;

        // Mobile/Tablet Logic: Toggle Pause
        // Check if we are on mobile/tablet (using lg breakpoint as proxy)
        if (window.innerWidth < 1024) {
            if (index === visualActiveIndexRef.current && isPausedRef.current) {
                // If clicking the ALREADY active item AND it is currently PAUSED -> RESUME
                isPausedRef.current = false;
                // Return early to start auto-scroll immediately without re-centering animation
                return;
            } else {
                // Otherwise (clicking new item, OR clicking active item while moving) -> PAUSE
                isPausedRef.current = true;
            }
        }

        // Calculate target translateX to center the item
        // We want: child.offsetLeft + targetTranslateX + child.width/2 = container.width/2
        // So: targetTranslateX = container.width/2 - child.offsetLeft - child.width/2

        const containerCenter = containerRef.current.clientWidth / 2;
        const childTrackCenter = child.offsetLeft + child.offsetWidth / 2;
        const targetTranslateX = containerCenter - childTrackCenter;

        isScrollingRef.current = true;
        lastTimeRef.current = null;

        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        // Use custom smooth scroll with easing
        smoothScrollTo(targetTranslateX, 1200, () => {
            isScrollingRef.current = false;
            lastTimeRef.current = null;

            // Check boundaries after scroll
            const singleSetWidth = singleSetWidthRef.current;

            if (singleSetWidth > 0) {
                const leftBoundary = -(singleSetWidth * (MIDDLE_SET_INDEX + 1));
                const rightBoundary = -(singleSetWidth * (MIDDLE_SET_INDEX - 1));

                if (currentTranslateX.current <= leftBoundary) {
                    currentTranslateX.current += singleSetWidth;
                    track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
                } else if (currentTranslateX.current >= rightBoundary) {
                    currentTranslateX.current -= singleSetWidth;
                    track.style.transform = `translate3d(${currentTranslateX.current}px, 0, 0)`;
                }
            }
        });
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden group h-32 md:h-40 lg:h-48 touch-pan-y"
            onMouseEnter={() => {
                isHoveringRef.current = true;
                lastTimeRef.current = null;
            }}
            onMouseLeave={() => {
                isHoveringRef.current = false;
                lastTimeRef.current = null;
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Left Fade */}
            <div className="absolute left-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />

            {/* Right Fade */}
            <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

            {/* Center Indicator Line (Optional, for debugging or visual aid) */}
            {/* <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/50 z-20 pointer-events-none" /> */}

            <div
                ref={trackRef}
                className="flex gap-3 md:gap-4 px-4 md:px-6 lg:px-8 items-center h-full absolute left-0 top-0 will-change-transform"
                style={{
                    width: 'max-content',
                    backfaceVisibility: 'hidden',
                    perspective: '1000px'
                }}
            >
                {loopedItems.map((item, i) => (
                    <CarouselItem
                        key={i}
                        item={item}
                        isActive={i === visualActiveIndex}
                        onClick={() => handleItemClick(i)}
                    />
                ))}
            </div>
        </div>
    );
};

export default function BusinessPortfolio() {
    const [activeItemIndex, setActiveItemIndex] = useState(0);

    // Dedup updates to avoid unnecessary re-renders
    const handleActiveChange = useCallback((index: number) => {
        setActiveItemIndex(prev => prev !== index ? index : prev);
    }, []);

    return (
        <main className="min-h-screen bg-black font-inter selection:bg-[#70b5f9] selection:text-black overflow-x-hidden flex flex-col">
            {/* Navigation */}
            <div className="relative z-50">
                <BusinessNavigation />
            </div>

            <div className="flex-1 flex flex-col justify-center min-h-0 pt-20 pb-0">

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col justify-center">
                    <MainContentDisplay item={PORTFOLIO_ITEMS[activeItemIndex]} />
                </div>

                {/* Carousel Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="shrink-0 w-full mt-4 md:mt-8 lg:mt-12"
                >
                    <Carousel
                        items={PORTFOLIO_ITEMS}
                        activeIndex={activeItemIndex}
                        onActiveChange={handleActiveChange}
                    />
                </motion.div>
            </div>
        </main>
    );
}
