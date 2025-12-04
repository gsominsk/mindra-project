"use client";

import { useState, useRef } from "react";
import { getMediaUrl } from "./lib/media";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, X, ArrowRight, Volume2, VolumeX, RotateCcw, Instagram, Send, Menu } from "lucide-react";
import { useLanguage } from "./context/LanguageContext";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

// --- Components ---

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

const NavigationDock = () => {
  const { t, language, setLanguage } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const navItems = [
    // { key: "party", label: t.home.nav.party },
    // { key: "business", label: t.home.nav.business },
    // { key: "wedding", label: t.home.nav.wedding },
    { key: "contact", label: t.home.nav.contact }
  ];

  const languages = [
    { code: "uk", label: "UA" },
    { code: "en", label: "EN" }
  ];

  return (
    <>
      {/* Desktop Navigation Dock - hidden on mobile/tablet */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:block absolute bottom-[72px] left-1/2 -translate-x-1/2 z-50"
      >
        <nav className="bg-white/5 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full flex items-center gap-8 shadow-2xl">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={`/${item.key}`}
              className="text-[10px] lg:text-xs font-roboto font-bold tracking-[0.2em] text-white hover:text-zinc-300 transition-colors relative group uppercase"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>
      </motion.div>

      {/* Mobile/Tablet Controls */}
      <div className="lg:hidden absolute bottom-8 right-6 z-50 flex flex-col items-end gap-3">

        {/* Language Switcher Button */}
        <div className="relative">
          <button
            onClick={() => {
              setIsLangMenuOpen(!isLangMenuOpen);
              setIsMobileMenuOpen(false);
            }}
            className="w-12 h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <span className="text-xs font-roboto font-bold text-white uppercase">
              {language === "uk" ? "UA" : "EN"}
            </span>
          </button>

          {/* Language Dropdown */}
          <AnimatePresence>
            {isLangMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-0 right-16 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex gap-2"
              >
                {languages.map((lang, index) => (
                  <motion.button
                    key={lang.code}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      setLanguage(lang.code as "en" | "uk");
                      setIsLangMenuOpen(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-roboto font-bold transition-colors ${language === lang.code
                      ? "bg-white text-black"
                      : "text-white hover:bg-white/10"
                      }`}
                  >
                    {lang.label}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hamburger Menu Button */}
        <button
          onClick={() => {
            setIsMobileMenuOpen(!isMobileMenuOpen);
            setIsLangMenuOpen(false);
          }}
          className="w-12 h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 right-16 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-w-[200px]"
            >
              <nav className="flex flex-col gap-2">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={`/${item.key}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block text-sm font-roboto font-bold tracking-wider text-white hover:text-zinc-300 transition-colors py-3 px-4 hover:bg-white/5 rounded-lg uppercase"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

const VideoPreview = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

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

  const restartVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div
      onClick={togglePlay}
      className="group relative w-full aspect-[21/9] bg-zinc-900 overflow-hidden cursor-pointer"
    >
      <video
        ref={videoRef}
        src={getMediaUrl('videos/IMG_3759.MOV')}
        autoPlay
        muted={isMuted}
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-100 lg:opacity-60 lg:group-hover:opacity-100 transition-opacity duration-700"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-transparent lg:bg-black/20 lg:group-hover:bg-transparent transition-colors duration-500 pointer-events-none" />

      {/* Controls */}
      <div className="absolute bottom-4 left-4 z-20 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={toggleMute}
          className="w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors text-white"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={restartVideo}
          className="w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors text-white"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Play/Pause Icon (Decorative/Status) */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
        {isPlaying ? (
          <Pause className="w-4 h-4 text-white opacity-0 lg:group-hover:opacity-100 transition-opacity" />
        ) : (
          <Play className="w-4 h-4 text-white opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
};

const ContactModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ name: '', contact: '' });
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
          contact: formData.contact,
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', contact: '' });
        setTimeout(() => {
          onClose();
          setSubmitStatus('idle');
        }, 2000);
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-[#0a0a0a] border border-white/10 w-full max-w-2xl p-8 lg:p-12 relative overflow-hidden"
          >
            <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>

            <h2 className="font-syne font-bold text-4xl text-white mb-2">{t.modal.title}</h2>
            <p className="text-zinc-400 font-inter text-sm mb-8">{t.modal.subtitle}</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest text-zinc-500 uppercase">{t.modal.nameLabel}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-transparent border-b border-zinc-800 py-2 text-white focus:border-white focus:outline-none transition-colors font-syne text-xl disabled:opacity-50"
                  placeholder={t.modal.namePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest text-zinc-500 uppercase">{t.modal.contactLabel}</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-transparent border-b border-zinc-800 py-2 text-white focus:border-white focus:outline-none transition-colors font-syne text-xl disabled:opacity-50"
                  placeholder={t.modal.contactPlaceholder}
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
                className="w-full bg-white text-black py-4 mt-4 font-syne font-bold tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'SENDING...' : t.modal.sendButton}
                {!isSubmitting && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-white selection:bg-white selection:text-black">
      <GrainOverlay />
      <ContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Split Layout */}
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">

        {/* Left: Typography & Action */}
        <div className="relative flex flex-col justify-center p-6 lg:px-20 lg:py-0 z-10 order-2 lg:order-1 bg-[#050505]">

          {/* Header / Language Switcher */}
          <div className="absolute top-6 left-6 lg:top-8 lg:left-20 flex items-center gap-4 lg:gap-8">
            <div className="hidden lg:flex">
              <LanguageSwitcher />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-0 lg:mt-12"
          >
            {/* Desktop title - hidden on mobile */}
            <h1 className="hidden lg:block font-roboto font-extrabold text-[12vw] md:text-[8vw] lg:text-[5vw] leading-[1.1] tracking-tighter text-white mb-6 lg:mb-8">
              {t.home.title.map((line, i) => (
                <span key={i} className="block">{line}</span>
              ))}
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex flex-col gap-4 lg:gap-6 w-full lg:max-w-md mx-auto lg:mx-0"
          >
            {/* Video Preview Block */}
            <VideoPreview />

            <div className="flex items-center gap-3 lg:gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-1 bg-white text-black py-3 lg:py-4 font-roboto font-bold text-xs lg:text-sm tracking-widest hover:bg-zinc-200 transition-colors"
              >
                {t.home.bookNow}
              </button>
              <Link
                href="https://ig.me/m/grubngodeliveryigormindra"
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[48px] w-12 h-12 border border-white/20 flex items-center justify-center hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Instagram className="w-4 h-4" />
              </Link>
              <Link
                href="https://t.me/igormindra"
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[48px] w-12 h-12 border border-white/20 flex items-center justify-center hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Right: Visual */}
        <div className="relative h-[60vh] md:h-[75vh] lg:h-full w-full order-1 lg:order-2 overflow-hidden">
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 bg-zinc-900"
          >
            <Image
              src={getMediaUrl('images/hero-bg.jpg')}
              alt="Mindra Host"
              fill
              className="object-cover object-top"
              priority
            />

            {/* Mobile/Tablet Title Overlay with Gradient */}
            <div className="lg:hidden absolute inset-0">
              {/* Bottom Gradient */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
                className="absolute bottom-8 left-6 right-20 z-10"
              >
                <h1 className="font-roboto font-extrabold text-[12vw] md:text-[10vw] leading-[1.1] tracking-tighter text-white">
                  {t.home.title.map((line, i) => (
                    <span key={i} className="block">{line}</span>
                  ))}
                </h1>
              </motion.div>
            </div>

            {/* Gradient Overlay for blending - desktop only */}
            <div className="hidden lg:block absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#050505]" />
          </motion.div>

          <NavigationDock />
        </div>

      </div>
    </main>
  );
}
