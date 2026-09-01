'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CAMBIADO A SESSIONSTORAGE PARA AISLAR PESTAÑAS
    const userData = sessionStorage.getItem('usuario');
    if (!userData) {
      router.push('/login');
      return;
    }

    const userObj = JSON.parse(userData);
    setUsuario(userObj);

    if (userObj.rol !== 'ADMIN') {
      cargarPrestamos(userObj.idUsuario);
      cargarTransacciones(userObj.idUsuario);
    } else {
      setLoading(false); 
    }
  }, [router]);

  const cargarPrestamos = async (idUsuario: number) => {
    try {
      const data = await fetchAPI(`/prestamos/usuario/${idUsuario}`);
      setPrestamos(data || []);
    } catch (error) {
      console.error("Error al cargar préstamos:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTransacciones = async (idUsuario: number) => {
    try {
      const data = await fetchAPI(`/transacciones/usuario/${idUsuario}`);
      setTransacciones(data || []);
    } catch (error) {
      console.error("Error al cargar transacciones:", error);
      setTransacciones([]);
    }
  };

  const handleCerrarSesion = () => {
    // CAMBIADO A SESSIONSTORAGE
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    router.push('/login');
  };

  const handlePago = async (idPrestamo: number, saldoPendiente: number) => {
    const cantidadStr = window.prompt(`Tu saldo pendiente es de $${saldoPendiente}\n¿Cuánto deseas abonar a este préstamo?`);
    
    if (!cantidadStr) return;

    const montoAbono = parseFloat(cantidadStr);

    if (isNaN(montoAbono) || montoAbono <= 0) {
      alert("Por favor, ingresa una cantidad válida mayor a 0.");
      return;
    }

    if (montoAbono > saldoPendiente) {
      alert("No puedes abonar más del saldo pendiente.");
      return;
    }

    try {
      setLoading(true);
      await fetchAPI(`/prestamos/${idPrestamo}/pagar`, {
        method: 'POST',
        body: JSON.stringify({ montoAbono }),
      });
      
      alert("¡Pago procesado con éxito!");
      
      cargarPrestamos(usuario.idUsuario);
      cargarTransacciones(usuario.idUsuario);
    } catch (error: any) {
      alert(error.message || "Error al procesar el pago");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
                    <span className="text-blue-600 font-bold text-lg">${prestamo.saldoPendiente.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-600">Aprobado: ${prestamo.montoAprobado.toLocaleString()}</span>
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
                    onClick={() => handlePago(prestamo.idPrestamo, prestamo.saldoPendiente)}
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
                        <span className={`px-2 py-1 rounded text-xs ${
                          tx.tipoTransaccion.includes('PAGO') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {tx.tipoTransaccion}
                        </span>
                      </td>
                      <td className="px-6 py-4">#{tx.idTransaccion}</td>
                      <td className={`px-6 py-4 font-bold ${
                        tx.tipoTransaccion.includes('PAGO') ? 'text-green-600' : 'text-slate-800'
                      }`}>
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