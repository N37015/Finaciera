'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

type Aviso = { tipo: 'exito' | 'error'; texto: string } | null;
type PagoActivo = { idPrestamo: number; saldoPendiente: number } | null;

const formatoMoneda = (n: number) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// Igual que antes. Idealmente la CLABE debería venir de tu API.
const obtenerClabe = (idPrestamo: number) =>
  `6461801110000${String(idPrestamo).padStart(5, '0')}`;

const botonPrimario =
  'rounded-lg bg-[#0F2B52] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4079] disabled:opacity-60';
const botonSecundario =
  'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50';

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [aviso, setAviso] = useState<Aviso>(null);

  const [pagoActivo, setPagoActivo] = useState<PagoActivo>(null);
  const [montoInput, setMontoInput] = useState('');
  const [errorModal, setErrorModal] = useState('');
  const [procesando, setProcesando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('usuario');
    if (!userData) {
      router.replace('/login');
      return;
    }

    const userObj = JSON.parse(userData);
    if (userObj.rol === 'ADMIN') {
      router.replace('/dashboard/admin');
      return;
    }

    setUsuario(userObj);
    cargarPrestamos(userObj.idUsuario);
    cargarTransacciones(userObj.idUsuario);

    const intervalo = setInterval(() => {
      cargarPrestamos(userObj.idUsuario);
      cargarTransacciones(userObj.idUsuario);
    }, 15000);

    return () => clearInterval(intervalo);
  }, [router]);

  // El aviso se oculta solo a los 4 segundos
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Enfocar el campo al abrir el modal y cerrar con Escape
  useEffect(() => {
    if (!pagoActivo) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !procesando) cerrarModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pagoActivo, procesando]);

  const cargarPrestamos = async (idUsuario: number) => {
    try {
      const data = await fetchAPI(`/prestamos/usuario/${idUsuario}`);
      setPrestamos(data || []);
    } catch (error) {
      console.error('Error al cargar préstamos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTransacciones = async (idUsuario: number) => {
    try {
      const data = await fetchAPI(`/transacciones/usuario/${idUsuario}`);
      setTransacciones(data || []);
    } catch (error) {
      console.error('Error al cargar transacciones:', error);
      setTransacciones([]);
    }
  };

  const handleCerrarSesion = () => {
    sessionStorage.clear();
    window.location.replace('/login');
  };

  const copiarClabe = async (clabe: string) => {
    try {
      await navigator.clipboard.writeText(clabe);
      setAviso({ tipo: 'exito', texto: 'CLABE copiada.' });
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo copiar. Selecciónala y cópiala a mano.' });
    }
  };

  const abrirModal = (idPrestamo: number, saldoPendiente: number) => {
    setMontoInput('');
    setErrorModal('');
    setPagoActivo({ idPrestamo, saldoPendiente });
  };

  const cerrarModal = () => {
    setPagoActivo(null);
    setMontoInput('');
    setErrorModal('');
  };

  const confirmarPago = async () => {
    if (!pagoActivo) return;

    const montoAbono = parseFloat(montoInput);

    if (isNaN(montoAbono) || montoAbono <= 0) {
      setErrorModal('Ingresa una cantidad mayor a $0.');
      return;
    }
    if (montoAbono > pagoActivo.saldoPendiente) {
      setErrorModal(`El abono no puede superar tu saldo de ${formatoMoneda(pagoActivo.saldoPendiente)}.`);
      return;
    }

    try {
      setProcesando(true);
      await fetchAPI(`/prestamos/${pagoActivo.idPrestamo}/pagar`, {
        method: 'POST',
        body: JSON.stringify({ montoAbono }),
      });

      cerrarModal();
      setAviso({ tipo: 'exito', texto: 'Abono registrado.' });
      cargarPrestamos(usuario.idUsuario);
      cargarTransacciones(usuario.idUsuario);
    } catch (error: any) {
      setErrorModal(error.message || 'No se pudo registrar el abono. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F6FB] text-slate-600">
        Cargando tu cuenta...
      </div>
    );
  }

  const saldoTotal = prestamos.reduce((suma, p) => suma + (p.saldoPendiente || 0), 0);

  return (
    <div className="min-h-screen bg-[#F2F6FB] text-slate-900">
      {/* AVISO */}
      {aviso && (
        <div
          role="status"
          className={`fixed left-4 right-4 top-4 z-50 flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white sm:left-auto sm:w-80 ${
            aviso.tipo === 'exito' ? 'bg-emerald-700' : 'bg-red-600'
          }`}
        >
          <span>{aviso.texto}</span>
          <button
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="text-lg leading-none text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* MODAL DE ABONO */}
      {pagoActivo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !procesando && cerrarModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-pago"
            className="w-full max-w-sm rounded-lg bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="titulo-pago" className="text-lg font-semibold text-slate-900">
              Abonar al préstamo #{pagoActivo.idPrestamo}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Saldo pendiente:{' '}
              <span className="font-semibold text-slate-900">
                {formatoMoneda(pagoActivo.saldoPendiente)}
              </span>
            </p>

            <label htmlFor="monto" className="mt-5 block text-sm font-medium text-slate-700">
              Cantidad a abonar
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                id="monto"
                ref={inputRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={montoInput}
                onChange={(e) => {
                  setMontoInput(e.target.value);
                  setErrorModal('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && confirmarPago()}
                placeholder="0.00"
                className={`w-full rounded-lg border py-2.5 pl-7 pr-3 text-slate-900 outline-none focus:ring-2 ${
                  errorModal
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-slate-300 focus:border-[#0F2B52] focus:ring-[#0F2B52]/20'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setMontoInput(String(pagoActivo.saldoPendiente));
                setErrorModal('');
              }}
              className="mt-2 text-sm font-medium text-[#0F2B52] hover:underline"
            >
              Liquidar saldo completo
            </button>

            {errorModal && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {errorModal}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={cerrarModal} disabled={procesando} className={botonSecundario}>
                Cancelar
              </button>
              <button onClick={confirmarPago} disabled={procesando} className={botonPrimario}>
                {procesando ? 'Procesando...' : 'Confirmar abono'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F2B52] text-sm font-bold text-white">
              N
            </span>
            <span className="hidden sm:inline">NovaFintech</span>
          </span>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="max-w-[9rem] truncate text-sm text-slate-600 sm:max-w-none">
              {usuario?.usuario}
            </span>
            <button onClick={handleCerrarSesion} className={botonSecundario}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* RESUMEN */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {usuario?.usuario}</h1>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-600">Saldo pendiente total</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums text-[#0F2B52]">
                {formatoMoneda(saldoTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Préstamos</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{prestamos.length}</dd>
            </div>
          </dl>
        </section>

        {/* PRÉSTAMOS */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Mis préstamos</h2>
            <Link href="/dashboard/solicitar" className={`${botonPrimario} text-center`}>
              Solicitar préstamo
            </Link>
          </div>

          {prestamos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
              <p className="text-slate-700">Aún no tienes préstamos.</p>
              <p className="mt-1 text-sm text-slate-500">
                Usa el botón &quot;Solicitar préstamo&quot; para empezar.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {prestamos.map((prestamo, i) => {
                const clabe = obtenerClabe(prestamo.idPrestamo);
                return (
                  <article
                    key={prestamo.idPrestamo ?? i}
                    className="rounded-lg border border-slate-200 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm text-slate-600">
                        Préstamo #{prestamo.idPrestamo}
                      </span>
                      <div className="text-right">
                        <p className="text-xl font-semibold tabular-nums text-[#0F2B52]">
                          {formatoMoneda(prestamo.saldoPendiente)}
                        </p>
                        <p className="text-xs text-slate-500">saldo pendiente</p>
                      </div>
                    </div>

                    <dl className="mt-4 flex justify-between text-sm text-slate-600">
                      <div>
                        <dt className="text-xs text-slate-500">Monto aprobado</dt>
                        <dd className="tabular-nums">{formatoMoneda(prestamo.montoAprobado)}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs text-slate-500">Tasa de interés</dt>
                        <dd>{prestamo.tasaInteres}%</dd>
                      </div>
                    </dl>

                    <div className="mt-4 rounded-lg bg-[#F2F6FB] p-3">
                      <p className="text-xs text-slate-600">CLABE para abonar por SPEI</p>
                      <p className="mt-1 break-all font-mono text-base font-semibold tracking-wide text-slate-900 select-all sm:text-lg">
                        {clabe}
                      </p>
                      <button
                        type="button"
                        onClick={() => copiarClabe(clabe)}
                        className="mt-2 text-sm font-medium text-[#0F2B52] hover:underline"
                      >
                        Copiar CLABE
                      </button>
                    </div>

                   
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* HISTORIAL */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-6 text-xl font-semibold">Historial de movimientos</h2>

          {transacciones.length === 0 ? (
            <div className="py-6 text-center text-slate-500">Aún no hay movimientos registrados.</div>
          ) : (
            <>
              {/* Tabla: pantallas medianas y grandes */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Fecha</th>
                      <th className="py-3 pr-4 font-medium">Tipo</th>
                      <th className="py-3 pr-4 font-medium">Folio</th>
                      <th className="py-3 pr-4 text-right font-medium">Monto</th>
                      <th className="py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transacciones.map((tx, i) => {
                      const esPago = tx.tipoTransaccion.includes('PAGO');
                      return (
                        <tr key={tx.idTransaccion ?? i}>
                          <td className="py-4 pr-4">{tx.fecha}</td>
                          <td className="py-4 pr-4">
                            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                              {tx.tipoTransaccion}
                            </span>
                          </td>
                          <td className="py-4 pr-4">#{tx.idTransaccion}</td>
                          <td className="py-4 pr-4 text-right font-semibold tabular-nums text-slate-900">
                            {esPago ? '-' : '+'}
                            {formatoMoneda(tx.monto)}
                          </td>
                          <td className="py-4">
                            <span className="rounded bg-[#F2F6FB] px-2 py-1 text-xs text-slate-700">
                              {tx.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Lista: celulares */}
              <ul className="divide-y divide-slate-100 sm:hidden">
                {transacciones.map((tx, i) => {
                  const esPago = tx.tipoTransaccion.includes('PAGO');
                  return (
                    <li key={tx.idTransaccion ?? i} className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {tx.tipoTransaccion}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {esPago ? '-' : '+'}
                          {formatoMoneda(tx.monto)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {tx.fecha} · #{tx.idTransaccion}
                        </span>
                        <span>{tx.estado}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  );
}