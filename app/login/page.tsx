"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, User } from "lucide-react";

function LoginForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get("from") || "/admin/dashboard";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push(from);
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Invalid credentials");
            }
        } catch (err) {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-neutral-800/80 text-neutral-100">
            <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-neutral-700/50 rounded-2xl flex items-center justify-center mb-4 text-cyan-400 shadow-inner">
                    <Lock size={24} />
                </div>
                <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">Authorization Access</h1>
                <p className="text-neutral-400 text-sm mt-1">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <div className="relative">
                        <User size={18} className="absolute left-3.5 top-3.5 text-neutral-500" />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username (e.g. admin)"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all bg-neutral-950/70 text-neutral-100 placeholder-neutral-500 text-sm"
                        />
                    </div>
                </div>

                <div>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3.5 top-3.5 text-neutral-500" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all bg-neutral-950/70 text-neutral-100 placeholder-neutral-500 text-sm"
                            required
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-rose-400 text-sm text-center bg-rose-500/10 border border-rose-500/20 py-2.5 px-3 rounded-xl animate-shake">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
                >
                    {loading ? "Verifying..." : "Login"}
                    {!loading && <ArrowRight size={18} />}
                </button>
            </form>
        </div>
    );
}

export const dynamic = 'force-dynamic';

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4 relative overflow-hidden">
            {/* Background Ambient Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <Suspense fallback={<div className="text-neutral-400 text-sm">Loading authorization...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}

