const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1';

async function request(url: string, options?: RequestInit) {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && token !== 'undefined' && token !== 'null') headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const res = await fetch(`${API_BASE}${url}`, { 
      ...options, 
      credentials: 'include',
      headers: { ...headers, ...options?.headers } 
    });
    
    if (!res.ok) {
      let errMessage = `Request failed (${res.status})`;
      try {
        const err = await res.json();
        errMessage = err.error || err.message || errMessage;
      } catch (e) {
        errMessage = res.statusText || errMessage;
      }
      console.error(`API Error [${res.status}] ${url}:`, errMessage);
      
      if (res.status === 401 && (errMessage === 'User no longer exists' || errMessage === 'Invalid token')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
      }
      
      throw new Error(errMessage);
    }
    return res.json();
  } catch (e: any) {
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      console.error('Network error or CORS issue. Check if API_URL is correct:', API_BASE);
      throw new Error('Network error: Unable to reach the server. Please check your internet or API configuration.');
    }
    throw e;
  }
}

export const api = {
  get: (url: string) => request(url),
  post: (url: string, body: any) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url: string, body: any) => request(url, { method: 'PUT', body: JSON.stringify(body) }),
  del: (url: string, body: any) => request(url, { method: 'DELETE', body: JSON.stringify(body) }),
};
