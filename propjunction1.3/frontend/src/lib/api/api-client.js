class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  constructor() {
    // Rely on Vite proxy or fallback to localhost
    this.baseUrl = '/api/v1';
  }

  resolveUrl(path, params) {
    const url = new URL(`${window.location.origin}${this.baseUrl}/${path.replace(/^\/+/, '')}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }
    return url;
  }

  async request({ path, method = 'GET', params, data, signal }) {
    const url = this.resolveUrl(path, params);
    const headers = {
      Accept: 'application/json',
    };

    if (data !== undefined && data !== null && !(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const body =
      data === undefined || data === null || method === 'GET' || method === 'DELETE'
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal
      });

      if (response.status === 204) {
        return null;
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new ApiError(
          payload?.detail ?? 'The request could not be completed.',
          response.status,
          payload
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Network error occurred.', 0, error);
    }
  }

  get(path, options = {}) {
    return this.request({ ...options, path, method: 'GET' });
  }

  post(path, data, options = {}) {
    return this.request({ ...options, path, method: 'POST', data });
  }

  patch(path, data, options = {}) {
    return this.request({ ...options, path, method: 'PATCH', data });
  }

  delete(path, options = {}) {
    return this.request({ ...options, path, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
