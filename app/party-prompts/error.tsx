'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function PartyPromptsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to server file logger
    try {
      fetch('/party-prompts/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          namespace: 'PAGE_RENDER_ERROR',
          msg: error.message || 'Unhandled rendering error on /party-prompts',
          data: {
            name: error.name,
            stack: error.stack,
            digest: error.digest,
          },
        }),
      }).catch(() => {});
    } catch (_e) {
      // Ignore network errors during error logging
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="w-full max-w-md bg-neutral-900/90 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-8 shadow-2xl text-center relative z-10">
        <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-400">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-bold text-neutral-100 mb-2">Произошел сбой при загрузке страницы</h2>
        <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
          {error.message || 'Возникла непредвиденная ошибка. Детали автоматически сохранены в лог-файл.'}
        </p>
        <button
          onClick={() => reset()}
          className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw size={18} />
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
