export const mockPrompts = [
  "Киберпанк город",
  "Щенок в парке",
  "Закат на море",
  "Космический корабль",
  "Винтажный автомобиль",
  "Абстрактные формы"
];

export const mockDashboardPrompts = [
  "Неоновый киберпанк город",
  "Милый щенок в парке",
  "Красивый закат на море",
  "Космический корабль летит",
  "Винтажный автомобиль",
  "Абстрактные формы 3D"
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
