import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { title, eventType, blocks, isPublished } = body;

        // Update page details
        // Note: We are deleting all blocks and recreating them for simplicity
        // A more optimized approach would be to diff and update
        const updatedPage = await prisma.$transaction(async (tx) => {
            // 1. Update page metadata
            const page = await tx.eventPage.update({
                where: { id },
                data: {
                    title,
                    eventType,
                    isPublished,
                    // Optionally update slug if title changed, but keeping it stable is usually better for SEO
                },
            });

            // 2. Delete existing blocks
            await tx.block.deleteMany({
                where: { pageId: id },
            });

            // 3. Create new blocks
            await tx.block.createMany({
                data: blocks.map((block: { layout: string; content: { text: string; textStyle: object; mediaUrl: string; mediaType: string } }, index: number) => ({
                    pageId: id,
                    order: index,
                    layout: block.layout,
                    text: block.content.text,
                    textStyle: JSON.stringify(block.content.textStyle),
                    mediaUrl: block.content.mediaUrl,
                    mediaType: block.content.mediaType,
                })),
            });

            return page;
        });

        return NextResponse.json(updatedPage);
    } catch (error: unknown) {
        console.error("Update page error:", error);
        return NextResponse.json(
            { error: "Failed to update page", details: (error as Error).message },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { eventType, isPublished } = body;

        const page = await prisma.eventPage.update({
            where: { id },
            data: { 
                ...(eventType !== undefined && { eventType }),
                ...(isPublished !== undefined && { isPublished })
            },
        });

        return NextResponse.json(page);
    } catch (error: unknown) {
        console.error("Patch page error:", error);
        return NextResponse.json(
            { error: "Failed to patch page", details: (error as Error).message },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const page = await prisma.eventPage.findUnique({
            where: { id },
            include: {
                blocks: {
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!page) {
            return NextResponse.json({ error: "Page not found" }, { status: 404 });
        }

        return NextResponse.json(page);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: "Failed to fetch page", details: (error as Error).message },
            { status: 500 }
        );
    }
}
