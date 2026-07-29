import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// JWT verification using Web Crypto API (edge-runtime compatible).
// Previously the middleware only checked that the `admin_session` cookie was
// non-empty, which allowed anyone to forge a session by setting an arbitrary
// cookie value. We now verify the HS256 signature and the `exp` claim so only
// tokens signed with JWT_SECRET are accepted.
const JWT_SECRET =
    process.env.JWT_SECRET ||
    process.env.ADMIN_PASSWORD_HASH ||
    "mindra-default-secret-key-change-in-production";

function base64UrlToBytes(str: string): Uint8Array {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function verifySignedJwt(token: string): Promise<boolean> {
    try {
        if (!token || typeof token !== "string") return false;
        const parts = token.split(".");
        if (parts.length !== 3) return false;

        const [encodedHeader, encodedPayload, signature] = parts;

        const keyBytes = new TextEncoder().encode(JWT_SECRET);
        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );

        const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
        const expectedSig = new Uint8Array(
            await crypto.subtle.sign("HMAC", cryptoKey, data),
        );
        const expectedSigB64 = bytesToBase64Url(expectedSig);

        if (signature !== expectedSigB64) return false;

        // Validate expiration so stolen tokens don't live forever.
        const payloadBytes = base64UrlToBytes(encodedPayload);
        const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === "number" && payload.exp < now) return false;

        return true;
    } catch {
        return false;
    }
}

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Protect admin, party-prompts, and upload APIs
    const isProtected =
        path.startsWith("/admin") ||
        path.startsWith("/api/admin") ||
        path.startsWith("/api/upload") ||
        path.startsWith("/party-prompts");

    if (isProtected) {
        const adminSession = request.cookies.get("admin_session");
        const token = adminSession?.value;

        // Verify the JWT signature + expiration — not just cookie presence.
        const isValidSession = token ? await verifySignedJwt(token) : false;

        if (!isValidSession) {
            // Return 401 for API requests
            if (path.includes("/api/")) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            // Redirect to login for page requests
            const loginUrl = new URL("/login", request.nextUrl.origin);
            loginUrl.searchParams.set("from", path);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/admin",
        "/admin/:path*",
        "/api/admin/:path*",
        "/api/upload/:path*",
        "/party-prompts",
        "/party-prompts/:path*",
    ],
};
