'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { appendServerLog } from '@/lib/logger_server';

// =============================================
// Data mappers: Prisma → Client format
// =============================================

export type ClientAttachmentHistory = {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  isUploaded: boolean;
  referenceUrl?: string;
  referenceUrls?: string[];
};

export type ClientAttachment = {
  id: string;
  name: string;
  prompt: string;
  url: string;
  isUploaded: boolean;
  referenceUrl?: string;
  referenceUrls?: string[];
  timestamp: number;
  history: ClientAttachmentHistory[];
};

export type ClientDashboardItem = {
  id: string;
  name: string;
  items: { url: string; prompt: string }[];
  attachments: ClientAttachment[];
};

export type ClientSettings = {
  openRouterKey: string;
  timerDuration: number;
  autoSendTranscription: boolean;
  hideTextPrompt: boolean;
};

function mapAttachmentHistory(h: {
  id: string;
  imageUrl: string;
  prompt: string;
  isUploaded: boolean;
  referenceUrl: string | null;
  referenceUrls: string | null;
  createdAt: Date;
}): ClientAttachmentHistory {
  return {
    id: h.id,
    url: h.imageUrl,
    prompt: h.prompt,
    timestamp: h.createdAt.getTime(),
    isUploaded: h.isUploaded,
    referenceUrl: h.referenceUrl || undefined,
    referenceUrls: h.referenceUrls ? JSON.parse(h.referenceUrls) : undefined,
  };
}

function mapAttachment(a: {
  id: string;
  name: string;
  prompt: string;
  imageUrl: string | null;
  isUploaded: boolean;
  referenceUrl: string | null;
  referenceUrls: string | null;
  createdAt: Date;
  history: {
    id: string;
    imageUrl: string;
    prompt: string;
    isUploaded: boolean;
    referenceUrl: string | null;
    referenceUrls: string | null;
    createdAt: Date;
  }[];
}): ClientAttachment {
  return {
    id: a.id,
    name: a.name,
    prompt: a.prompt,
    url: a.imageUrl || '',
    isUploaded: a.isUploaded,
    referenceUrl: a.referenceUrl || undefined,
    referenceUrls: a.referenceUrls ? JSON.parse(a.referenceUrls) : undefined,
    timestamp: a.createdAt.getTime(),
    history: a.history.map(mapAttachmentHistory),
  };
}

function mapList(list: {
  id: string;
  name: string;
  attachments: {
    id: string;
    name: string;
    prompt: string;
    imageUrl: string | null;
    isUploaded: boolean;
    referenceUrl: string | null;
    referenceUrls: string | null;
    createdAt: Date;
    history: {
      id: string;
      imageUrl: string;
      prompt: string;
      isUploaded: boolean;
      referenceUrl: string | null;
      referenceUrls: string | null;
      createdAt: Date;
    }[];
  }[];
}): ClientDashboardItem {
  const attachments = list.attachments.map(mapAttachment);
  return {
    id: list.id,
    name: list.name,
    items: attachments
      .filter(a => a.url && a.url !== '')
      .map(a => ({ url: a.url, prompt: a.prompt })),
    attachments,
  };
}

// =============================================
// Settings
// =============================================

export async function getSettings(): Promise<ClientSettings> {
  try {
    const settings = await prisma.promptSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      openRouterKey: settings.openRouterKey,
      timerDuration: settings.timerDuration,
      autoSendTranscription: settings.autoSendTranscription,
      hideTextPrompt: settings.hideTextPrompt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    const stack = err instanceof Error ? err.stack : undefined;
    appendServerLog({
      level: 'error',
      namespace: 'SERVER_FETCH',
      msg: `Error in getSettings: ${message}`,
      data: { stack }
    });
    return {
      openRouterKey: '',
      timerDuration: 10,
      autoSendTranscription: true,
      hideTextPrompt: true,
    };
  }
}

export async function updateSettings(data: Partial<ClientSettings>) {
  appendServerLog({
    level: 'info',
    namespace: 'SERVER_ACTION',
    msg: 'Updating PromptSettings default...',
    data: Object.keys(data)
  });
  await prisma.promptSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  revalidatePath('/party-prompts');
}

// =============================================
// Lists
// =============================================

