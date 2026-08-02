"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Error boundary for the /login route.
 *
 * If the login page throws during render or hydration (e.g. a client-side JS
 * crash that prevents the form from ever submitting), this boundary catches
 * it and forwards the error to the server log endpoint so we have visibility
 * — without it, a JS crash on /login leaves zero trace on the server, which
 * is exactly the blind spot that made the login-crash incident un diagnosable.
 *
 * Reuses the /party-prompts/api/log endpoint (already wired to
 * appendServerLog) so auth page errors land in the same JSONL log file with
 * namespace LOGIN_PAGE.
 */
export default function LoginError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        try {
            fetch("/party-prompts/api/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    level: "error",
                    namespace: "LOGIN_PAGE",
                    msg: error.message || "Unhandled rendering error on /login",
                    data: {
                        name: error.name,
                        stack: error.stack,
                        digest: error.digest,
                    },
                }),
            }).catch(() => {
                // Network errors during error logging are non-fatal.
            });
        } catch {
            // Ignore — never throw from an error boundary's effect.
        }
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4 relative overflow-hidden font-sans">
            {/* Match the login page ambient glows for visual consistency */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-rose-500/30 text-center relative z-10">
                <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-400">
                    <AlertTriangle size={28} />
                </div>
                <h2 className="text-xl font-bold text-neutral-100 mb-2">Something went wrong</h2>
                <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                    The login page failed to load. The error has been logged automatically.
                </p>
                <button
                    onClick={() => reset()}
                    className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 text-sm"
                >
                    <RefreshCw size={18} />
                    Try again
                </button>
            </div>
        </div>
    );
}
