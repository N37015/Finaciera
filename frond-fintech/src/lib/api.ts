const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  let token = '';
  if (typeof window !== 'undefined') {
    token = sessionStorage.getItem('token') || '';
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
      window.location.href = '/login';
      return;
    }

    const error = await response.json().catch(() => ({}));
    console.error("Detalle del error del backend:", error);
    throw new Error(error.Mensaje || 'Ocurrió un error en la petición');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}