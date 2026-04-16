import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, eventType, blocks, igShortcode, igSourceType, igProfileName, createdAt, isPublished } = body;

        if (!title || !eventType || !blocks || !Array.isArray(blocks) || blocks.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: title, eventType, blocks" },
                { status: 400 }
            );
        }

        // Generate slug from title (simple version)
        // In production, check for uniqueness and append suffix if needed
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "") + "-" + Date.now().toString().slice(-4);

        const page = await prisma.eventPage.create({
            data: {
                title,
                eventType,
                slug,
                isPublished: isPublished ?? false,
                createdAt: createdAt ? new Date(createdAt) : undefined,
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

        return NextResponse.json(page);
    } catch (error: unknown) {
        console.error("Create page error:", error);
        return NextResponse.json(
            { error: "Failed to create page", details: (error as Error).message },
            { status: 500 }
        );
    }
}

