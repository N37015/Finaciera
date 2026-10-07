'use client';

import { useState, useCallback, useRef } from 'react';

type Tipo = 'ok' | 'error' | 'info';
type Toast = { id: number; tipo: Tipo; titulo: string; detalle?: string };
type OpcionesConfirm = { titulo: string; mensaje: string; textoConfirmar?: string; peligro?: boolean };
type Dialogo = (OpcionesConfirm & { resolve: (v: boolean) => void }) | null;

const colores: Record<Tipo, string> = {
  ok: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  error: 'border-red-500 bg-red-50 text-red-900',
  info: 'border-blue-500 bg-blue-50 text-blue-900',
};

export function useFeedback() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const idRef = useRef(0);

  const cerrarToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  // duracion = 0 -> se queda hasta que el admin lo cierre (útil para copiar la CLABE)
  const notificar = useCallback((tipo: Tipo, titulo: string, detalle?: string, duracion = 6000) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, tipo, titulo, detalle }]);
    if (duracion > 0) setTimeout(() => cerrarToast(id), duracion);
  }, []);

  const confirmar = useCallback(
    (opts: OpcionesConfirm) => new Promise<boolean>((resolve) => setDialogo({ ...opts, resolve })),
    []
  );

  const responder = (valor: boolean) => {
    dialogo?.resolve(valor);
    setDialogo(null);
  };

  const ui = (
    <>
      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-80">
        {toasts.map((t) => (
          <div key={t.id} className={`border-l-4 rounded-lg shadow-lg p-4 ${colores[t.tipo]}`}>
            <div className="flex justify-between gap-2">
              <p className="text-sm font-bold">{t.titulo}</p>
              <button onClick={() => cerrarToast(t.id)} className="text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
            {t.detalle && <p className="mt-1 text-sm font-mono break-all select-all">{t.detalle}</p>}
          </div>
        ))}
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      {dialogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900">{dialogo.titulo}</h3>
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{dialogo.mensaje}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => responder(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                autoFocus
                onClick={() => responder(true)}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${
                  dialogo.peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {dialogo.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { notificar, confirmar, ui };
}