export async function getLists(): Promise<ClientDashboardItem[]> {
  try {
    const lists = await prisma.promptList.findMany({
      include: {
        attachments: {
          include: { history: { orderBy: { createdAt: 'desc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
    return lists.map(mapList);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    const stack = err instanceof Error ? err.stack : undefined;
    appendServerLog({
      level: 'error',
      namespace: 'SERVER_FETCH',
      msg: `Error in getLists: ${message}`,
      data: { stack }
    });
    return [];
  }
}

export async function createList(name: string): Promise<ClientDashboardItem> {
  const maxOrder = await prisma.promptList.aggregate({ _max: { order: true } });
  const list = await prisma.promptList.create({
    data: { name, order: (maxOrder._max.order ?? -1) + 1 },
    include: {
      attachments: {
        include: { history: { orderBy: { createdAt: 'desc' } } },
        orderBy: { order: 'asc' },
      },
    },
  });
  appendServerLog({
    level: 'success',
    namespace: 'SERVER_ACTION',
    msg: `Created PromptList: ${list.id} ("${list.name}")`,
    data: { id: list.id, name: list.name }
  });
  revalidatePath('/party-prompts');
  return mapList(list);
}

export async function deleteList(id: string) {
  appendServerLog({
    level: 'warn',
    namespace: 'SERVER_ACTION',
    msg: `Deleting PromptList: ${id}`,
    data: { id }
  });
  await prisma.promptList.delete({ where: { id } });
  revalidatePath('/party-prompts');
}

export async function reorderLists(ids: string[]) {
  appendServerLog({
    level: 'info',
    namespace: 'SERVER_ACTION',
    msg: `Reordering ${ids.length} PromptLists`,
    data: { idsCount: ids.length }
  });
  await prisma.$transaction(
    ids.map((id, index) => prisma.promptList.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath('/party-prompts');
}

// =============================================
// Attachments
// =============================================

export async function createAttachment(data: {
  listId: string;
  name: string;
  prompt?: string;
  imageUrl?: string;
  isUploaded?: boolean;
}): Promise<ClientAttachment> {
  const maxOrder = await prisma.promptAttachment.aggregate({
    where: { listId: data.listId },
    _max: { order: true },
  });
  const attachment = await prisma.promptAttachment.create({
    data: {
      listId: data.listId,
      name: data.name,
      prompt: data.prompt || '',
      imageUrl: data.imageUrl || null,
      isUploaded: data.isUploaded || false,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: { history: { orderBy: { createdAt: 'desc' } } },
  });
  appendServerLog({
    level: 'success',
    namespace: 'SERVER_ACTION',
    msg: `Created PromptAttachment: ${attachment.id} (List: ${data.listId})`,
    data: { id: attachment.id, name: attachment.name, listId: data.listId }
  });
  revalidatePath('/party-prompts');
  return mapAttachment(attachment);
}

export async function updateAttachment(id: string, data: {
  name?: string;
  prompt?: string;
  imageUrl?: string;
  isUploaded?: boolean;
  referenceUrl?: string;
  referenceUrls?: string;
}): Promise<ClientAttachment> {
  appendServerLog({
    level: 'info',
    namespace: 'SERVER_ACTION',
    msg: `Updating PromptAttachment: ${id}`,
    data: { id, updatedFields: Object.keys(data) }
  });
  const attachment = await prisma.promptAttachment.update({
    where: { id },
    data,
    include: { history: { orderBy: { createdAt: 'desc' } } },
  });
  revalidatePath('/party-prompts');
  return mapAttachment(attachment);
}

export async function deleteAttachment(id: string) {
  appendServerLog({
    level: 'warn',
    namespace: 'SERVER_ACTION',
    msg: `Deleting PromptAttachment: ${id}`,
    data: { id }
  });
  await prisma.promptAttachment.delete({ where: { id } });
  revalidatePath('/party-prompts');
}

export async function reorderAttachments(ids: string[]) {
  appendServerLog({
    level: 'info',
    namespace: 'SERVER_ACTION',
    msg: `Reordering ${ids.length} PromptAttachments`,
    data: { idsCount: ids.length }
  });
  await prisma.$transaction(
    ids.map((id, index) => prisma.promptAttachment.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath('/party-prompts');
}

// =============================================
// History
// =============================================

export async function addHistoryEntry(data: {
  attachmentId: string;
  imageUrl: string;
  prompt?: string;
  isUploaded?: boolean;
  referenceUrl?: string;
  referenceUrls?: string;
}): Promise<ClientAttachmentHistory> {
  appendServerLog({
    level: 'info',
    namespace: 'SERVER_ACTION',
    msg: `Adding PromptAttachmentHistory for Attachment: ${data.attachmentId}`,
    data: { attachmentId: data.attachmentId, imageUrl: data.imageUrl }
  });
  const entry = await prisma.promptAttachmentHistory.create({
    data: {
      attachmentId: data.attachmentId,
      imageUrl: data.imageUrl,
      prompt: data.prompt || '',
      isUploaded: data.isUploaded || false,
      referenceUrl: data.referenceUrl || null,
      referenceUrls: data.referenceUrls || null,
    },
  });

  // Also update the parent attachment's current image
  await prisma.promptAttachment.update({
    where: { id: data.attachmentId },
    data: {
      imageUrl: data.imageUrl,
      prompt: data.prompt || '',
      isUploaded: data.isUploaded || false,
      referenceUrl: data.referenceUrl || null,
      referenceUrls: data.referenceUrls || null,
    },
  });

  revalidatePath('/party-prompts');
  return mapAttachmentHistory(entry);
}
