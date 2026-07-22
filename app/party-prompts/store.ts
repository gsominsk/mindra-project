'use client';

import { create } from 'zustand';
import { initialAttachments, initialDashboardItems, Attachment, DashboardItem } from './fixtures';

interface AppState {
  openRouterKey: string;
  setOpenRouterKey: (key: string) => void;
  
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  
  currentView: 'main' | 'dashboard';
  setCurrentView: (view: 'main' | 'dashboard') => void;
  
  autoSendTranscription: boolean;
  setAutoSendTranscription: (auto: boolean) => void;
  
  hideTextPrompt: boolean;
  setHideTextPrompt: (hide: boolean) => void;
  
  dashboardItems: DashboardItem[];
  setDashboardItems: (items: DashboardItem[]) => void;
  
  prompt1: string;
  setPrompt1: (prompt: string) => void;
  
  isGenerating1: boolean;
  setIsGenerating1: (generating: boolean) => void;
  
  image1: string | null;
  setImage1: (image: string | null) => void;
  
  isAttachmentsOpen: boolean;
  setIsAttachmentsOpen: (open: boolean) => void;
  
  isChooseListOpen: boolean;
  setIsChooseListOpen: (open: boolean) => void;
  
  attachments: Attachment[];
  setAttachments: (items: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void;
  
  selectedAttachment: Attachment | null;
  setSelectedAttachment: (item: Attachment | null) => void;
  
  selectedDashboardList: DashboardItem | null;
  setSelectedDashboardList: (item: DashboardItem | null) => void;
  
  timerDuration: number;
  setTimerDuration: (duration: number) => void;
  
  timeLeft: number;
  setTimeLeft: (remaining: number | ((prev: number) => number)) => void;
  
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  
  isTimerVisible: boolean;
  setIsTimerVisible: (visible: boolean) => void;
  
  prompt2: string;
  setPrompt2: (prompt: string | ((prev: string) => string)) => void;
  
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  
  isTranscribing: boolean;
  setIsTranscribing: (transcribing: boolean) => void;
  
  isGenerating2: boolean;
  setIsGenerating2: (generating: boolean) => void;
  
  image2: string | null;
  setImage2: (image: string | null) => void;
  
  hasStartedGeneration: boolean;
  setHasStartedGeneration: (started: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // SSR-safe: no sessionStorage at init, hydrate on client
  openRouterKey: '',
  setOpenRouterKey: (key) => {
    if (typeof window !== 'undefined') sessionStorage.setItem('openRouterKey', key);
    set({ openRouterKey: key });
  },
  
  isSettingsOpen: false,
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  
  isMenuOpen: false,
  setIsMenuOpen: (open) => set({ isMenuOpen: open }),
  
  currentView: 'main',
  setCurrentView: (view) => set({ currentView: view }),
  
  autoSendTranscription: false,
  setAutoSendTranscription: (auto) => set({ autoSendTranscription: auto }),
  
  hideTextPrompt: false,
  setHideTextPrompt: (hide) => set({ hideTextPrompt: hide }),
  
  dashboardItems: initialDashboardItems,
  setDashboardItems: (items) => set({ dashboardItems: items }),
  
  prompt1: '',
  setPrompt1: (prompt) => set({ prompt1: prompt }),
  
  isGenerating1: false,
  setIsGenerating1: (generating) => set({ isGenerating1: generating }),
  
  image1: null,
  setImage1: (image) => set({ image1: image }),
  
  isAttachmentsOpen: false,
  setIsAttachmentsOpen: (open) => set({ isAttachmentsOpen: open }),
  
  isChooseListOpen: false,
  setIsChooseListOpen: (open) => set({ isChooseListOpen: open }),
  
  attachments: initialAttachments,
  setAttachments: (updater) => set((state) => {
    const nextAttachments = typeof updater === 'function' ? updater(state.attachments) : updater;
    
    let nextSelectedDashboardList = state.selectedDashboardList;
    if (nextSelectedDashboardList) {
      nextSelectedDashboardList = {
        ...nextSelectedDashboardList,
        attachments: nextAttachments,
        items: nextAttachments
          .filter(att => att.url && att.url !== '')
          .map(att => ({ url: att.url, prompt: att.prompt }))
      };
    }
    
    const nextDashboardItems = state.dashboardItems.map((item) => {
      if (nextSelectedDashboardList && item.id === nextSelectedDashboardList.id) {
        return nextSelectedDashboardList;
      }
      return item;
    });
    
    return {
      attachments: nextAttachments,
      selectedDashboardList: nextSelectedDashboardList,
      dashboardItems: nextDashboardItems
    };
  }),
  
  selectedAttachment: null,
  setSelectedAttachment: (item) => set({ selectedAttachment: item }),
  
  selectedDashboardList: null,
  setSelectedDashboardList: (item) => {
    if (typeof window !== 'undefined') {
      if (item) {
        sessionStorage.setItem('selectedDashboardListId', item.id);
      } else {
        sessionStorage.removeItem('selectedDashboardListId');
      }
    }
    set({ 
      selectedDashboardList: item,
      attachments: item ? (item.attachments || []) : []
    });
  },
  
  timerDuration: 5,
  setTimerDuration: (duration) => set({ timerDuration: duration }),
  
  timeLeft: 5,
  setTimeLeft: (updater) => set((state) => ({ 
    timeLeft: typeof updater === 'function' ? updater(state.timeLeft) : updater 
  })),
  
  isTimerRunning: false,
  setIsTimerRunning: (running) => set({ isTimerRunning: running }),
  
  isTimerVisible: false,
  setIsTimerVisible: (visible) => set({ isTimerVisible: visible }),
  
  prompt2: '',
  setPrompt2: (updater) => set((state) => ({ 
    prompt2: typeof updater === 'function' ? updater(state.prompt2) : updater 
  })),
  
  isRecording: false,
  setIsRecording: (recording) => set({ isRecording: recording }),
  
  isTranscribing: false,
  setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
  
  isGenerating2: false,
  setIsGenerating2: (generating) => set({ isGenerating2: generating }),
  
  image2: null,
  setImage2: (image) => set({ image2: image }),
  
  hasStartedGeneration: false,
  setHasStartedGeneration: (started) => set({ hasStartedGeneration: started })
}));

// Client-side hydration from sessionStorage
if (typeof window !== 'undefined') {
  const savedKey = sessionStorage.getItem('openRouterKey');
  if (savedKey) {
    useAppStore.setState({ openRouterKey: savedKey });
  }
}
