import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Internal sync endpoint — NOT protected by middleware.
 * SyncJob tracking for audit/monitoring.
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mode } = body;

        if (!mode || !["initial", "daily"].includes(mode)) {
            return NextResponse.json(
                { error: "Invalid mode. Must be 'initial' or 'daily'" },
                { status: 400 }
            );
        }

        const job = await prisma.syncJob.create({
            data: { mode },
        });

        return NextResponse.json(job, { status: 201 });
    } catch (error: unknown) {
        console.error("Create sync job error:", error);
        return NextResponse.json(
            { error: "Failed to create sync job", details: (error as Error).message },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const jobs = await prisma.syncJob.findMany({
            orderBy: { startedAt: 'desc' },
            take: 20,
        });

        return NextResponse.json(jobs);
    } catch (error: unknown) {
        console.error("List sync jobs error:", error);
        return NextResponse.json(
            { error: "Failed to list sync jobs", details: (error as Error).message },
            { status: 500 }
        );
    }
}
