import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendServerLog } from "@/lib/logger_server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const adminSession = request.cookies.get("admin_session");
        if (!adminSession) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, model, referenceUrls } = await request.json();

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // Fetch API Key safely on server
        const settings = await prisma.promptSettings.findUnique({
            where: { id: "default" },
        });

        const openRouterKey = settings?.openRouterKey;

        if (!openRouterKey || !openRouterKey.trim()) {
            appendServerLog({
                level: "warn",
                namespace: "OPENROUTER_API",
                msg: "Generation failed: OpenRouter API Key is not configured on server"
            });
            return NextResponse.json(
                { error: "OpenRouter API Key is not configured on server" },
                { status: 400 }
            );
        }

        const modelToUse = model || "x-ai/grok-imagine-image-quality";
        const contentParts: any[] = [{ type: "text", text: prompt }];
        const extractedUrls: string[] = [];

        if (Array.isArray(referenceUrls)) {
            referenceUrls.slice(0, 2).forEach((item: any) => {
                const rawUrl = typeof item === "string" ? item : item?.url;
                if (rawUrl && typeof rawUrl === "string" && rawUrl.trim()) {
                    let finalUrl = rawUrl.trim();

                    // Convert local /uploads/ images to Base64 Data URL so OpenRouter/xAI can access them
                    if (finalUrl.startsWith("/uploads/") || finalUrl.startsWith("uploads/")) {
                        try {
                            const relPath = finalUrl.startsWith("/") ? finalUrl.slice(1) : finalUrl;
                            const diskPath = path.join(process.cwd(), "public", relPath);
                            if (fs.existsSync(diskPath)) {
                                const fileBuffer = fs.readFileSync(diskPath);
                                const ext = path.extname(diskPath).toLowerCase();
                                const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
                                finalUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
                            }
                        } catch (e) {
                            console.error("Failed to convert local image to base64:", e);
                        }
                    }

                    extractedUrls.push(rawUrl);
                    contentParts.push({
                        type: "image_url",
                        image_url: { url: finalUrl },
                    });
                }
            });
        }

        appendServerLog({
            level: "info",
            namespace: "OPENROUTER_API",
            msg: `Proxying image generation request to OpenRouter (${modelToUse})`,
            data: { promptSnippet: prompt.substring(0, 50), referenceCount: extractedUrls.length, referenceUrls: extractedUrls }
        });

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterKey.trim()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: [{ role: "user", content: contentParts }],
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            appendServerLog({
                level: "error",
                namespace: "OPENROUTER_API",
                msg: `OpenRouter generation failed with HTTP ${response.status}`,
                data: errText
            });
            return NextResponse.json(
                { error: `OpenRouter generation failed: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        appendServerLog({
            level: "success",
            namespace: "OPENROUTER_API",
            msg: "Successfully generated image response from OpenRouter"
        });
        return NextResponse.json(data);
    } catch (error) {
        appendServerLog({
            level: "error",
            namespace: "OPENROUTER_API",
            msg: "Internal error during generation request",
            data: error
        });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
