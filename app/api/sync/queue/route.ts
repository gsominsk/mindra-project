import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: fetch 1 pending job and lock it
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'fetch') {
      // Find a job
      const job = await prisma.rawInstagramPost.findFirst({
        where: {
          status: { in: ['PENDING', 'ERROR'] },
          nextRetryAt: { lte: new Date() },
          retryCount: { lt: 5 } // Max retries
        },
        orderBy: {
          nextRetryAt: 'asc'
        }
      });

      if (!job) {
        return NextResponse.json({ job: null });
      }

      // Lock it
      const lockedJob = await prisma.rawInstagramPost.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING'
        }
      });

      return NextResponse.json({ job: lockedJob });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Queue GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Add raw post to queue (Upsert)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shortcode, profileName, sourceType, rawCaption, mediaUrls, mediaTypes, createdAt } = body;

    const post = await prisma.rawInstagramPost.upsert({
      where: { shortcode },
      update: {
        rawCaption,
        mediaUrls: JSON.stringify(mediaUrls),
        mediaTypes: JSON.stringify(mediaTypes),
        status: 'PENDING',
        lastError: null,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {})
      },
      create: {
        shortcode,
        profileName,
        sourceType,
        rawCaption,
        mediaUrls: JSON.stringify(mediaUrls),
        mediaTypes: JSON.stringify(mediaTypes),
        status: 'PENDING',
        ...(createdAt ? { createdAt: new Date(createdAt) } : {})
      }
    });

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error('Queue POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH: Update job status (COMPLETED or ERROR)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, errorMessage } = body;

    if (status === 'COMPLETED') {
      const updated = await prisma.rawInstagramPost.update({
        where: { id },
        data: { status: 'COMPLETED' }
      });
      return NextResponse.json({ success: true, updated });
    }

    if (status === 'ERROR') {
      // Fetch current to increment retry count
      const current = await prisma.rawInstagramPost.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const retryCount = current.retryCount + 1;
      const nextRetryAt = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes

      const finalStatus = retryCount >= 5 ? 'FAILED' : 'ERROR';

      const updated = await prisma.rawInstagramPost.update({
        where: { id },
        data: {
          status: finalStatus,
          retryCount,
          lastError: errorMessage,
          nextRetryAt
        }
      });
      return NextResponse.json({ success: true, updated });
    }

    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  } catch (error) {
    console.error('Queue PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
