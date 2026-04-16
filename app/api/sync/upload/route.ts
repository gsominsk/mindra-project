import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Internal sync endpoint — NOT protected by middleware.
 * File upload for the ig-sync sidecar. Same logic as /api/upload.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = path.extname(file.name) || ".bin";
        const filename = `${randomUUID()}${ext}`;

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        return NextResponse.json({ url: `/uploads/${filename}` });
    } catch (error: unknown) {
        console.error("Sync upload error:", error);
        return NextResponse.json(
            { error: "Upload failed", details: (error as Error).message },
            { status: 500 }
        );
    }
}
