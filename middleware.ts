import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Protect admin routes and upload API
    if (path.startsWith("/admin") || path.startsWith("/api/admin") || path.startsWith("/api/upload")) {
        const adminSession = request.cookies.get("admin_session");

        if (!adminSession) {
            // Redirect to login for page requests
            if (!path.startsWith("/api")) {
                return NextResponse.redirect(new URL("/login", request.url));
            }
            // Return 401 for API requests
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/admin/:path*",
        "/api/admin/:path*",
        "/api/upload/:path*",
    ],
};
