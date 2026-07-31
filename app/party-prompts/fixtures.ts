export const mockPrompts = [
  "Кіберпанк місто",
  "Цуценя в парку",
  "Захід на морі",
  "Космічний корабель",
  "Вінтажний автомобіль",
  "Абстрактні форми"
];

export const mockDashboardPrompts = [
  "Неоновий кіберпанк місто",
  "Миле цуценя в парку",
  "Гарний захід на морі",
  "Космічний корабель летить",
  "Вінтажний автомобіль",
  "Абстрактні форми 3D"
];

export interface AttachmentHistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  isUploaded?: boolean;
  referenceUrl?: string;
  referenceUrls?: string[];
}

export interface Attachment {
  id: string;
  name: string;
  prompt: string;
  url: string;
  activeHistoryId?: string;
  history?: AttachmentHistoryItem[];
  isUploaded?: boolean;
  referenceUrl?: string;
  referenceUrls?: string[];
  timestamp?: number;
}

export interface DashboardItem {
  id: string;
  name: string;
  items: { url: string; prompt: string }[];
  attachments?: Attachment[];
}

export const initialAttachments: Attachment[] = [];

export const initialDashboardItems: DashboardItem[] = [];
