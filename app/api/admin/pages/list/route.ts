import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const pages = await prisma.eventPage.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                slug: true,
                createdAt: true,
                igSyncedAt: true,
                eventType: true,
                isPublished: true,
                blocks: {
                    select: {
                        mediaUrl: true,
                        text: true
                    }
                }
            }
        });

        return NextResponse.json(pages);
    } catch (error) {
        console.error("Failed to fetch pages:", error);
        return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
    }
}
