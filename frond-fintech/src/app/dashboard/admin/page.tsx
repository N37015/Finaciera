'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAPI } from '@/lib/api';
import { useFeedback } from '@/components/feedback';

type Tab = 'solicitudes' | 'cartera' | 'usuarios' | 'spei';

const formatoMoneda = (n: number) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const botonPrimario =
  'rounded-lg bg-[#0F2B52] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4079] disabled:opacity-60';
const botonSecundario =
  'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const botonPeligro =
  'rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0F2B52] focus:ring-2 focus:ring-[#0F2B52]/20';

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
      <p className="font-medium text-slate-800">{titulo}</p>
      <p className="mt-1 text-sm text-slate-500">{texto}</p>
    </div>
  );
}

function EstadoChip({ estado }: { estado: string }) {
  const activo = estado === 'ACTIVO';
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
        activo ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
      }`}
    >
      {estado}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { notificar, confirmar, ui } = useFeedback();

  // ESTADOS DE DATOS
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [prestamosClientes, setPrestamosClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ESTADOS DEL SIMULADOR
  const [clabeSpei, setClabeSpei] = useState('');
  const [montoSpei, setMontoSpei] = useState('');

  // PESTAÑA ACTIVA
  const [activeTab, setActiveTab] = useState<Tab>('solicitudes');

  useEffect(() => {
    const userData = sessionStorage.getItem('usuario');
    if (!userData) {
      router.replace('/login');
      return;
    }

    const userObj = JSON.parse(userData);
    if (userObj.rol !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }

    // 1. Carga inicial inmediata
    cargarDatosAdmin();

    // 2. Recargar datos en silencio cada 15 segundos
    const intervalo = setInterval(() => {
      cargarDatosAdmin();
    }, 15000);

    // 3. Limpieza: detener el temporizador si el admin cierra la página
    return () => clearInterval(intervalo);
  }, [router]);

  const cargarDatosAdmin = async () => {
    try {
      const dataSolicitudes = await fetchAPI('/admin/solicitudes');
      setSolicitudes(dataSolicitudes || []);

      const dataUsuarios = await fetchAPI('/usuarios');
      setUsuarios(dataUsuarios || []);

      const dataPrestamos = await fetchAPI('/admin/prestamos');
      setPrestamosClientes(dataPrestamos || []);
    } catch (error) {
      console.error('Error al cargar datos del admin', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarSesion = () => {
    sessionStorage.clear();
    window.location.replace('/login');
  };

  const aprobarSolicitud = async (id: number) => {
    const ok = await confirmar({
      titulo: 'Aprobar crédito',
      mensaje: '¿Aprobar este préstamo y desembolsar los fondos?',
      textoConfirmar: 'Aprobar y desembolsar',
    });
    if (!ok) return;

    try {
      const res = await fetchAPI(`/admin/solicitudes/${id}/aprobar`, { method: 'POST' });
      // duracion = 0 -> el toast se queda hasta que el admin lo cierre (para copiar la CLABE)
      notificar('ok', 'Préstamo aprobado. El cliente debe pagar a la CLABE:', res.clabe, 0);
      cargarDatosAdmin();
      setActiveTab('cartera');
    } catch (error: any) {
      notificar('error', 'No se pudo aprobar', error.message);
    }
  };

  const eliminarUsuarioAdmin = async (idUsuario: number, nombre: string) => {
    const ok = await confirmar({
      titulo: 'Eliminar cliente',
      mensaje: `¿Eliminar al cliente "${nombre}"?\nSe borrarán sus préstamos y cuentas.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;

    try {
      await fetchAPI(`/usuarios/${idUsuario}`, { method: 'DELETE' });
      notificar('ok', `Cliente ${nombre} eliminado correctamente`);
      cargarDatosAdmin();
    } catch (error: any) {
      notificar('error', 'Error al eliminar usuario', error.message);
    }
  };

  const simularPagoSpei = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchAPI('/webhooks/spei', {
        method: 'POST',
        body: JSON.stringify({
          clabe: clabeSpei,
          monto: parseFloat(montoSpei),
        }),
      });
      notificar('ok', res.mensaje, `Saldo restante: $${res.saldoRestante}`);
      setClabeSpei('');
      setMontoSpei('');
      cargarDatosAdmin();
      setActiveTab('cartera');
    } catch (error: any) {
      notificar('error', 'Error en la transferencia', error.message);
    }
  };

  // Solo clientes (sin admins)
  const clientesSolo = usuarios.filter((u) => u.rol !== 'ADMIN');

  // Cartera sin préstamos del admin
  const carteraReal = prestamosClientes.filter(
    (p) =>
      !p.email.toLowerCase().includes('admin') &&
      !p.cliente.toLowerCase().includes('admin')
  );

  const progreso = (p: any) => {
    const pagado = p.totalAPagar - p.saldoPendiente;
    const porcentaje = p.totalAPagar > 0 ? Math.min(100, Math.max(0, (pagado / p.totalAPagar) * 100)) : 0;
    return { pagado, porcentaje };
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'solicitudes', label: 'Solicitudes pendientes', count: solicitudes.length },
    { id: 'cartera', label: 'Cartera de préstamos' },
    { id: 'usuarios', label: 'Cuentas de clientes' },
    { id: 'spei', label: 'Simulador SPEI' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F6FB] text-slate-600">
        Cargando el panel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F6FB] pb-12 text-slate-900">
      {/* ENCABEZADO Y PESTAÑAS */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F2B52] text-sm font-bold text-white">
                N
              </span>
              <span>Backoffice</span>
            </div>
            <button onClick={handleCerrarSesion} className={botonSecundario}>
              Cerrar sesión
            </button>
          </div>

          <nav role="tablist" aria-label="Secciones" className="-mb-px flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
                  activeTab === t.id
                    ? 'border-[#0F2B52] text-[#0F2B52]'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-[#0F2B52] px-2 py-0.5 text-xs font-semibold text-white">
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* PESTAÑA 1: SOLICITUDES */}
        {activeTab === 'solicitudes' && (
          <Panel titulo="Solicitudes por revisar">
            {solicitudes.length === 0 ? (
              <Vacio titulo="No hay solicitudes pendientes" texto="Cuando un cliente envíe una, aparecerá aquí." />
            ) : (
              <>
                {/* Tabla: pantallas medianas y grandes */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-3 pr-4 font-medium">Cliente</th>
                        <th className="py-3 pr-4 font-medium">Monto solicitado</th>
                        <th className="py-3 pr-4 font-medium">Documentos</th>
                        <th className="py-3 text-right font-medium">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {solicitudes.map((s) => (
                        <tr key={s.idSolicitud}>
                          <td className="py-4 pr-4">
                            <div className="font-semibold text-slate-900">{s.nombreCliente}</div>
                            <div className="text-xs text-slate-500">CURP: {s.curp}</div>
                            <div className="text-xs text-slate-500">Solicitud #{s.idSolicitud}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="text-lg font-semibold tabular-nums text-[#0F2B52]">
                              {formatoMoneda(s.montoSolicitado)}
                            </div>
                            <div className="text-xs text-slate-500">{s.plazoMeses} meses</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="space-y-1 text-xs text-slate-600">
                              <p>
                                INE: <span className="break-all text-slate-500">{s.ine || 'Sin archivo'}</span>
                              </p>
                              <p>
                                Domicilio: <span className="break-all text-slate-500">{s.recibo || 'Sin archivo'}</span>
                              </p>
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <button onClick={() => aprobarSolicitud(s.idSolicitud)} className={botonPrimario}>
                              Aprobar crédito
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tarjetas: celulares */}
                <ul className="space-y-4 md:hidden">
                  {solicitudes.map((s) => (
                    <li key={s.idSolicitud} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{s.nombreCliente}</p>
                          <p className="text-xs text-slate-500">CURP: {s.curp}</p>
                          <p className="text-xs text-slate-500">Solicitud #{s.idSolicitud}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular-nums text-[#0F2B52]">
                            {formatoMoneda(s.montoSolicitado)}
                          </p>
                          <p className="text-xs text-slate-500">{s.plazoMeses} meses</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <p>
                          INE: <span className="break-all text-slate-500">{s.ine || 'Sin archivo'}</span>
                        </p>
                        <p>
                          Domicilio: <span className="break-all text-slate-500">{s.recibo || 'Sin archivo'}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => aprobarSolicitud(s.idSolicitud)}
                        className={`${botonPrimario} mt-4 w-full`}
                      >
                        Aprobar crédito
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        )}

        {/* PESTAÑA 2: CARTERA */}
        {activeTab === 'cartera' && (
          <Panel titulo="Cartera de préstamos">
            {carteraReal.length === 0 ? (
              <Vacio titulo="Aún no hay préstamos" texto="Los préstamos aprobados aparecerán aquí." />
            ) : (
              <>
                {/* Tabla: pantallas medianas y grandes */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-3 pr-4 font-medium">Cliente</th>
                        <th className="py-3 pr-4 font-medium">Estado</th>
                        <th className="w-1/2 py-3 font-medium">Avance de pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {carteraReal.map((p) => {
                        const { pagado, porcentaje } = progreso(p);
                        return (
                          <tr key={p.idPrestamo}>
                            <td className="py-4 pr-4">
                              <div className="font-semibold text-slate-900">{p.cliente}</div>
                              <div className="text-xs text-slate-500">{p.email}</div>
                              <div className="text-xs text-slate-500">Préstamo #{p.idPrestamo}</div>
                            </td>
                            <td className="py-4 pr-4">
                              <EstadoChip estado={p.estado} />
                            </td>
                            <td className="py-4">
                              <div className="mb-2 flex justify-between text-xs text-slate-600">
                                <span>Total a pagar: {formatoMoneda(p.totalAPagar)}</span>
                                <span>Pagado: {formatoMoneda(pagado)}</span>
                              </div>
                              <div
                                className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                                role="progressbar"
                                aria-valuenow={Math.round(porcentaje)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <div className="h-2 rounded-full bg-[#0F2B52]" style={{ width: `${porcentaje}%` }} />
                              </div>
                              <p className="mt-1 text-right text-xs text-slate-600">
                                Por pagar:{' '}
                                <span className={`font-semibold ${p.saldoPendiente > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {formatoMoneda(p.saldoPendiente)}
                                </span>
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Tarjetas: celulares */}
                <ul className="space-y-4 md:hidden">
                  {carteraReal.map((p) => {
                    const { pagado, porcentaje } = progreso(p);
                    return (
                      <li key={p.idPrestamo} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{p.cliente}</p>
                            <p className="break-all text-xs text-slate-500">{p.email}</p>
                            <p className="text-xs text-slate-500">Préstamo #{p.idPrestamo}</p>
                          </div>
                          <EstadoChip estado={p.estado} />
                        </div>
                        <div className="mt-4 flex justify-between text-xs text-slate-600">
                          <span>Total a pagar: {formatoMoneda(p.totalAPagar)}</span>
                          <span>Pagado: {formatoMoneda(pagado)}</span>
                        </div>
                        <div
                          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
                          role="progressbar"
                          aria-valuenow={Math.round(porcentaje)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div className="h-2 rounded-full bg-[#0F2B52]" style={{ width: `${porcentaje}%` }} />
                        </div>
                        <p className="mt-1 text-right text-xs text-slate-600">
                          Por pagar:{' '}
                          <span className={`font-semibold ${p.saldoPendiente > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {formatoMoneda(p.saldoPendiente)}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Panel>
        )}

        {/* PESTAÑA 3: CLIENTES */}
        {activeTab === 'usuarios' && (
          <Panel titulo="Cuentas registradas">
            {clientesSolo.length === 0 ? (
              <Vacio titulo="No hay clientes registrados" texto="Aparecerán aquí cuando se den de alta." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="hidden py-3 pr-4 font-medium sm:table-cell">ID</th>
                      <th className="py-3 pr-4 font-medium">Cliente</th>
                      <th className="py-3 text-right font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesSolo.map((u) => (
                      <tr key={u.idUsuario}>
                        <td className="hidden py-4 pr-4 text-slate-500 sm:table-cell">#{u.idUsuario}</td>
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-slate-900">{u.nombre}</div>
                          <div className="break-all text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => eliminarUsuarioAdmin(u.idUsuario, u.nombre)}
                            className={botonPeligro}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* PESTAÑA 4: SIMULADOR SPEI */}
        {activeTab === 'spei' && (
          <div className="mx-auto max-w-xl">
            <Panel titulo="Simulador de transferencia SPEI">
              <p className="text-sm text-slate-600">
                Herramienta de pruebas: registra un abono como si el banco lo hubiera enviado a la CLABE del préstamo.
              </p>

              <form onSubmit={simularPagoSpei} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="clabe" className="mb-1 block text-sm font-medium text-slate-700">
                    CLABE interbancaria
                  </label>
                  <input
                    id="clabe"
                    type="text"
                    inputMode="numeric"
                    value={clabeSpei}
                    onChange={(e) => setClabeSpei(e.target.value)}
                    className={`${inputClass} font-mono`}
                    placeholder="18 dígitos"
                    maxLength={18}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="montoSpei" className="mb-1 block text-sm font-medium text-slate-700">
                    Monto del abono
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      id="montoSpei"
                      type="number"
                      inputMode="decimal"
                      value={montoSpei}
                      onChange={(e) => setMontoSpei(e.target.value)}
                      className={`${inputClass} pl-8`}
                      placeholder="1000.00"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="h-12 w-full rounded-lg bg-[#0F2B52] font-semibold text-white hover:bg-[#1B4079]"
                >
                  Registrar transferencia
                </button>
              </form>
            </Panel>
          </div>
        )}
      </main>

      {/* Toasts y modal de confirmación */}
      {ui}
    </div>
  );
}