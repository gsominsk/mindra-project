import { NextResponse } from "next/server";

/**
 * Lightweight health-check endpoint.
 *
 * Intentionally public (not behind middleware auth) so external monitors,
 * load balancers, and ad-hoc `curl localhost:3000/api/health` checks can
 * verify the Node process is alive and responding without valid credentials.
 *
 * Returns 200 + a minimal JSON body. No DB access, no deps — if the process
 * can answer this, the HTTP server is up. A 5xx or timeout here means the
 * container needs a restart.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        timestamp: Date.now(),
    });
}
