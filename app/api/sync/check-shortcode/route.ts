import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Internal sync endpoint — NOT protected by middleware.
 * Idempotency check: does a page with this shortcode already exist?
 */
export async function GET(request: NextRequest) {
    try {
        const code = request.nextUrl.searchParams.get("code");

        if (!code) {
            return NextResponse.json(
                { error: "Missing 'code' query parameter" },
                { status: 400 }
            );
        }

        const page = await prisma.eventPage.findUnique({
            where: { igShortcode: code },
            select: { id: true, slug: true, title: true },
        });

        if (page) {
            return NextResponse.json({
                exists: true,
                id: page.id,
                slug: page.slug,
                title: page.title,
            });
        }

        return NextResponse.json({ exists: false });
    } catch (error: unknown) {
        console.error("Shortcode lookup error:", error);
        return NextResponse.json(
            { error: "Shortcode lookup failed", details: (error as Error).message },
            { status: 500 }
        );
    }
}
