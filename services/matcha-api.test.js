import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchaApi, isMatchaUuid, MatchaApiError, normalizeMatchaBaseUrl } from './matcha-api.js';

const BASE_URL = 'https://matchaos.harriscomputer.com/api';
const API_KEY = 'test-key-not-for-network';
const MISSION_ID = '6f1c2a3e-5b7d-4c8e-9a1b-2c3d4e5f6a7b';
const FOLDER_ID = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b';
const FILE_ID = '0b5d6c7e-1f2a-4b3c-8d9e-0f1a2b3c4d5e';

function response(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), { status, headers });
}

test('requires a MatchaOS API base URL and UUID-shaped resource IDs', () => {
  assert.equal(normalizeMatchaBaseUrl(`${BASE_URL}/`), BASE_URL);
  assert.throws(() => normalizeMatchaBaseUrl('https://matcha.harriscomputer.com/rest/api/v1'));
  assert.throws(() => normalizeMatchaBaseUrl('https://example.com/api'));
  assert.equal(isMatchaUuid(MISSION_ID), true);
  assert.equal(isMatchaUuid('1234'), false);
  assert.throws(() => createMatchaApi({ baseUrl: BASE_URL, apiKey: 'your_matcha_api_key_here' }));
});

test('calls the v1 mission endpoint with string IDs, required headers, and ordered output text', async () => {
  let captured;
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return response({
        status: 'success',
        output: [
          { content: [{ type: 'output_text', text: 'First block' }, { type: 'other', text: 'ignored' }] },
          { content: [{ type: 'output_text', text: 'Second block' }] },
        ],
      }, { headers: { 'x-request-id': 'request-1', 'x-matcha-warnings': '' } });
    },
  });

  const result = await api.completeMission({
    missionId: MISSION_ID,
    input: 'Question',
    context: 'Context',
    options: { useWebSearch: false },
  });

  assert.equal(captured.url, `${BASE_URL}/v1/completions`);
  assert.equal(captured.options.headers['matcha-api-key'], API_KEY);
  assert.equal(captured.options.headers['User-Agent'], 'MatchaOS-SDK/1.0');
  assert.equal(captured.options.redirect, 'error');
  assert.deepEqual(JSON.parse(captured.options.body), {
    mission_id: MISSION_ID,
    input: 'Question',
    context: 'Context',
    options: { useWebSearch: false },
  });
  assert.equal(result.outputText, 'First block\n\nSecond block');
  assert.equal(result.requestId, 'request-1');
});

test('rejects invalid mission IDs and empty mission answers', async () => {
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async () => response({ status: 'success', output: [] }),
  });

  await assert.rejects(api.completeMission({ missionId: '7618', input: 'Question' }), /UUID/);
  await assert.rejects(api.completeMission({ missionId: MISSION_ID, input: 'Question' }), MatchaApiError);
});

test('uploads to the UUID folder path and retains the returned processing status', async () => {
  let captured;
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return response({
        id: FILE_ID,
        missionId: MISSION_ID,
        folderId: FOLDER_ID,
        processing: { status: 'queued', error: null },
      }, { status: 201, headers: { 'retry-after': '5' } });
    },
  });
  const formData = { getHeaders: () => ({ 'content-type': 'multipart/form-data; boundary=test' }) };

  const uploaded = await api.uploadFile({ folderId: FOLDER_ID, formData });

  assert.equal(captured.url, `${BASE_URL}/v1/folders/${FOLDER_ID}/files`);
  assert.equal(captured.options.headers['content-type'], 'multipart/form-data; boundary=test');
  assert.equal(uploaded.data.id, FILE_ID);
  assert.equal(uploaded.retryAfter, '5');
});

test('reads remote file processing state from the UUID file endpoint', async () => {
  let capturedUrl;
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async url => {
      capturedUrl = String(url);
      return response({ id: FILE_ID, processing: { status: 'done', error: null } });
    },
  });

  const result = await api.getFile(FILE_ID);

  assert.equal(capturedUrl, `${BASE_URL}/v1/files/${FILE_ID}`);
  assert.equal(result.data.processing.status, 'done');
});

test('returns retrieval warnings for callers to fail closed', async () => {
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async () => response({
      status: 'success',
      output: [{ content: [{ type: 'output_text', text: 'Ungrounded answer' }] }],
    }, { headers: { 'x-matcha-warnings': 'retrieval_unavailable' } }),
  });

  const result = await api.completeMission({ missionId: MISSION_ID, input: 'Question' });

  assert.equal(result.warnings, 'retrieval_unavailable');
});

test('handles non-JSON upstream failures and preserves request diagnostics', async () => {
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async () => new Response('<html>gateway error</html>', {
      status: 502,
      headers: { 'x-request-id': 'request-502', 'retry-after': '5' },
    }),
  });

  await assert.rejects(
    api.completeMission({ missionId: MISSION_ID, input: 'Question' }),
    error => error instanceof MatchaApiError &&
      error.status === 502 &&
      error.requestId === 'request-502' &&
      error.retryAfter === '5',
  );
});

test('marks network failures ambiguous so callers do not blindly repeat uploads', async () => {
  const api = createMatchaApi({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl: async () => { throw new Error('network unavailable'); },
  });
  const formData = { getHeaders: () => ({}) };

  await assert.rejects(
    api.uploadFile({ folderId: FOLDER_ID, formData }),
    error => error instanceof MatchaApiError && error.ambiguous === true && error.status === null,
  );
});
