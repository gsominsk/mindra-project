'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Mic, Square, Play, Image as ImageIcon, Send, Loader2, Key, Settings, X, Menu, Paperclip, GripVertical, LayoutDashboard, ChevronLeft, ChevronRight, Plus, List, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactSortable } from 'react-sortablejs';
import useEmblaCarousel from 'embla-carousel-react';
import { logger } from './logger';
import { useAppStore } from './store';
import {
  createList,
  reorderLists,
  createAttachment,
  updateAttachment,
  reorderAttachments,
  addHistoryEntry,
  updateSettings,
  ClientDashboardItem,
  ClientSettings,
  ClientAttachment,
  ClientAttachmentHistory
} from './actions';

function DashboardCarousel({ 
  items, 
  variant = 'default', 
  isTimerRunning = false,
  enableBlur = false
}: { 
  items: { url?: string; prompt?: string }[], 
  variant?: 'default' | 'contain', 
  isTimerRunning?: boolean,
  enableBlur?: boolean 
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const { hasStartedGeneration, setHasStartedGeneration } = useAppStore();

  useEffect(() => {
    if (emblaApi && isTimerRunning) {
      if (hasStartedGeneration) {
        emblaApi.scrollNext();
      } else {
        setHasStartedGeneration(true);
      }
    }
  }, [emblaApi, isTimerRunning, hasStartedGeneration, setHasStartedGeneration]);

  const itemsKey = JSON.stringify(items?.map(i => i.url));

  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit();
    }
  }, [emblaApi, itemsKey]);

  const scrollPrev = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  return (
    <div className={`overflow-hidden relative group w-full ${variant === 'default' ? 'rounded-xl bg-neutral-950 aspect-[4/3]' : 'h-full flex-1'}`} ref={emblaRef}>
      <div className="flex h-full">
        {items.map((item, idx) => (
          <div key={idx} className={`flex-[0_0_100%] min-w-0 relative h-full flex flex-col ${variant === 'contain' ? 'items-center justify-center' : ''}`}>
            {variant === 'default' && item.prompt && item.prompt.trim() !== '' && (
              <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-neutral-300 text-xs font-medium truncate shrink-0 z-10 w-full text-left">
                prompt: {item.prompt}
              </div>
            )}
            <div className={`relative flex-1 w-full ${variant === 'contain' ? 'flex items-center justify-center' : ''}`}>
              {item.url ? (
                <img 
                  src={item.url} 
                  alt={`slide ${idx}`} 
                  className={`${variant === 'default' ? 'absolute inset-0 w-full h-full object-cover' : 'w-full h-auto max-h-full object-contain'} transition-all duration-700 ${enableBlur && idx === 0 && !hasStartedGeneration ? 'blur-2xl scale-110' : 'blur-0 scale-100'}`} 
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      
      <button 
        type="button"
        onClick={scrollPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-20"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button 
        type="button"
        onClick={scrollNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-20"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function VoiceVisualizer({ isActive }: { isActive: boolean }) {
  const [volumes, setVolumes] = useState<number[]>(new Array(24).fill(4));
  const requestRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.6;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const update = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          
          const newVolumes: number[] = [];
          for (let i = 0; i < 24; i++) {
            const binIdx = Math.floor((i / 24) * (bufferLength * 0.5));
            const value = dataArray[binIdx];
            const height = Math.max(4, (value / 255) * 44);
            newVolumes.push(height);
          }
          setVolumes(newVolumes);
          requestRef.current = requestAnimationFrame(update);
        };

        update();
      } catch (err) {
        console.error("Audio visualizer error:", err);
      }
    };

    initAudio();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setVolumes(new Array(24).fill(4));
    };
  }, [isActive]);

  return (
    <div className="flex items-center justify-center gap-1.5 h-[52px] w-full bg-neutral-950 border border-neutral-800 rounded-full px-8 overflow-hidden">
      {volumes.map((height, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-neutral-800'}`}
          animate={{
            height: height,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8
          }}
        />
      ))}
    </div>
  );
}

interface PartyPromptsAppProps {
  serverLists?: ClientDashboardItem[];
  serverSettings?: ClientSettings;
  initialView?: 'main' | 'dashboard';
}

export default function PartyPromptsApp({ serverLists = [], serverSettings, initialView = 'main' }: PartyPromptsAppProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    openRouterKey, setOpenRouterKey,
    isSettingsOpen, setIsSettingsOpen,
    isMenuOpen, setIsMenuOpen,
    currentView, setCurrentView,
    autoSendTranscription, setAutoSendTranscription,
    hideTextPrompt, setHideTextPrompt,
    dashboardItems, setDashboardItems,
    isGenerating1, setIsGenerating1,
    image1, setImage1,
    isAttachmentsOpen, setIsAttachmentsOpen,
    isChooseListOpen, setIsChooseListOpen,
    attachments, setAttachments,
    selectedAttachment, setSelectedAttachment,
    selectedDashboardList, setSelectedDashboardList,
    timerDuration, setTimerDuration,
    timeLeft, setTimeLeft,
    isTimerRunning, setIsTimerRunning,
    isTimerVisible, setIsTimerVisible,
    prompt2, setPrompt2,
    isRecording,
    isGenerating2, setIsGenerating2,
    image2, setImage2,
  } = useAppStore();

  const [selectedReferences, setSelectedReferences] = useState<{id: string, url: string}[]>([]);

  // Route & View sync
  useEffect(() => {
    if (pathname === '/party-prompts/dashboard') {
      setCurrentView('dashboard');
    } else if (pathname === '/party-prompts') {
      setCurrentView('main');
    } else if (initialView) {
      setCurrentView(initialView);
    }
  }, [pathname, initialView, setCurrentView]);

  // Hydration from server props
  useEffect(() => {
    if (serverSettings) {
      if (serverSettings.openRouterKey) setOpenRouterKey(serverSettings.openRouterKey);
      if (serverSettings.timerDuration) {
        setTimerDuration(serverSettings.timerDuration);
        setTimeLeft(serverSettings.timerDuration);
      }
      setAutoSendTranscription(serverSettings.autoSendTranscription);
      setHideTextPrompt(serverSettings.hideTextPrompt);
    }
    if (serverLists && serverLists.length > 0) {
      setDashboardItems(serverLists as unknown as typeof dashboardItems);
      const savedId = typeof window !== 'undefined' ? sessionStorage.getItem('selectedDashboardListId') : null;
      const found = serverLists.find(l => l.id === savedId) || serverLists[0];
      if (found) {
        setSelectedDashboardList(found as unknown as typeof selectedDashboardList);
      }
    }
  }, [serverLists, serverSettings, setOpenRouterKey, setTimerDuration, setTimeLeft, setAutoSendTranscription, setHideTextPrompt, setDashboardItems, setSelectedDashboardList]);

  useEffect(() => {
    // Global unhandled runtime error listener
    const handleGlobalError = (event: ErrorEvent) => {
      logger.error('CLIENT_UNHANDLED_ERROR', event.message || 'Global window error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('CLIENT_UNHANDLED_REJECTION', event.reason?.message || String(event.reason), {
        reason: event.reason,
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${formattedDate} в ${formattedTime}`;
  };

  const mediaRecorderRef = useRef<{ stop: () => void } | null>(null);
  
  const prompt2Ref = useRef(prompt2);
  useEffect(() => {
    prompt2Ref.current = prompt2;
  }, [prompt2]);

  const autoSendRef = useRef(autoSendTranscription);
  useEffect(() => {
    autoSendRef.current = autoSendTranscription;
  }, [autoSendTranscription]);

  const [isDraggingOnDetail, setIsDraggingOnDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailUploadInputRef = useRef<HTMLInputElement>(null);
  const [detailGenPrompt, setDetailGenPrompt] = useState('');
  const [isGeneratingDetail, setIsGeneratingDetail] = useState(false);

  // Upload helper: POST file to server endpoint
  const uploadFile = async (file: File, batchIndex: number = 1): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batchIndex', String(batchIndex));
    const res = await fetch('/party-prompts/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  };

  // Image Generation via OpenRouter
  const handleGenerateImage = async (prompt: string, column: 1 | 2) => {
    if (!prompt.trim()) {
      logger.warn('OPENROUTER_API', `Generation cancelled: Prompt is empty for column ${column}`);
      return;
    }
    if (!openRouterKey.trim()) {
      logger.warn('OPENROUTER_API', `Generation failed: OpenRouter Key is missing`);
      alert('Пожалуйста, введите OpenRouter API Key в настройках.');
      return;
    }
    
    if (column === 1) setIsGenerating1(true);
    else setIsGenerating2(true);
    
    try {
      await logger.measure('OPENROUTER_API', `Column ${column} Image Generation (${prompt.substring(0, 40)}...)`, async () => {
        const res = await fetch('/party-prompts/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            referenceUrls: selectedReferences,
          })
        });
        
        const data = await res.json();
        logger.info('OPENROUTER_API', `Server generation response received`, data);
        
        if (res.ok) {
          const message = data.choices?.[0]?.message;
          const content = message?.content || '';
          let imageUrl = null;
          
          const images = message?.images;
          if (images && images.length > 0 && images[0].image_url?.url) {
            imageUrl = images[0].image_url.url;
          } else if (content) {
            const match = content.match(/!\[.*?\]\((.*?)\)/);
            if (match) {
              imageUrl = match[1];
            } else if (content.startsWith('http')) {
              imageUrl = content.trim();
            }
          }

          if (imageUrl) {
            if (column === 1) setImage1(imageUrl);
            else setImage2(imageUrl);
            logger.success('OPENROUTER_API', `Successfully generated image for Column ${column}`, { imageUrl });
          } else {
            logger.error('OPENROUTER_API', `No image found in response`, data);
            alert('Не удалось извлечь картинку из ответа.');
          }
        } else {
          logger.error('OPENROUTER_API', `API error ${res.status}`, data);
          const errorMessage = data.error?.message || 'Ошибка генерации картинки';
          alert(errorMessage);
        }
      });
    } catch (err) {
      logger.error('OPENROUTER_API', `Network failure for Column ${column}`, err);
      alert('Ошибка при соединении с сервером OpenRouter');
    } finally {
      if (column === 1) setIsGenerating1(false);
      else setIsGenerating2(false);
    }
  };

  // Speech Recognition
  const startRecording = () => {
    const SpeechRecognitionClass = (window as unknown as { SpeechRecognition: new () => SpeechRecognition; webkitSpeechRecognition: new () => SpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      logger.warn('SPEECH_REC', 'SpeechRecognition API is not supported in this browser');
      alert("Ваш браузер не поддерживает распознавание речи.");
      return;
    }

    try {
      logger.info('SPEECH_REC', 'Starting speech recognition (ru-RU)...');
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = true;
      
      mediaRecorderRef.current = recognition;
      
      const initialPrompt = prompt2;
      let finalTranscript = '';
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const newText = (finalTranscript + interimTranscript).trim();
        logger.info('SPEECH_REC', `Transcription update: "${newText.substring(0, 30)}..."`);
        setPrompt2(initialPrompt ? `${initialPrompt} ${newText}` : newText);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        logger.error('SPEECH_REC', `Speech recognition error: ${event.error}`, event);
        if (event.error !== 'no-speech') stopRecording();
      };

      recognition.onend = () => {
        logger.info('SPEECH_REC', 'Speech recognition ended');
        useAppStore.getState().setIsRecording(false);
      };

      recognition.start();
      useAppStore.getState().setIsRecording(true);
    } catch (err) {
      logger.error('SPEECH_REC', 'Failed to start speech recognition', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try { mediaRecorderRef.current.stop(); } catch (_e) {}
      useAppStore.getState().setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => { setTimeLeft(prev => prev - 1); }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setIsTimerVisible(false);
      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch (_e) {}
      }
      useAppStore.getState().setIsRecording(false);
      if (autoSendRef.current && prompt2Ref.current.trim()) {
        handleGenerateImage(prompt2Ref.current, 2);
      }
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerRunning, timeLeft]);

  const startTimer = () => {
    setImage2(null);
    setTimeLeft(timerDuration);
    setIsTimerRunning(true);
    setIsTimerVisible(true);
    if (!isRecording) startRecording();
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleAddNewList = async () => {
    const date = new Date();
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}-${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    try {
      const newList = await createList(formattedDate);
      setDashboardItems([newList as unknown as typeof dashboardItems[0], ...dashboardItems]);
    } catch (err) {
      logger.error('DASHBOARD', 'Failed to create list', err);
    }
  };

  const handleDropOnAddNew = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files as Iterable<File>).filter((f: File) => f.type.startsWith('image/'));
    if (files.length > 0) {
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}-${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      try {
        const newList = await createList(formattedDate);
        const createdAttachments: ClientAttachment[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const serverUrl = await uploadFile(file, i + 1);
          const shortId = Math.random().toString(36).substring(2, 8);
          const name = `${formattedDate}-${shortId}`;

          const att = await createAttachment({
            listId: newList.id,
            name,
            imageUrl: serverUrl,
            isUploaded: true
          });

          await addHistoryEntry({
            attachmentId: att.id,
            imageUrl: serverUrl,
            isUploaded: true
          });

          createdAttachments.push(att);
        }

        const updatedList = {
          ...newList,
          attachments: createdAttachments,
          items: createdAttachments.map(a => ({ url: a.url, prompt: a.prompt }))
        };

        setDashboardItems([updatedList as unknown as typeof dashboardItems[0], ...dashboardItems]);
      } catch (err) {
        logger.error('DASHBOARD', 'Failed to add list via drop', err);
      }
    }
  };

  const handleDropOnItem = async (e: React.DragEvent, itemId: string) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files as Iterable<File>).filter((f: File) => f.type.startsWith('image/'));
    if (files.length > 0) {
      const dashItem = dashboardItems.find(item => item.id === itemId);
      const dashboardItemName = dashItem ? dashItem.name : 'Unknown';

      try {
        const newAttachments: ClientAttachment[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const serverUrl = await uploadFile(file, i + 1);
          const shortId = Math.random().toString(36).substring(2, 8);
          const name = `${dashboardItemName}-${shortId}`;

          const att = await createAttachment({
            listId: itemId,
            name,
            imageUrl: serverUrl,
            isUploaded: true
          });

          await addHistoryEntry({
            attachmentId: att.id,
            imageUrl: serverUrl,
            isUploaded: true
          });

          newAttachments.push(att);
        }

        setDashboardItems(dashboardItems.map(item => {
          if (item.id === itemId) {
            const combined = [...newAttachments, ...(item.attachments || [])];
            return {
              ...item,
              attachments: combined as unknown as typeof item.attachments,
              items: combined.filter(a => a.url).map(a => ({ url: a.url, prompt: a.prompt }))
            };
          }
          return item;
        }));
      } catch (err) {
        logger.error('DASHBOARD', 'Failed to add files to item', err);
      }
    }
  };

  const handleAddAttachment = async () => {
    if (!selectedDashboardList) return;
    const dashboardItemName = selectedDashboardList.name;
    const shortId = Math.random().toString(36).substring(2, 8);
    const name = `${dashboardItemName}-${shortId}`;

    try {
      const att = await createAttachment({
        listId: selectedDashboardList.id,
        name
      });
      setAttachments(prev => [att as unknown as typeof prev[0], ...prev]);
    } catch (err) {
      logger.error('ATTACHMENTS', 'Failed to create attachment', err);
    }
  };

  const handleDropOnAttachments = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!selectedDashboardList) return;
    const files = Array.from(e.dataTransfer.files as Iterable<File>).filter((f: File) => f.type.startsWith('image/'));
    if (files.length > 0) {
      const dashboardItemName = selectedDashboardList.name;

      try {
        const newAttachments: ClientAttachment[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const serverUrl = await uploadFile(file, i + 1);
          const shortId = Math.random().toString(36).substring(2, 8);
          const name = `${dashboardItemName}-${shortId}`;

          const att = await createAttachment({
            listId: selectedDashboardList.id,
            name,
            imageUrl: serverUrl,
            isUploaded: true
          });

          await addHistoryEntry({
            attachmentId: att.id,
            imageUrl: serverUrl,
            isUploaded: true
          });

          newAttachments.push(att);
        }

        setAttachments(prev => [...newAttachments, ...prev]);
      } catch (err) {
        logger.error('ATTACHMENTS', 'Failed to upload attachments', err);
      }
    }
  };

  const handleDropOnSingleAttachment = async (e: React.DragEvent, attachmentId: string) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files as Iterable<File>).filter((f: File) => f.type.startsWith('image/'));
    if (files.length > 0) {
      try {
        const file = files[0];
        const serverUrl = await uploadFile(file);

        const histEntry = await addHistoryEntry({
          attachmentId,
          imageUrl: serverUrl,
          isUploaded: true
        });

        setAttachments(prev => prev.map(item => {
          if (item.id === attachmentId) {
            const currentHistory = item.history || [];
            return {
              ...item,
              url: serverUrl,
              prompt: '',
              isUploaded: true,
              activeHistoryId: histEntry.id,
              history: [histEntry as unknown as typeof currentHistory[0], ...currentHistory]
            };
          }
          return item;
        }));

        if (selectedAttachment?.id === attachmentId) {
          const currentHistory = selectedAttachment.history || [];
          setSelectedAttachment({
            ...selectedAttachment,
            url: serverUrl,
            prompt: '',
            isUploaded: true,
            activeHistoryId: histEntry.id,
            history: [histEntry as unknown as typeof currentHistory[0], ...currentHistory]
          });
        }
      } catch (err) {
        logger.error('ATTACHMENTS', 'Failed to update single attachment', err);
      }
    }
  };

  const processUploadedFiles = async (files: File[]) => {
    if (!selectedAttachment || files.length === 0) return;

    try {
      const uploadedHistoryItems: ClientAttachmentHistory[] = [];
      let lastServerUrl = selectedAttachment.url;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const serverUrl = await uploadFile(file, i + 1);
        lastServerUrl = serverUrl;

        const histEntry = await addHistoryEntry({
          attachmentId: selectedAttachment.id,
          imageUrl: serverUrl,
          isUploaded: true
        });
        uploadedHistoryItems.push(histEntry);
      }

      const reversedNewHist = [...uploadedHistoryItems].reverse();

      setAttachments(prev => prev.map(item => {
        if (item.id === selectedAttachment.id) {
          const currentHistory = item.history || [];
          return {
            ...item,
            url: lastServerUrl,
            prompt: '',
            isUploaded: true,
            activeHistoryId: uploadedHistoryItems[uploadedHistoryItems.length - 1].id,
            referenceUrl: undefined,
            referenceUrls: undefined,
            history: [...reversedNewHist, ...currentHistory]
          };
        }
        return item;
      }));

      const currentHistory = selectedAttachment.history || [];
      setSelectedAttachment({
        ...selectedAttachment,
        url: lastServerUrl,
        prompt: '',
        isUploaded: true,
        activeHistoryId: uploadedHistoryItems[uploadedHistoryItems.length - 1].id,
        referenceUrl: undefined,
        referenceUrls: undefined,
        history: [...(reversedNewHist as unknown as typeof currentHistory), ...currentHistory]
      });
    } catch (err) {
      logger.error('DETAIL', 'Failed to process uploaded files in detail modal', err);
    }
  };

  const handleDropOnDetailForm = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingOnDetail(false);
    const files = Array.from(e.dataTransfer.files as Iterable<File>).filter((f: File) => f.type.startsWith('image/'));
    processUploadedFiles(files);
  };

  const handleFileChangeInDetail = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = (Array.from(e.target.files) as File[]).filter((f: File) => f.type.startsWith('image/'));
      processUploadedFiles(files);
    }
  };

  // Detail Modal Image Generation with DB persistence
  const handleGenerateImageInDetail = async (promptText: string) => {
    if (!promptText.trim() || !selectedAttachment) return;
    if (!openRouterKey.trim()) {
      alert('Пожалуйста, введите OpenRouter API Key в настройках.');
      return;
    }

    setIsGeneratingDetail(true);

    try {
      await logger.measure('OPENROUTER_API', `Detail Modal Image Generation (${promptText.substring(0, 40)}...)`, async () => {
        const res = await fetch('/party-prompts/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptText,
            referenceUrls: selectedReferences.map(r => typeof r === 'string' ? r : r.url),
          })
        });
        
        const data = await res.json();
        let imageUrl = null;
        
        if (res.ok) {
          const message = data.choices?.[0]?.message;
          const content = message?.content || '';
          const images = message?.images;
          if (images && images.length > 0 && images[0].image_url?.url) {
            imageUrl = images[0].image_url.url;
          } else if (content) {
            const match = content.match(/!\[.*?\]\((.*?)\)/);
            if (match) imageUrl = match[1];
            else if (content.startsWith('http')) imageUrl = content.trim();
          }
        }

        if (!imageUrl) {
          alert('Не удалось сгенерировать картинку.');
          return;
        }

        const refUrl = selectedReferences[0]?.url || undefined;
        const refUrlsStr = selectedReferences.length > 0 ? JSON.stringify(selectedReferences.map(r => r.url)) : undefined;

        const histEntry = await addHistoryEntry({
          attachmentId: selectedAttachment.id,
          imageUrl: imageUrl,
          prompt: promptText,
          isUploaded: false,
          referenceUrl: refUrl,
          referenceUrls: refUrlsStr
        });

        const newHistoryItem = {
          id: histEntry.id,
          url: imageUrl,
          prompt: promptText,
          timestamp: histEntry.timestamp,
          referenceUrl: refUrl,
          referenceUrls: selectedReferences.length > 0 ? selectedReferences.map(r => r.url) : undefined,
          isUploaded: false
        };

        setAttachments(prev => prev.map(item => {
          if (item.id === selectedAttachment.id) {
            const currentHistory = item.history || [];
            return {
              ...item,
              url: imageUrl!,
              prompt: promptText,
              isUploaded: false,
              activeHistoryId: newHistoryItem.id,
              referenceUrl: refUrl,
              referenceUrls: selectedReferences.length > 0 ? selectedReferences.map(r => r.url) : undefined,
              history: [newHistoryItem, ...currentHistory]
            };
          }
          return item;
        }));

        const currentHistory = selectedAttachment.history || [];
        setSelectedAttachment({
          ...selectedAttachment,
          url: imageUrl,
          prompt: promptText,
          isUploaded: false,
          activeHistoryId: newHistoryItem.id,
          referenceUrl: refUrl,
          referenceUrls: selectedReferences.length > 0 ? selectedReferences.map(r => r.url) : undefined,
          history: [newHistoryItem, ...currentHistory]
        });
        setDetailGenPrompt('');
      });
    } catch (err) {
      logger.error('OPENROUTER_API', 'Error during image generation', err);
    } finally {
      setIsGeneratingDetail(false);
    }
  };

  const handleSortLists = (newList: typeof dashboardItems) => {
    logger.info('DASHBOARD', `Reordered dashboard lists (Count: ${newList.length})`, newList.map(l => l.name));
    setDashboardItems(newList);
    reorderLists(newList.map(l => l.id));
  };

  const handleSortAttachments = (newList: typeof attachments) => {
    logger.info('ATTACHMENTS', `Reordered attachments in list (Count: ${newList.length})`, newList.map(a => a.name));
    setAttachments(newList);
    reorderAttachments(newList.map(a => a.id));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 shrink-0 relative h-12">
        <button onClick={() => setIsMenuOpen(true)} className="flex items-center justify-center p-2 text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg hover:bg-neutral-900/50 relative z-10">
          <Menu size={28} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none w-full text-center">
          {currentView === 'dashboard' ? (
            <h1 className="text-2xl font-medium tracking-tight">Дашборд</h1>
          ) : (
            <h1 className="text-xl font-medium tracking-tight text-neutral-200">mindra prompts party</h1>
          )}
        </div>
      </header>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed left-0 top-0 bottom-0 w-72 bg-neutral-900 border-r border-neutral-800 z-50 flex flex-col shadow-2xl">
              <div className="p-6 border-b border-neutral-800 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-medium tracking-tight">Меню</h2>
                <button onClick={() => setIsMenuOpen(false)} className="text-neutral-400 hover:text-neutral-200 transition-colors"><X size={20} /></button>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <button onClick={() => { setCurrentView('dashboard'); setIsMenuOpen(false); router.push('/party-prompts/dashboard'); }} className={`flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${currentView === 'dashboard' ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-neutral-800 text-neutral-200'}`}>
                  <LayoutDashboard size={18} /><span className="font-medium">Дашборд</span>
                </button>
                {currentView === 'dashboard' && (
                  <button onClick={() => { setCurrentView('main'); setIsMenuOpen(false); router.push('/party-prompts'); }} className="flex items-center gap-3 p-3 rounded-xl transition-colors text-left hover:bg-neutral-800 text-neutral-200">
                    <ImageIcon size={18} /><span className="font-medium">Генерация</span>
                  </button>
                )}
                <button onClick={() => { setIsMenuOpen(false); setIsSettingsOpen(true); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 text-neutral-200 transition-colors text-left">
                  <Settings size={18} /><span className="font-medium">Настройки</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 z-50 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium tracking-tight">Настройки</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-neutral-400 hover:text-neutral-200 transition-colors"><X size={20} /></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400 block">Время таймера (сек)</label>
                  <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3">
                    <input 
                      type="number" 
                      min="1" 
                      value={timerDuration} 
                      onChange={(e) => { 
                        const val = parseInt(e.target.value); 
                        const newDur = isNaN(val) ? 0 : val;
                        setTimerDuration(newDur);
                        updateSettings({ timerDuration: newDur });
                      }} 
                      className="bg-transparent border-none outline-none text-sm text-neutral-200 w-full" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400 block">OpenRouter API Key</label>
                  <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3">
                    <Key size={16} className="text-neutral-500 shrink-0" />
                    <input 
                      type="password" 
                      placeholder="sk-or-v1-..." 
                      value={openRouterKey} 
                      onChange={(e) => {
                        setOpenRouterKey(e.target.value);
                        updateSettings({ openRouterKey: e.target.value });
                      }} 
                      className="bg-transparent border-none outline-none text-sm text-neutral-200 placeholder:text-neutral-600 w-full" 
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-neutral-400">Hide text prompt</label>
                  <button 
                    onClick={() => { 
                      const newValue = !hideTextPrompt; 
                      setHideTextPrompt(newValue); 
                      if (newValue) setAutoSendTranscription(true);
                      updateSettings({ hideTextPrompt: newValue, autoSendTranscription: newValue ? true : autoSendTranscription });
                    }} 
                    className={`relative w-11 h-6 rounded-full transition-colors ${hideTextPrompt ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${hideTextPrompt ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-neutral-400">Авто-отправка после таймера</label>
                  <button 
                    onClick={() => {
                      if (!hideTextPrompt) {
                        const newValue = !autoSendTranscription;
                        setAutoSendTranscription(newValue);
                        updateSettings({ autoSendTranscription: newValue });
                      }
                    }} 
                    disabled={hideTextPrompt} 
                    className={`relative w-11 h-6 rounded-full transition-colors ${autoSendTranscription ? 'bg-indigo-600' : 'bg-neutral-800'} ${hideTextPrompt ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoSendTranscription ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Attachments Modal */}
      <AnimatePresence>
        {isAttachmentsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAttachmentsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl z-50 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-neutral-800 shrink-0">
                <h2 className="text-xl font-medium tracking-tight">Вложения</h2>
                <button onClick={() => setIsAttachmentsOpen(false)} className="text-neutral-400 hover:text-neutral-200 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6" onDragOver={handleDragOver} onDrop={handleDropOnAttachments}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div onClick={handleAddAttachment} className="flex flex-col items-center justify-center gap-2 bg-neutral-950/50 border-2 border-dashed border-neutral-800 rounded-xl cursor-pointer hover:border-neutral-600 hover:bg-neutral-900 transition-all min-h-[150px] h-full">
                    <Plus className="w-8 h-8 text-neutral-600" />
                    <span className="font-medium text-neutral-500">add item</span>
                  </div>
                  <ReactSortable list={attachments} setList={handleSortAttachments} animation={200} className="contents">
                    {attachments.map((item, index) => (
                      <div key={item.id} onClick={() => setSelectedAttachment(item)} onDragOver={handleDragOver} onDrop={(e) => handleDropOnSingleAttachment(e, item.id)} className="flex flex-col overflow-hidden bg-neutral-950 border border-neutral-800 rounded-xl cursor-grab active:cursor-grabbing hover:border-neutral-700 transition-colors group h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-neutral-800 bg-neutral-900 shrink-0">
                          <GripVertical className="w-4 h-4 text-neutral-500 shrink-0 group-hover:text-neutral-300 transition-colors" />
                          <span className="flex items-center justify-center bg-neutral-800 text-neutral-400 text-[10px] font-bold rounded w-5 h-5 shrink-0">{index + 1}</span>
                          <span className="text-xs font-medium text-neutral-200 truncate" title={item.prompt || item.name}>{item.prompt && item.prompt.trim() !== '' ? `prompt: ${item.prompt}` : item.name}</span>
                        </div>
                        <div className="relative aspect-[4/3] w-full bg-neutral-900 flex items-center justify-center">
                          {item.url ? (<img src={item.url} alt={item.prompt || item.name} className="absolute inset-0 w-full h-full object-cover" />) : (<span className="text-xs text-neutral-500 font-mono px-3 text-center truncate w-full">{item.name}</span>)}
                        </div>
                      </div>
                    ))}
                  </ReactSortable>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Choose List Modal */}
      <AnimatePresence>
        {isChooseListOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsChooseListOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl z-50 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-neutral-800 shrink-0">
                <h2 className="text-xl font-medium tracking-tight">Choose List</h2>
                <button onClick={() => setIsChooseListOpen(false)} className="text-neutral-400 hover:text-neutral-200 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {dashboardItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-neutral-500 font-medium">empty</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardItems.map(item => (
                      <div key={item.id} onClick={() => { setSelectedDashboardList(item); setIsChooseListOpen(false); }} className="flex flex-col gap-3 p-4 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-2xl min-h-[200px] cursor-pointer transition-colors">
                        <span className="font-medium text-neutral-200">{item.name}</span>
                        {item.items && item.items.length > 0 ? (<DashboardCarousel items={item.items} />) : (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/50"><span className="text-sm font-medium text-neutral-500">add new images</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Selected Attachment Detail Modal */}
      <AnimatePresence>
        {selectedAttachment && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedAttachment(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
            <div className="fixed inset-0 z-[70] overflow-y-auto flex items-start justify-center p-4 sm:p-6 md:p-10" onClick={() => setSelectedAttachment(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col my-auto overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-neutral-800 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-xl font-medium tracking-tight">Детали элемента</h2>
                    {selectedAttachment.name && (<span className="text-[11px] font-mono text-neutral-500">{selectedAttachment.name}</span>)}
                  </div>
                  <button onClick={() => setSelectedAttachment(null)} className="text-neutral-400 hover:text-neutral-200 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 flex flex-col gap-6 relative select-none" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOnDetail(true); }} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOnDetail(false); }} onDrop={handleDropOnDetailForm}>
                  <AnimatePresence>
                    {isDraggingOnDetail && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-900/90 border-4 border-dashed border-indigo-500/50 rounded-2xl m-6 backdrop-blur-sm gap-2">
                        <Plus className="w-12 h-12 text-indigo-400 animate-bounce" />
                        <span className="font-semibold text-lg text-neutral-200">Перетащите файлы сюда</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {(() => {
                    const histList = selectedAttachment.history || (selectedAttachment.url ? [{ id: `hist-init-${selectedAttachment.id}`, url: selectedAttachment.url, prompt: selectedAttachment.prompt, timestamp: selectedAttachment.timestamp || (Date.now() - 1000), isUploaded: selectedAttachment.isUploaded }] : []);
                    const activeItem = histList.find(h => h.url === selectedAttachment.url);
                    if (!activeItem) return null;
                    return (<div className="text-[11px] text-neutral-500 font-mono -mb-4 select-text">{formatTimestamp(activeItem.timestamp)}</div>);
                  })()}

                  {selectedAttachment.prompt && selectedAttachment.prompt.trim() !== '' && !selectedAttachment.isUploaded && (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span className="text-sm font-medium text-neutral-400">Промпт</span>
                          <p className="text-neutral-200 break-words">{selectedAttachment.prompt}</p>
                        </div>
                        {(selectedAttachment.referenceUrl || (selectedAttachment.referenceUrls && selectedAttachment.referenceUrls.length > 0)) && (
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <span className="text-[10px] font-medium text-neutral-500">Референс</span>
                            <div className="flex gap-1">
                              {selectedAttachment.referenceUrls && selectedAttachment.referenceUrls.length > 0 ? (
                                selectedAttachment.referenceUrls.map((url, idx) => (
                                  <div key={idx} className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 relative"><img src={url} alt={`ref ${idx}`} className="w-full h-full object-cover" /></div>
                                ))
                              ) : (
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 relative"><img src={selectedAttachment.referenceUrl} alt="ref" className="w-full h-full object-cover" /></div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedAttachment.url ? (
                    <div className="relative w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex items-center justify-center min-h-[200px] p-2">
                      <img src={selectedAttachment.url} alt={selectedAttachment.prompt || "attachment"} className="max-w-full max-h-[500px] object-contain rounded-xl" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div onClick={() => detailUploadInputRef.current?.click()} className="relative w-full rounded-2xl overflow-hidden bg-neutral-950 hover:bg-neutral-900 border-2 border-dashed border-neutral-800 hover:border-indigo-500/50 flex flex-col items-center justify-center min-h-[220px] p-6 cursor-pointer group transition-all">
                      <Paperclip className="w-8 h-8 text-neutral-500 group-hover:text-indigo-400 transition-colors mb-1" />
                      <span className="font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors text-sm">click to add image</span>
                      <input type="file" accept="image/*" ref={detailUploadInputRef} className="hidden" onChange={handleFileChangeInDetail} />
                    </div>
                  )}

                  {/* History */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-400">История загрузок</span>
                      <button onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-2.5 py-1.5 rounded-lg">
                        <Plus className="w-3.5 h-3.5" /> Загрузить еще
                      </button>
                      <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChangeInDetail} />
                    </div>
                    {(() => {
                      const histList = selectedAttachment.history || (selectedAttachment.url ? [{ id: `hist-init-${selectedAttachment.id}`, url: selectedAttachment.url, prompt: selectedAttachment.prompt, timestamp: Date.now() - 1000, isUploaded: selectedAttachment.isUploaded }] : []);
                      if (histList.length === 0) return null;
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {histList.map((histItem) => {
                            const isActive = selectedAttachment.activeHistoryId ? selectedAttachment.activeHistoryId === histItem.id : selectedAttachment.url === histItem.url;
                            return (
                              <div key={histItem.id} onClick={async () => {
                                const refUrlsStr = histItem.referenceUrls ? JSON.stringify(histItem.referenceUrls) : undefined;
                                setAttachments(prev => prev.map(item => item.id === selectedAttachment.id ? { ...item, url: histItem.url, prompt: histItem.prompt, isUploaded: histItem.isUploaded, activeHistoryId: histItem.id, referenceUrl: histItem.referenceUrl, referenceUrls: histItem.referenceUrls } : item));
                                setSelectedAttachment({ ...selectedAttachment, url: histItem.url, prompt: histItem.prompt, isUploaded: histItem.isUploaded, activeHistoryId: histItem.id, referenceUrl: histItem.referenceUrl, referenceUrls: histItem.referenceUrls });
                                try {
                                  await updateAttachment(selectedAttachment.id, {
                                    imageUrl: histItem.url,
                                    prompt: histItem.prompt,
                                    isUploaded: histItem.isUploaded,
                                    referenceUrl: histItem.referenceUrl,
                                    referenceUrls: refUrlsStr
                                  });
                                } catch (err) {
                                  logger.error('ATTACHMENTS', 'Failed to save active history item choice to DB', err);
                                }
                              }} className={`group/hist relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border transition-all ${isActive ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-neutral-800 hover:border-neutral-700'}`}>
                                <img src={histItem.url} alt={histItem.prompt || "history item"} className="absolute inset-0 w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/hist:opacity-100 transition-opacity flex items-center justify-center">
                                  {histItem.prompt && histItem.prompt.trim() !== '' ? (<span className="text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[90%]">{histItem.prompt}</span>) : null}
                                </div>
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  const isSelected = selectedReferences.some(r => r.id === histItem.id);
                                  if (isSelected) { setSelectedReferences(prev => prev.filter(r => r.id !== histItem.id)); }
                                  else {
                                    const newRef = { id: histItem.id, url: histItem.url };
                                    if (selectedReferences.length >= 2) { setSelectedReferences(prev => [...prev.slice(1), newRef]); }
                                    else { setSelectedReferences(prev => [...prev, newRef]); }
                                  }
                                }} className="absolute top-1 right-1 z-20 p-1 transition-all" title="Использовать как референс">
                                  <Star className={`w-4 h-4 transition-colors ${selectedReferences.some(r => r.id === histItem.id) ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-yellow-400 hover:text-yellow-300'}`} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Generation Input */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800 shrink-0">
                    <div className="relative w-full">
                      {selectedReferences.length > 0 && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex gap-1 items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 z-10">
                          {selectedReferences.map((ref) => (
                            <div key={ref.id} className="relative w-7 h-7 rounded overflow-hidden group/ref-thumb">
                              <img src={ref.url} alt="ref" className="w-full h-full object-cover" />
                              <button onClick={() => setSelectedReferences(prev => prev.filter(r => r.id !== ref.id))} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/ref-thumb:opacity-100 transition-opacity" title="Убрать"><X className="w-3 h-3 text-white" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input type="text" className={`w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 ${selectedReferences.length > 0 ? (selectedReferences.length === 1 ? 'pl-16' : 'pl-28') : 'pl-4'} pr-12 text-sm outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-neutral-200`} placeholder="Опишите желаемую картинку для генерации..." value={detailGenPrompt} onChange={e => setDetailGenPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !isGeneratingDetail && detailGenPrompt.trim()) handleGenerateImageInDetail(detailGenPrompt); }} disabled={isGeneratingDetail} />
                      <button onClick={() => handleGenerateImageInDetail(detailGenPrompt)} disabled={isGeneratingDetail || !detailGenPrompt.trim()} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-neutral-200 text-neutral-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center">
                        {isGeneratingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Views */}
      {currentView === 'dashboard' ? (
        <main className="flex-1 flex flex-col">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div onClick={handleAddNewList} onDragOver={handleDragOver} onDrop={handleDropOnAddNew} className="flex flex-col items-center justify-center gap-2 p-4 bg-neutral-900/50 hover:bg-neutral-800 transition-colors cursor-pointer border-2 border-dashed border-neutral-800 rounded-2xl min-h-[200px]">
              <Plus className="w-8 h-8 text-neutral-500" />
              <span className="font-medium text-neutral-400">add new</span>
            </div>
            <ReactSortable list={dashboardItems} setList={handleSortLists} animation={200} disabled={false} className="contents">
              {dashboardItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    logger.info('DASHBOARD', `Opened list attachments modal: "${item.name}"`, { id: item.id, name: item.name });
                    setSelectedDashboardList(item);
                    setIsAttachmentsOpen(true);
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('selectedDashboardListId', item.id);
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnItem(e, item.id)}
                  className="flex flex-col gap-3 p-4 bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-800 rounded-2xl h-full min-h-[200px]"
                >
                  <span className="font-medium text-neutral-200">{item.name}</span>
                  {item.items && item.items.length > 0 ? (<DashboardCarousel items={item.items} />) : (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-950/50"><span className="text-sm font-medium text-neutral-500">add new images</span></div>
                  )}
                </div>
              ))}
            </ReactSortable>
          </div>
        </main>
      ) : (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Image Gen */}
          <section className="flex flex-col bg-neutral-900/40 rounded-3xl border border-neutral-800 p-6 gap-4 h-full min-h-[500px]">
            <button onClick={() => setIsChooseListOpen(true)} className="flex items-center justify-center gap-2 w-full p-3 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-xl transition-colors font-medium text-neutral-200">
              <List className="w-5 h-5" />
            </button>
            <div className="flex-1 mt-2 w-full flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden relative min-h-[200px]">
              {selectedDashboardList && selectedDashboardList.items.length > 0 ? (
                <div className="w-full h-full flex flex-col flex-1 items-center justify-center p-0"><DashboardCarousel items={selectedDashboardList.items} variant="contain" isTimerRunning={isTimerRunning} enableBlur={true} /></div>
              ) : image1 ? (
                <img src={image1} alt="Generated 1" className="w-full h-auto max-h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="text-neutral-600 flex flex-col items-center gap-2"><ImageIcon className="w-8 h-8 opacity-40" /></div>
              )}
              <AnimatePresence>
                {isGenerating1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 flex flex-col items-center justify-center gap-4 ${image1 ? 'bg-neutral-950/80 backdrop-blur-sm' : 'text-neutral-500'}`}>
                    <Loader2 className={`w-8 h-8 animate-spin ${image1 ? 'text-indigo-400' : 'text-indigo-500'}`} />
                    <span className={`text-sm ${image1 ? 'text-neutral-300' : ''}`}>Рисуем магию...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Column 2: Timer */}
          <section className="flex flex-col items-center justify-center bg-neutral-900/40 rounded-3xl border border-neutral-800 p-6 h-full min-h-[500px]">
            {!isTimerVisible ? (
              <button onClick={startTimer} className="flex items-center justify-center w-24 h-24 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)]">
                <Play className="w-10 h-10 ml-2" fill="currentColor" />
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-12 w-full h-full">
                <div className="relative flex items-center justify-center">
                  <motion.svg className="absolute w-64 h-64 rotate-[-90deg]">
                    <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-neutral-800" />
                    <motion.circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-indigo-500" initial={{ strokeDasharray: "753.98", strokeDashoffset: "0" }} animate={{ strokeDashoffset: `${753.98 - (timeLeft / timerDuration) * 753.98}` }} transition={{ duration: 1, ease: "linear" }} strokeLinecap="round" />
                  </motion.svg>
                  <span className="text-7xl font-mono tracking-tighter tabular-nums z-10 text-neutral-100">{String(timeLeft).padStart(2, '0')}</span>
                </div>
              </div>
            )}
          </section>

          {/* Column 3: Audio + Image Gen */}
          <section className="flex flex-col bg-neutral-900/40 rounded-3xl border border-neutral-800 p-6 gap-4 h-full min-h-[500px]">
            <div className="relative w-full">
              {hideTextPrompt ? (
                <VoiceVisualizer isActive={isRecording} />
              ) : (
                <>
                  <input type="text" className="w-full bg-neutral-950 border border-neutral-800 rounded-full py-3 pl-12 pr-12 text-sm outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-neutral-200" placeholder={isRecording ? "Запись идет..." : "Здесь появится распознанный текст..."} value={prompt2} onChange={e => setPrompt2(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerateImage(prompt2, 2)} />
                  <button onClick={toggleRecording} className={`absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'}`}>
                    {isRecording ? <Square className="w-4 h-4" fill="currentColor" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleGenerateImage(prompt2, 2)} disabled={isGenerating2 || !prompt2.trim()} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-neutral-200 text-neutral-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-all">
                    {isGenerating2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5" />}
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 mt-2 w-full flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden relative min-h-[200px]">
              {image2 ? (<img src={image2} alt="Generated 2" className="w-full h-auto max-h-full object-contain" referrerPolicy="no-referrer" />) : (
                <div className="text-neutral-600 flex flex-col items-center gap-2"><ImageIcon className="w-8 h-8 opacity-40" /><span className="text-sm text-center px-4">Результат генерации</span></div>
              )}
              <AnimatePresence>
                {isGenerating2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 flex flex-col items-center justify-center gap-4 ${image2 ? 'bg-neutral-950/80 backdrop-blur-sm' : 'text-neutral-500'}`}>
                    <Loader2 className={`w-8 h-8 animate-spin ${image2 ? 'text-indigo-400' : 'text-indigo-500'}`} />
                    <span className={`text-sm ${image2 ? 'text-neutral-300' : ''}`}>Создаем образ...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
