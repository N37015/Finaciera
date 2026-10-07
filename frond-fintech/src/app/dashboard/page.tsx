'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

type Aviso = { tipo: 'exito' | 'error'; texto: string } | null;
type PagoActivo = { idPrestamo: number; saldoPendiente: number } | null;

const formatoMoneda = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reemplazo de alert() -> aviso (toast)
  const [aviso, setAviso] = useState<Aviso>(null);

  // Reemplazo de prompt() -> modal de pago
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
      setAviso({ tipo: 'exito', texto: 'Pago procesado con éxito.' });
      cargarPrestamos(usuario.idUsuario);
      cargarTransacciones(usuario.idUsuario);
    } catch (error: any) {
      setErrorModal(error.message || 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* AVISO (reemplaza alert) */}
      {aviso && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium text-white ${
            aviso.tipo === 'exito' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          <span>{aviso.texto}</span>
          <button
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="text-white/80 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* MODAL DE PAGO (reemplaza prompt) */}
      {pagoActivo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !procesando && cerrarModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-pago"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="titulo-pago" className="text-lg font-semibold text-slate-800">
              Abonar al préstamo #{pagoActivo.idPrestamo}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Saldo pendiente:{' '}
              <span className="font-semibold text-slate-800">
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
                className={`w-full rounded-lg border py-2 pl-7 pr-3 text-slate-800 outline-none focus:ring-2 ${
                  errorModal
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200 focus:border-blue-500'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setMontoInput(String(pagoActivo.saldoPendiente));
                setErrorModal('');
              }}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Liquidar saldo completo
            </button>

            {errorModal && <p className="mt-3 text-sm text-red-600">{errorModal}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cerrarModal}
                disabled={procesando}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPago}
                disabled={procesando}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {procesando ? 'Procesando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-slate-800 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold">NovaFintech</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">Hola, {usuario?.usuario}</span>
          <button
            onClick={handleCerrarSesion}
            className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6 mt-6">
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Resumen de Cuenta</h2>
          <p className="text-slate-500">Bienvenido a tu panel de control, {usuario?.usuario}.</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-slate-800">Mis Préstamos Activos</h3>
            <Link
              href="/dashboard/solicitar"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Solicitar Nuevo Préstamo
            </Link>
          </div>

          {prestamos.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-slate-500 mb-2">Aún no tienes préstamos con nosotros.</p>
              <p className="text-sm text-slate-400">Solicita uno usando el botón de arriba.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {prestamos.map((prestamo, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-5">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-500 text-sm">Préstamo #{prestamo.idPrestamo}</span>
                    <span className="text-blue-600 font-bold text-lg">
                      ${prestamo.saldoPendiente.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-600">
                      Aprobado: ${prestamo.montoAprobado.toLocaleString()}
                    </span>
                    <span className="text-slate-600">Tasa: {prestamo.tasaInteres}%</span>
                  </div>

                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                    <p className="text-xs text-blue-600 uppercase font-semibold tracking-wider mb-1">
                      CLABE para abonar por SPEI
                    </p>
                    <p className="font-mono text-lg text-slate-800 font-bold tracking-widest select-all">
                      6461801110000{String(prestamo.idPrestamo).padStart(5, '0')}
                    </p>
                  </div>

                  <button
                    onClick={() => abrirModal(prestamo.idPrestamo, prestamo.saldoPendiente)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded text-sm font-medium transition-colors border border-slate-300"
                  >
                    Realizar Pago Manual
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-6">Historial de Transacciones</h3>

          {transacciones.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              Aún no hay transacciones registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                  <tr>
                    <th className="px-6 py-3 rounded-tl-lg">Fecha</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">ID Transacción</th>
                    <th className="px-6 py-3">Monto</th>
                    <th className="px-6 py-3 rounded-tr-lg">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {transacciones.map((tx, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">{tx.fecha}</td>
                      <td className="px-6 py-4 font-medium">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            tx.tipoTransaccion.includes('PAGO')
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {tx.tipoTransaccion}
                        </span>
                      </td>
                      <td className="px-6 py-4">#{tx.idTransaccion}</td>
                      <td
                        className={`px-6 py-4 font-bold ${
                          tx.tipoTransaccion.includes('PAGO') ? 'text-green-600' : 'text-slate-800'
                        }`}
                      >
                        {tx.tipoTransaccion.includes('PAGO') ? '-' : '+'}${tx.monto.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs">
                          {tx.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}