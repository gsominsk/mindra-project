import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Internal sync endpoint — NOT protected by middleware.
 * Used by the ig-sync Docker sidecar to create event pages.
 * 
 * TODO: Security will be implemented separately as a dedicated concern.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, eventType, blocks, igShortcode, igSourceType, igProfileName } = body;

        if (!title || !eventType || !blocks || !Array.isArray(blocks) || blocks.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: title, eventType, blocks" },
                { status: 400 }
            );
        }

        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "") + "-" + Date.now().toString().slice(-4);

        const page = await prisma.eventPage.create({
            data: {
                title,
                eventType,
                slug,
                igShortcode: igShortcode || null,
                igSourceType: igSourceType || null,
                igProfileName: igProfileName || null,
                igSyncedAt: igShortcode ? new Date() : null,
                blocks: {
                    create: blocks.map((block: { layout: string; content: { text: string; textStyle: object; mediaUrl: string; mediaType: string } }, index: number) => ({
                        order: index,
                        layout: block.layout,
                        text: block.content.text,
                        textStyle: JSON.stringify(block.content.textStyle),
                        mediaUrl: block.content.mediaUrl,
                        mediaType: block.content.mediaType,
                    })),
                },
            },
        });

        return NextResponse.json(page, { status: 201 });
    } catch (error: unknown) {
        console.error("Sync create page error:", error);
        return NextResponse.json(
            { error: "Failed to create page", details: (error as Error).message },
            { status: 500 }
        );
    }
}
