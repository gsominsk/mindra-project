import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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

        // Valid session check: JWT token or session cookie present
        const isValidSession = Boolean(token && token.trim().length > 0);

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
