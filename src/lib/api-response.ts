type ErrorPayload = { error?: string };

function errorMessageForResponse(response: Response, raw: string) {
  const normalized = raw.toLowerCase();
  if (response.status === 413 || normalized.includes('request entity too large') || normalized.includes('payload too large')) {
    return 'The rendered scan is too large for the server. Use a smaller or lower-resolution scan, or upload fewer pages.';
  }
  if (response.status === 429) {
    return 'The AI request limit was reached. Please wait a minute and try again.';
  }
  if (raw.trim()) return `The server could not analyze this document (HTTP ${response.status}).`;
  return `The server could not analyze this document (HTTP ${response.status}).`;
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let payload: unknown;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(errorMessageForResponse(response, raw));
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof (payload as ErrorPayload).error === 'string'
      ? (payload as ErrorPayload).error
      : errorMessageForResponse(response, raw);
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('The server returned an empty or invalid document response. Please try again.');
  }

  return payload as T;
}
