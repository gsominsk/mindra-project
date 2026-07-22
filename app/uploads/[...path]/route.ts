import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import {
  MIME_MAP,
  SERVE_ALLOWED_EXTENSIONS,
  resolveUploadPath,
} from "@/lib/uploads";

// Read from disk on every request: in `output: 'standalone'` the server does
// not watch public/ for new files, so newly uploaded files would 404 until
// restart unless we serve them dynamically here.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  const resolved = resolveUploadPath(segments);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const ext = path.extname(resolved.fullPath).toLowerCase();
  if (!SERVE_ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(resolved.fullPath);
  } catch {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 },
    );
  }

  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  // Buffer satisfies BodyInit at runtime, but @types/node's generic Buffer
  // type diverges from lib.dom's BodyInit — cast through unknown to satisfy TS.
  // Filenames are unique (timestamp + index/uuid) and never overwritten,
  // so immutable caching is safe.
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
