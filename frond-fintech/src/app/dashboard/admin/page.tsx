'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAPI } from '@/lib/api';
import { useFeedback } from '@/components/feedback';

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

  // ESTADO DE LA PESTAÑA ACTIVA
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'cartera' | 'usuarios' | 'spei'>('solicitudes');

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
      setActiveTab('cartera'); // Te lleva a la cartera automáticamente al aprobar
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
          monto: parseFloat(montoSpei)
        })
      });
      notificar('ok', res.mensaje, `Saldo restante: $${res.saldoRestante}`);
      setClabeSpei('');
      setMontoSpei('');
      cargarDatosAdmin();
      setActiveTab('cartera'); // Te lleva a la cartera para ver el saldo actualizado
    } catch (error: any) {
      notificar('error', 'Error en la transferencia', error.message);
    }
  };

  // FILTRAR SOLO CLIENTES (Ocultar Admins de la tabla de usuarios)
  const clientesSolo = usuarios.filter(u => u.rol !== 'ADMIN');

  // FILTRAR LA CARTERA PARA OCULTAR PRÉSTAMOS DEL ADMIN
  const carteraReal = prestamosClientes.filter(p =>
    !p.email.toLowerCase().includes('admin') &&
    !p.cliente.toLowerCase().includes('admin')
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-lg font-medium text-slate-500 animate-pulse">Cargando panel de Backoffice...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* HEADER Y NAVEGACIÓN */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Backoffice <span className="text-blue-600 font-medium">| NovaFintech</span>
              </h1>
              <p className="mt-1 text-sm text-slate-500">Panel de control y administración financiera.</p>
            </div>

            {/* NOTIFICACIÓN VISUAL DE SOLICITUDES PENDIENTES */}
            {solicitudes.length > 0 && (
              <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full animate-bounce">
                {solicitudes.length} Solicitud(es) Nueva(s)
              </div>
            )}
          </div>

          {/* MENÚ DE PESTAÑAS (TABS) */}
          <nav className="flex space-x-1 border-b border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('solicitudes')}
              className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'solicitudes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
               Solicitudes Pendientes
            </button>
            <button
              onClick={() => setActiveTab('cartera')}
              className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'cartera' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
               Cartera de Préstamos
            </button>
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'usuarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
               Cuentas de Clientes
            </button>
            <button
              onClick={() => setActiveTab('spei')}
              className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'spei' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
               Simulador SPEI
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

        {/* =========================================
            PESTAÑA 1: SOLICITUDES PENDIENTES
        ============================================= */}
        {activeTab === 'solicitudes' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-800">Por Revisar</h2>
            </div>

            <div className="p-6">
              {solicitudes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <span className="text-5xl">📭</span>
                  <h3 className="mt-4 text-base font-medium text-slate-900">Bandeja limpia</h3>
                  <p className="mt-1 text-sm text-slate-500">No hay solicitudes pendientes de aprobación.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Monto Solicitado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Documentos</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {solicitudes.map((s) => (
                        <tr key={s.idSolicitud} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="text-sm font-bold text-slate-900">{s.nombreCliente}</div>
                            <div className="text-xs text-slate-500">CURP: {s.curp}</div>
                            <div className="text-xs text-slate-400">ID Solicitud: #{s.idSolicitud}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-lg font-black text-blue-600">${s.montoSolicitado}</div>
                            <div className="text-xs font-medium text-slate-500">{s.plazoMeses} meses</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1 text-xs text-slate-600">
                              <span>📄 INE: <span className="text-slate-400">{s.ine}</span></span>
                              <span>📄 Domicilio: <span className="text-slate-400">{s.recibo}</span></span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => aprobarSolicitud(s.idSolicitud)}
                              className="px-5 py-2 bg-green-600 rounded-lg font-bold text-xs text-white uppercase hover:bg-green-700 transition-colors shadow-md"
                            >
                              Aprobar Crédito
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================
            PESTAÑA 2: CARTERA DE PRÉSTAMOS
        ============================================= */}
        {activeTab === 'cartera' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Estado de Cuenta Global</h2>
            </div>

            <div className="p-6">
              {carteraReal.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <span className="text-5xl"></span>
                  <p className="mt-4 text-sm text-slate-500">Aún no hay préstamos activos ni históricos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Balance Financiero</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {carteraReal.map((p) => {
                        const montoPagado = p.montoAprobado - p.saldoPendiente;
                        const porcentajePagado = Math.min(100, Math.max(0, (montoPagado / p.montoAprobado) * 100));

                        return (
                          <tr key={p.idPrestamo} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="text-sm font-bold text-slate-900">{p.cliente}</div>
                              <div className="text-xs text-slate-500">{p.email}</div>
                              <div className="text-xs text-slate-400">Préstamo #{p.idPrestamo}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                                p.estado === 'ACTIVO'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {p.estado}
                              </span>
                            </td>
                            <td className="px-4 py-4 w-1/2">
                              {/* BARRA DE PROGRESO DE PAGO */}
                              <div className="mb-2 flex justify-between text-xs">
                                <span className="font-semibold text-slate-700">Prestado: ${p.montoAprobado}</span>
                                <span className="font-bold text-blue-600">Pagado: ${montoPagado}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2.5 mb-1 overflow-hidden">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${porcentajePagado}%` }}></div>
                              </div>
                              <div className="text-right text-xs font-bold text-slate-500">
                                Restante por pagar: <span className={p.saldoPendiente > 0 ? 'text-red-500' : 'text-emerald-500'}>${p.saldoPendiente}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================
            PESTAÑA 3: CUENTAS DE CLIENTES
        ============================================= */}
        {activeTab === 'usuarios' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in max-w-4xl mx-auto">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Cuentas Registradas en el Sistema</h2>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nombre del Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Correo</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {clientesSolo.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">No hay clientes registrados.</td>
                    </tr>
                  ) : (
                    clientesSolo.map((u) => (
                      <tr key={u.idUsuario} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-400">#{u.idUsuario}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{u.nombre}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => eliminarUsuarioAdmin(u.idUsuario, u.nombre)}
                            className="text-xs text-red-600 hover:text-white hover:bg-red-600 border border-red-600 px-3 py-1.5 rounded transition-colors font-semibold"
                          >
                            Eliminar Cliente
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =========================================
            PESTAÑA 4: SIMULADOR SPEI
        ============================================= */}
        {activeTab === 'spei' && (
          <section className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden text-white max-w-3xl mx-auto animate-fade-in">
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-950/50 flex items-center gap-3">
              <span className="text-3xl"></span>
              <div>
                <h2 className="text-xl font-bold text-white">Simulador de Webhook SPEI</h2>
                <p className="text-sm text-slate-400 mt-1">Simula que el Banco de México ha enviado una transferencia al sistema.</p>
              </div>
            </div>

            <div className="p-8">
              <form onSubmit={simularPagoSpei} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-300 uppercase tracking-widest">CLABE Interbancaria (18 dígitos)</label>
                  <input
                    type="text"
                    value={clabeSpei}
                    onChange={(e) => setClabeSpei(e.target.value)}
                    className="w-full px-5 py-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-lg font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Ej. 646180111000000006"
                    maxLength={18}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-300 uppercase tracking-widest">Monto del Abono ($)</label>
                  <input
                    type="number"
                    value={montoSpei}
                    onChange={(e) => setMontoSpei(e.target.value)}
                    className="w-full px-5 py-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-lg font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="1000.00"
                    min="1"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                >
                  Ejecutar Transferencia Simulada
                </button>
              </form>
            </div>
          </section>
        )}

      </main>

      {/* Toasts y modal de confirmación */}
      {ui}

      {/* Estilo para transición suave */}
      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}