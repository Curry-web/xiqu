const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8788'

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `API request failed: ${response.status}`
    throw new Error(message)
  }

  return data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  return parseResponse<T>(response)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return parseResponse<T>(response)
}
