import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json({ error: "Password required" }, { status: 400 });
        }

        const hash = crypto.createHash("sha256").update(password).digest("hex");
        const validHash = process.env.ADMIN_PASSWORD_HASH;

        if (hash === validHash) {
            // Set cookie
            const cookieStore = await cookies();
            cookieStore.set("admin_session", "true", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 24, // 1 day
                path: "/",
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
