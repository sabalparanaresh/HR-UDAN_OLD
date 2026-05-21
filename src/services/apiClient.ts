export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = import.meta.env.VITE_API_KEY || 'dev-api-key';
  
  let sessionToken = '';
  try {
    const authStoreString = localStorage.getItem('AuthStore');
    if (authStoreString) {
      const parsed = JSON.parse(authStoreString);
      if (parsed?.state?.user?.token) {
        sessionToken = parsed.state.user.token;
      }
    }
  } catch(e) {}

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-app-token': token,
      ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(`API Client Error: ${errorMessage}`);
  }

  return response.json();
}

export async function invokeCommand<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  const token = import.meta.env.VITE_API_KEY || 'dev-api-key';
  
  // Retrieve the authStore state to get the token without tying to React lifecycle
  let sessionToken = '';
  try {
    const authStoreString = localStorage.getItem('AuthStore');
    if (authStoreString) {
      const parsed = JSON.parse(authStoreString);
      if (parsed?.state?.user?.token) {
        sessionToken = parsed.state.user.token;
      }
    }
  } catch(e) {}

  const response = await fetch('/api/data-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-token': token,
      ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
    },
    body: JSON.stringify({ cmd, args: args || {} }),
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(`API Client Error: ${errorMessage}`);
  }

  return response.json();
}
