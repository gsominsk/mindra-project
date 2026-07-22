import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createSignedJwt } from "@/lib/jwt";

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        if (!password) {
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

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
