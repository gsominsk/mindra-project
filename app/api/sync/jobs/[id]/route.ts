import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Internal sync endpoint — NOT protected by middleware.
 * Update sync job counters and status during pipeline execution.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const updateData: Record<string, unknown> = {};

        if (body.status) updateData.status = body.status;
        if (body.postsFound !== undefined) updateData.postsFound = body.postsFound;
        if (body.postsCreated !== undefined) updateData.postsCreated = body.postsCreated;
        if (body.postsSkipped !== undefined) updateData.postsSkipped = body.postsSkipped;
        if (body.errors !== undefined) updateData.errors = body.errors;
        if (body.errorLog !== undefined) updateData.errorLog = body.errorLog;

        if (body.status === "completed" || body.status === "failed") {
            updateData.finishedAt = new Date();
        }

        const job = await prisma.syncJob.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(job);
    } catch (error: unknown) {
        console.error("Update sync job error:", error);
        return NextResponse.json(
            { error: "Failed to update sync job", details: (error as Error).message },
            { status: 500 }
        );
    }
}
