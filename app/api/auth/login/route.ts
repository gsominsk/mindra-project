import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createSignedJwt } from "@/lib/jwt";
import { appendServerLog } from "@/lib/logger_server";

export async function POST(request: Request) {
    let username: string | undefined;
    try {
        const body = await request.json();
        username = body.username;
        const password = body.password;

        if (!password) {
            appendServerLog({
                level: "warn",
                namespace: "AUTH",
                msg: "Login rejected: password missing",
                data: { username },
            });
            return NextResponse.json({ error: "Password required" }, { status: 400 });
        }

        const adminPass = process.env.ADMIN_PASSWORD;
        const envUser = process.env.PARTY_PROMPTS_USER;
        const envPass = process.env.PARTY_PROMPTS_PASS;

        const isPartyMatch =
            envPass &&
            password === envPass &&
            (!envUser || !username || username === envUser);

        const isAdminPassMatch = adminPass && password === adminPass;
        // Fallback check for SHA256 hash if ADMIN_PASSWORD_HASH is set
        const hash = crypto.createHash("sha256").update(password).digest("hex");
        const isAdminHashMatch = process.env.ADMIN_PASSWORD_HASH && hash === process.env.ADMIN_PASSWORD_HASH;

        if (isAdminPassMatch || isPartyMatch || isAdminHashMatch) {
            // Identify which credential mechanism matched (for audit, never log the password).
            const mechanism = isAdminHashMatch
                ? "admin_hash"
                : isAdminPassMatch
                    ? "admin_pass"
                    : "party";

            // Generate signed JWT token
            const token = createSignedJwt({ sub: username || "admin", role: "admin" }, 60 * 60 * 24);

            // Set HttpOnly cookie with signed JWT
            const cookieStore = await cookies();
            cookieStore.set("admin_session", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 24, // 1 day
                path: "/",
            });

            appendServerLog({
                level: "success",
                namespace: "AUTH",
                msg: "Login successful",
                data: { username, mechanism },
            });
            return NextResponse.json({ success: true });
        }

        appendServerLog({
            level: "warn",
            namespace: "AUTH",
            msg: "Login failed: invalid credentials",
            data: { username },
        });
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    } catch (error) {
        // Type-safe extraction (mirrors app/party-prompts/actions.ts pattern):
        // never log the raw password; capture message + stack only.
        const message = error instanceof Error ? error.message : "Unknown error";
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("Login route error:", error);
        appendServerLog({
            level: "error",
            namespace: "AUTH",
            msg: "Internal error during login",
            data: { username, message, stack },
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
