const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MatchaApiError extends Error {
  constructor(message, { status = null, requestId = null, retryAfter = null, ambiguous = false, cause } = {}) {
    super(message, { cause });
    this.name = 'MatchaApiError';
    this.status = status;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.ambiguous = ambiguous;
  }
}

export function isMatchaUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function normalizeMatchaBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('BASE_URL must be a valid HTTPS MatchaOS API URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'matchaos.harriscomputer.com' ||
    (url.port && url.port !== '443') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/+$/, '') !== '/api'
  ) {
    throw new Error('BASE_URL must use the MatchaOS API host and end with /api.');
  }

  return `${url.origin}/api`;
}

export function createMatchaApi({ baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 120_000 }) {
  const normalizedBaseUrl = normalizeMatchaBaseUrl(baseUrl);
  if (!apiKey || /^\$\{[^}]+\}$/.test(apiKey) || /^your[_-]/i.test(apiKey)) {
    throw new Error('MATCHA_API_KEY is missing or still a placeholder.');
  }

  async function requestJson(path, { method = 'GET', headers = {}, body, requestTimeoutMs = timeoutMs } = {}) {
    const url = new URL(path.replace(/^\/+/, ''), `${normalizedBaseUrl}/`);
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          'matcha-api-key': apiKey,
          'User-Agent': 'MatchaOS-SDK/1.0',
          ...headers,
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (cause) {
      throw new MatchaApiError('Could not confirm the MatchaOS request result.', { ambiguous: true, cause });
    }

    const requestId = response.headers.get('x-request-id');
    const retryAfter = response.headers.get('retry-after');
    let responseText;
    try {
      responseText = await response.text();
    } catch (cause) {
      throw new MatchaApiError('Could not read the MatchaOS response.', {
        status: response.status,
        requestId,
        retryAfter,
        ambiguous: method === 'POST' || response.status >= 500,
        cause,
      });
    }
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (cause) {
      if (!response.ok) {
        throw new MatchaApiError(`MatchaOS request failed (HTTP ${response.status}).`, {
          status: response.status,
          requestId,
          retryAfter,
          ambiguous: response.status >= 500,
          cause,
        });
      }
      throw new MatchaApiError('MatchaOS returned an invalid response.', {
        status: response.status,
        requestId,
        retryAfter,
        ambiguous: method === 'POST',
        cause,
      });
    }

    if (!response.ok || data?.status === 'error') {
      throw new MatchaApiError(`MatchaOS request failed${response.status ? ` (HTTP ${response.status})` : ''}.`, {
        status: response.ok ? 502 : response.status,
        requestId,
        retryAfter,
        ambiguous: response.status >= 500 || (response.ok && method === 'POST'),
      });
    }

    return {
      data,
      status: response.status,
      requestId,
      retryAfter,
      rateLimitLimit: response.headers.get('x-ratelimit-limit'),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      warnings: response.headers.get('x-matcha-warnings') || '',
      ignoredOptions: response.headers.get('x-matcha-ignored-options') || '',
    };
  }

  return {
    completeMission: async ({ missionId, input, context, options }) => {
      if (!isMatchaUuid(missionId)) {
        throw new Error('Matcha mission ID must be a UUID.');
      }
      if (typeof input !== 'string' || !input.trim()) {
        throw new Error('Matcha mission input must be a non-empty string.');
      }

      const request = await requestJson('v1/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id: missionId,
          input,
          ...(context ? { context } : {}),
          ...(options ? { options } : {}),
        }),
      });

      if (request.ignoredOptions) {
        throw new MatchaApiError('MatchaOS ignored a required request option.', {
          status: 502,
          requestId: request.requestId,
        });
      }

      if (request.data?.status !== 'success' || !Array.isArray(request.data.output)) {
        throw new MatchaApiError('MatchaOS returned an invalid mission response.', {
          status: 502,
          requestId: request.requestId,
        });
      }

      const outputText = request.data.output
        .flatMap(item => Array.isArray(item?.content) ? item.content : [])
        .filter(item => item?.type === 'output_text' && typeof item.text === 'string')
        .map(item => item.text.trim())
        .filter(Boolean)
        .join('\n\n');

      if (!outputText) {
        throw new MatchaApiError('MatchaOS returned no answer text.', {
          status: 502,
          requestId: request.requestId,
        });
      }

      const sources = request.data.output
        .flatMap(item => Array.isArray(item?.content) ? item.content : [])
        .flatMap(item => Array.isArray(item?.sources) ? item.sources : []);

      return { ...request, outputText, sources };
    },

    uploadFile: async ({ folderId, formData }) => {
      if (!isMatchaUuid(folderId)) {
        throw new Error('Matcha folder ID must be a UUID.');
      }
      const request = await requestJson(`v1/folders/${encodeURIComponent(folderId)}/files`, {
        method: 'POST',
        headers: formData.getHeaders(),
        body: formData,
      });
      if (request.status !== 201 || !isMatchaUuid(request.data?.id)) {
        throw new MatchaApiError('MatchaOS accepted an upload but returned no usable file ID.', {
          status: 502,
          requestId: request.requestId,
          ambiguous: true,
        });
      }
      return request;
    },

    getFile: async (fileId) => {
      if (!isMatchaUuid(fileId)) {
        throw new Error('Matcha file ID must be a UUID.');
      }
      return requestJson(`v1/files/${encodeURIComponent(fileId)}`, { requestTimeoutMs: 15_000 });
    },
  };
}
