'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0F2B52] focus:ring-2 focus:ring-[#0F2B52]/20 disabled:bg-slate-100 disabled:text-slate-500';

const fileClass =
  'w-full cursor-pointer text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#0F2B52] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#1B4079] disabled:cursor-not-allowed';

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

// Muestra solo el nombre del archivo a partir de la ruta guardada
const nombreArchivo = (ruta: string) =>
  ruta ? decodeURIComponent(ruta.split('/').pop() ?? '') : '';

export default function SolicitarPrestamoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const [formData, setFormData] = useState({
    monto: '',
    meses: '12',
    curp: '',
    ine: '',
    reciboLuzAgua: '',
    comprobanteIngresos: 'Pendiente',
    estadoCuenta: 'Pendiente'
  });

  useEffect(() => {
    const userData = sessionStorage.getItem('usuario');
    if (!userData) {
      router.push('/login');
    } else {
      setUsuario(JSON.parse(userData));
    }
  }, [router]);

  // Tras el éxito, esperamos 2.5 s para que el cliente lea el aviso y lo mandamos al panel
  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => router.push('/dashboard'), 2500);
    return () => clearTimeout(t);
  }, [exito, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, [e.target.name]: `http://localhost:8080/documentos/${e.target.files[0].name}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!usuario) {
      setError('Tu sesión no está lista. Recarga la página e intenta de nuevo.');
      return;
    }

    const curp = formData.curp.trim().toUpperCase();
    if (!CURP_REGEX.test(curp)) {
      setError('El CURP no tiene un formato válido. Revisa que sean 18 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await fetchAPI('/prestamos/simular', {
        method: 'POST',
        body: JSON.stringify({
          idUsuario: usuario.idUsuario,
          monto: parseFloat(formData.monto),
          meses: parseInt(formData.meses),
          curp
        }),
      });

      setExito(true);
    } catch (err: any) {
      setError(err.message || 'No pudimos procesar tu solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const bloqueado = loading || exito;

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F6FB]">
      {/* Barra superior */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F2B52] text-sm font-bold text-white">
              N
            </span>
            <span className="hidden sm:inline">NovaFintech</span>
          </span>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeftIcon />
            <span>
              Volver<span className="hidden sm:inline"> al panel</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 sm:p-8 self-start">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Solicitar préstamo
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Elige el monto y el plazo, y comparte tus datos y documentos para que
            revisemos tu solicitud.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {exito && (
            <div
              role="status"
              className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              <p className="font-semibold">Solicitud enviada</p>
              <p className="mt-1">
                Revisaremos tu información y verás el resultado en tu panel. Te
                llevamos allá en un momento.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="monto" className="mb-1 block text-sm font-medium text-slate-700">
                  Monto solicitado
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    id="monto"
                    type="number"
                    inputMode="numeric"
                    name="monto"
                    min="500"
                    step="100"
                    value={formData.monto}
                    onChange={handleChange}
                    className={`${inputClass} pl-8`}
                    placeholder="10000"
                    required
                    disabled={bloqueado}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Desde $500, en múltiplos de $100.</p>
              </div>

              <div>
                <label htmlFor="meses" className="mb-1 block text-sm font-medium text-slate-700">
                  Plazo
                </label>
                <select
                  id="meses"
                  name="meses"
                  value={formData.meses}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={bloqueado}
                >
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                  <option value="24">24 meses</option>
                  <option value="36">36 meses</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="curp" className="mb-1 block text-sm font-medium text-slate-700">
                CURP
              </label>
              <input
                id="curp"
                type="text"
                name="curp"
                value={formData.curp}
                onChange={handleChange}
                className={`${inputClass} uppercase`}
                placeholder="18 caracteres"
                maxLength={18}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                required
                disabled={bloqueado}
              />
            </div>

            <fieldset className="space-y-5 rounded-lg border border-slate-200 bg-[#F2F6FB] p-4 sm:p-5">
              <legend className="px-1 text-sm font-semibold text-slate-800">Tus documentos</legend>
              <p className="text-xs text-slate-600">
                Formatos aceptados: PDF, JPG o PNG. Asegúrate de que se lea bien.
              </p>

              <div>
                <label htmlFor="ine" className="mb-2 block text-sm font-medium text-slate-700">
                  Identificación oficial (INE)
                </label>
                <input
                  id="ine"
                  type="file"
                  name="ine"
                  accept="image/png, image/jpeg, application/pdf"
                  onChange={handleFileChange}
                  className={fileClass}
                  disabled={bloqueado}
                />
                {formData.ine && (
                  <p className="mt-2 break-all text-xs text-slate-600">
                    Archivo seleccionado: {nombreArchivo(formData.ine)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reciboLuzAgua" className="mb-2 block text-sm font-medium text-slate-700">
                  Comprobante de domicilio (luz o agua){' '}
                  <span className="font-normal text-slate-500">(opcional)</span>
                </label>
                <input
                  id="reciboLuzAgua"
                  type="file"
                  name="reciboLuzAgua"
                  accept="image/png, image/jpeg, application/pdf"
                  onChange={handleFileChange}
                  className={fileClass}
                  disabled={bloqueado}
                />
                {formData.reciboLuzAgua && (
                  <p className="mt-2 break-all text-xs text-slate-600">
                    Archivo seleccionado: {nombreArchivo(formData.reciboLuzAgua)}
                  </p>
                )}
              </div>
            </fieldset>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/dashboard"
                className="flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={bloqueado}
                className="h-12 rounded-lg bg-[#0F2B52] px-6 font-semibold text-white hover:bg-[#1B4079] disabled:bg-slate-400"
              >
                {loading ? 'Enviando...' : exito ? 'Solicitud enviada' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}