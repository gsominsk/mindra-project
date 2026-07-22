import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { checkAndCleanupUploadQuota } from "@/lib/quota_cleanup";
import { appendServerLog } from "@/lib/logger_server";

const ALLOWED_EXTENSIONS = new Set([
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif"
]);

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/heic",
    "image/heic-sequence",
    "image/heif",
    "image/heif-sequence",
    "application/octet-stream" // Sometimes sent by iOS Safari for HEIC
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
    try {
        const adminSession = request.cookies.get("admin_session");
        if (!adminSession) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File size exceeds the 20MB limit" },
                { status: 400 }
            );
        }

        const ext = path.extname(file.name).toLowerCase();
        const mimeType = (file.type || "").toLowerCase();

        const isValidExt = ALLOWED_EXTENSIONS.has(ext);
        const isValidMime = mimeType.startsWith("image/") || ALLOWED_MIME_TYPES.has(mimeType);

        if (!isValidExt || !isValidMime) {
            return NextResponse.json(
                { error: "Invalid file format. Only image formats (JPG, PNG, WEBP, GIF, AVIF, HEIC, HEIF) are allowed." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const safeExt = ext || ".jpg";
        const filename = `${uuidv4()}${safeExt}`;
        const uploadDir = path.join(process.cwd(), "public/uploads/party-prompts");
        
        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });
        
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);

        appendServerLog({
            level: "success",
            namespace: "UPLOAD",
            msg: `File uploaded successfully: ${filename} (${(file.size / 1024).toFixed(1)} KB)`
        });

        // Trigger disk quota check asynchronously after upload
        checkAndCleanupUploadQuota().catch((err) => {
            console.error("Async quota cleanup error:", err);
        });

        return NextResponse.json({ url: `/uploads/party-prompts/${filename}` });
    } catch (error) {
        console.error("Upload error:", error);
        appendServerLog({
            level: "error",
            namespace: "UPLOAD",
            msg: "Upload request failed",
            data: error
        });
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
