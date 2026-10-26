const MAX_RETRIES = 3;

// Accepts the instance URL with or without the trailing /api.
export function normalizeBaseUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function errorMessage(status, body) {
  if (body && typeof body === "object" && typeof body.message === "string") {
    return body.message;
  }
  if (typeof body === "string" && body.length > 0) return body.slice(0, 500);
  return `HTTP ${status}`;
}

export class KaneoRequestError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path}: ${errorMessage(status, body)} (${status})`);
    this.status = status;
  }
}

export function createKaneoClient({ baseUrl, apiKey, fetchImpl = fetch }) {
  const root = normalizeBaseUrl(baseUrl);

  async function request(method, path, body, attempt = 0) {
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    // API keys are limited to 100 requests per minute.
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const seconds = Number(response.headers.get("retry-after")) || 10;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return request(method, path, body, attempt + 1);
    }

    const text = await response.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!response.ok) {
      throw new KaneoRequestError(method, path, response.status, parsed);
    }
    // The web app answers every path with its HTML page, so a URL pointing at
    // the web dev server instead of the API ends up here.
    if (typeof parsed === "string") {
      throw new Error(
        `${method} ${path}: Antwort ist kein JSON. Zeigt KANEO_API_URL (${root}) auf die API?`,
      );
    }
    return parsed;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),
  };
}
