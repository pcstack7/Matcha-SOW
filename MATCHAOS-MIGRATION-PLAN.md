# MatchaOS mission integration migration plan

> Internal use only: this plan incorporates a proprietary team reference. Share it only through authorized channels.

## Scope and evidence

Implementation has been applied to the application code and example documentation. The user's `.env` was not edited, and no credentials, database records or live MatchaOS resources were changed by this implementation.

Based on the supplied `matchaos-openapi.json` (OpenAPI 3.1.0, API version 0.9.2), the [published API documentation](https://matchaos.harriscomputer.com/api), the [team migration guide v1.8](../Missions/MatchaOS-API-Migration-Quick-Reference-Guide-v1.8.pdf) (November 13, 2026; outside this repository), and direct inspection of the current application. The guide's latest Mission-file observations target API v0.9.0; use the newer supplied and published v0.9.2 contract for endpoint behavior, and validate deployment-specific observations on the target environment.

The local environment was checked on November 20, 2026, without displaying the key or identifiers. The initial check found the retired base URL; after the user updated `.env`, a second redacted check confirmed that it now points to the MatchaOS `/api` root and that the configured IDs are UUID-shaped:

- The API key is present; its validity and permissions have not been tested.
- Workspace, generation mission, knowledge-bank folder, extraction mission and extraction folder identifiers are present and UUID-shaped.
- UUID shape does not prove that these resources exist, belong together or are accessible.

The server rejects retired Matcha/MDS hosts, non-HTTPS base URLs, missing IDs and non-UUID IDs. Redirects are rejected so the key is not sent to another host. This check does not establish that the key has been exposed; inspect the effective configuration of any running deployment separately.

No authenticated live requests, uploads or model calls were made.

Local validation completed: JavaScript syntax checks, eight mocked Matcha client tests, an isolated SQLite legacy-schema migration/operation check, and a frontend production build. The build passes with Vite's existing large-chunk advisory. Live authentication, Mission permissions, source retrieval, extraction parity, and Matcha indexing remain unverified and are still release gates.

The application uses Missions directly. A search of its source and configuration files found no MDS/Langflow or FlowBuilder call sites. The guide's direct-provider model catalog, FlowBuilder migration and provider-specific tuning are therefore not implementation requirements for this project unless a separate integration is discovered. The guide's separate ID-reference, migration-matrix and shared-client files are not present in this repository; do not assume they are available or introduce them without a need.

## Compatibility gaps found before implementation

| Area | Current application | MatchaOS contract | Required action |
| --- | --- | --- | --- |
| Base URL | Old `/rest/api/v1` host/path | Server root is `https://matchaos.harriscomputer.com/api`; mission routes start with `/v1` | Update configuration and route construction together. |
| IDs | Numeric fallback values; extraction uses `parseInt` | Mission, folder, file and workspace IDs are UUID strings | Remove legacy numeric defaults and preserve strings. `parseInt` can yield a partial number or `NaN`, serialized as `null`. |
| Authentication | `MATCHA-API-KEY` header | `matcha-api-key` remains supported | Keep this authentication mechanism; HTTP header names are case-insensitive. Do not send competing credential headers. |
| Completions | `/completions`, `mission_id`, `input` | `/v1/completions`; same fields with UUID IDs | Update all three call sites. Existing response text nesting remains compatible. |
| Knowledge-bank upload | `/file?folder_id=...` | `POST /v1/folders/{folderId}/files` | Replace route; retain multipart `file`; validate the returned UUID `id`. |
| Upload readiness | Treats accepted upload as success | HTTP 201 means stored and queued, not searchable | Track processing through `GET /v1/files/{fileId}`. |
| Extraction isolation | `context` plus `options.llmChatOnly: true` | `context` is supported; `llmChatOnly` is ignored | Remove unsupported option; explicitly address retrieval isolation. |
| Diagnostics | Mostly checks HTTP status; placeholder text on missing output | Legacy error envelope plus warning/ignored-option/request-ID headers | Validate envelopes and text; surface degraded retrieval and failures. |

These code paths are now updated. See [the Matcha API client](./services/matcha-api.js), [server configuration](./server.js), [upload sync persistence](./database.js), and [Knowledge Bank status UI](./src/components/UploadedSOWManagement.jsx).

## Team-guide coverage and conflicts

| Guide topic | Plan coverage |
| --- | --- |
| Key, gateway health, UUID discovery and access (pp. 3, 14-16) | Sections 1 and 6: safe configuration, authenticated health check, resource relationships, permissions and grounding preflight. |
| Behavioral-parity gate (pp. 4-6) | Section 6: predefined criteria, paired/repeated synthetic fixtures, settings comparison, evidence and owner approval. |
| Mission request/response, supported scope and warnings (pp. 6, 10, 14-16) | Sections 2, 3 and 6: single scope, all output blocks, ignored options, source evidence and isolation. |
| File queue, limits, duplicates and permissions (pp. 7, 15-16) | Sections 4-5: persistent processing states, `Retry-After`, queue pressure, safe reconciliation and explicit partial failure. |
| First-byte timeout and tuning (pp. 14, 17-21) | Sections 2 and 6: assess long Mission calls explicitly; provider-specific streaming/effort settings are not assumed to apply to Missions. |
| MDS/Langflow, FlowBuilder and direct-provider recipes (pp. 3-4, 8-9, 11-13) | Not used by the inspected application; re-evaluate only if another integration is identified. |

The guide's migration procedure on page 4 says to treat Mission-file uploads as blocked, but its later v1.8 file-management guidance on pages 15-16 and the v0.9.2 specification document supported upload and processing endpoints. Treat that page-4 instruction as superseded for API availability; a particular deployment remains blocked until its permissions, upload and indexing are verified.

## 1. Configuration and read-only preflight

Use one base-URL convention throughout:

```env
BASE_URL=https://matchaos.harriscomputer.com/api
```

Append `/v1/completions`, `/v1/folders/{folderId}/files`, etc. in code. Normalize trailing slashes so neither `/api/api` nor `/v1/v1` is produced.

- Keep the existing `MATCHA_API_KEY` variable; the guide's `MATCHAOS_API_KEY` is a naming example, not a required rename.
- Require a nonempty key and valid main mission/folder/workspace UUIDs; reject legacy numeric IDs and unexpanded credential placeholders with actionable configuration errors.
- Validate the effective runtime base URL before attaching credentials. Require the documented HTTPS MatchaOS host and `/api` path; reject retired/other hosts and redirects. Use injected mock transport rather than sending credentials to test hosts.
- Keep extraction optional: an absent extraction mission should preserve the existing feature-specific 503, not disable the whole application. Reject a malformed configured extraction mission explicitly.
- `WORKSPACE_ID` is currently unused in outgoing requests; use it for relationship verification, not as an undocumented completion-body field.
- `EXTRACTION_FOLDER_ID` is currently unused because extraction reads files locally. Do not require it unless the approved extraction design needs it.
- After approval, run read-only resource checks using the configured key:
  - `GET /v1/models` checks gateway reachability and key authentication without a model completion; it does not prove Mission access. Send one supported credential header and the explicit `User-Agent` described below.
  - `GET /v1/workspaces/{workspaceId}`.
  - `GET /v1/missions/{missionId}` and compare `workspaceId`.
  - `GET /v1/folders/{folderId}` and compare `missionId`.
  - If discovery is needed, use `GET /v1/missions?workspace_id=...` and `GET /v1/missions/{missionId}/folders`, following pagination. Confirm name matches with the Mission owner; never derive UUIDs from old numeric IDs.
  - Check the extraction mission and its intended workspace separately.
  - Compare generation/extraction personas, chat-model settings, retrieval scope, available documents and effective Mission options with the legacy configuration. Record unknown or unsupported settings; do not assume unchanged defaults.
  - Verify `canEdit` and that the upload folder is not the protected `isSystem` Corrections folder. A read-only check does not itself prove a write will succeed.
- Stop on authentication, access or relationship failures; do not guess substitute IDs. A 404 can mean absent **or not visible**; a 403 can indicate insufficient write access or WAF rejection.

## 2. Migrate shared request handling and all completion callers

Extract a small shared Matcha request/completion helper rather than repeating migration logic in [server.js](./server.js). Use existing `node-fetch` and multipart dependencies; no SDK replacement or TypeScript conversion is needed.

- Apply the new route and unchanged UUID string to SOW generation, `/chat`, and document extraction.
- Send an explicit `User-Agent: MatchaOS-SDK/1.0` on MatchaOS requests, as recommended by the guide to avoid WAF blocks; retain the supported `matcha-api-key` header without adding competing credentials.
- Send exactly one of `mission_id`, `folder_id` or `file_id`, and `input` or `messages`, not both. The existing application is mission-scoped; do not introduce legacy options such as `foldersToInclude`.
- Preserve existing prompts, template structure enforcement, curated assumptions/out-of-scope handling and application response shapes. Keep non-streaming only if the long-call assessment below passes.
- Require a success envelope and nonempty `output_text` before saving an SOW or returning a successful chat response. Assemble all assistant `output_text` blocks in order rather than assuming only the first block exists. Remove success-shaped placeholders such as "No response generated."
- Handle non-JSON upstream errors, HTTP failures, legacy error envelopes and malformed success bodies explicitly.
- Capture HTTP status, elapsed time, `x-request-id`, `x-matcha-warnings`, `x-matcha-ignored-options` and rate-limit/`Retry-After` information without logging credentials, user content, personas, prompts, document contents or model responses. Optional `includeUsageMetadata` can provide token counts if approved.
- Treat an ignored option needed for the requested behavior as an explicit failure or an owner-approved difference, not just a log entry.
- Add bounded request timeouts. Do not automatically repeat uploads or paid completion requests after ambiguous network failures; a repeated request may duplicate work or cost.
- Where mission documents are expected, surface `retrieval_unavailable` or `file_unavailable` as an actionable failure rather than silently saving an ungrounded SOW.

### Long-response and streaming decision

The guide observed a roughly 30-second first-byte gateway timeout and failures for long **direct chat-completion** calls. It does not establish the same failure rate for this application's Mission endpoint. A longer application timeout alone cannot fix an upstream gateway timeout, and not every 502 is necessarily a timeout.

- Test representative and worst-case SOW generation and extraction requests against the actual Mission endpoint, including repeated long outputs and large contexts. Record first-byte/total latency, 502s, completeness and proxy behavior against criteria agreed in advance.
- The Mission schema supports `stream: true`, but the supplied specification does not define the SSE event schema. If streaming is required, obtain and verify its Mission-specific event/error/terminal contract before implementing it. Assemble the full response server-side and retain the application's JSON response shape; never persist partial output as success.
- Do not copy direct-model `reasoning_effort`, `max_completion_tokens`, `finish_reason` or SSE handling into Mission requests as if they were documented Mission controls. The Mission API exposes different options, including `useReasoning`; changing model or reasoning settings requires parity testing and approval.
- If reliable long responses or complete-output detection cannot be demonstrated, mark that capability blocked rather than claiming migration parity.

## 3. Preserve document-extraction behavior

Keep local PDF/DOCX/TXT/XLSX text extraction and the existing `context` payload as the minimal migration. Pass the extraction mission UUID directly and remove `llmChatOnly`.

Important limitation: the documented mission endpoint has no supported switch that guarantees retrieval is disabled. `context` supplements the persona; it does not replace mission document retrieval.

Recommended approach, requiring verification before release:

- Use a dedicated extraction mission with the expected extraction persona and no indexed reference documents.
- Explicitly disable web search for extraction using the supported `useWebSearch: false` option.
- During acceptance testing, request sources and check that unrelated documents are not used; this is evidence of behavior, not an API guarantee of isolation.
- Use fixtures containing known project notes and deliverables to compare the new response against expected facts.
- Validate returned JSON: `project_notes` and `deliverables` must be strings, and a wholly empty or invalid result should produce a clear extraction error, not raw model prose presented as success. A single field may legitimately be empty when the source has no corresponding information; cover that case in parity testing.
- Preserve `files_processed` and local temporary-file cleanup.
- Record and test the existing limit of five files and 80,000 JavaScript string code units of extracted text per file, including facts beyond the cutoff and partial/unreadable files. Check the serialized request against the API's 20 MB body limit. Do not silently remove or enlarge the per-file cap during the migration; decide with the owner whether to warn users about truncation or change budgets after parity and cost testing.

If strict retrieval-free isolation is mandatory, stop and confirm a supported alternative with MatchaOS or approve a provider-endpoint design with explicit extraction instructions. Do not silently switch away from the mission persona.

Native attachments via `messages` are supported, but adopting them is optional and outside this minimal migration; the schema requires `input` or `messages`, not both.

## 4. Migrate uploads and expose processing state

- Upload to `/v1/folders/{folderId}/files`, preserving the multipart boundary.
- Agree the remote filename behavior: the current upload derives a timestamp/random-prefixed name from the local disk path, while the local record stores the original name. Sending the original name is a visible behavior change and increases the chance of same-name duplicates; preserve the current behavior or obtain approval for the change.
- Validate HTTP success, returned file UUID, and folder/mission association.
- Keep the application's existing 10 MiB (`10 * 1024 * 1024` bytes) per-file upload limit; the API's 50 MB allowance does not require expanding product limits.
- Distinguish local save, remote acceptance and search readiness.
- Recommended behavior: preserve local knowledge-bank saves even when remote upload fails, but return and display an explicit Matcha sync failure. Do not report an unqualified successful integration.
- Persist sync state/error alongside `matcha_file_id` so queued work and failures survive restarts. Use a small additive SQLite migration and existing database conventions.
- Persist a local upload intent before the remote request. If the remote POST may have succeeded but its response or local update was lost, mark the result unknown and reconcile before retrying; the documented API provides no idempotency key and same-name POSTs create duplicates.
- Poll file details while `processing.status` is `queued` or `running`, respecting `Retry-After`, with bounded polling and resumable status checks after restart. The guide observed processing taking over a minute for some files; choose and test a realistic polling budget. An expired polling window is unknown/pending, not proof of failure. Avoid holding the original upload request open for the entire indexing operation.
- Mark ready only on `done`; `indexed: true` can represent partial or previous content. Show `processing.error` on failure. A legacy `null` processing status is unknown, not automatically ready.
- Handle 403 access/protected-folder errors, 413 size errors, and 429 queue saturation clearly. The API permits at most 20 files queued or processing; use bounded concurrency and honor `Retry-After`. Retry a confirmed 409 ID clash only within a bounded policy; do not blindly replay ambiguous uploads.
- Update [UploadedSOWManagement.jsx](./src/components/UploadedSOWManagement.jsx#L183), which currently ignores the successful upload response, to show pending/ready/failed sync state and actionable errors.

The existing [matcha_file_id column](./database.js#L276) is already `TEXT`, so UUID storage itself needs no schema change. Local account/SOW/product IDs remain integers.

## 5. Verify historical knowledge-bank continuity

- Back up the database and local uploaded files before any reconciliation.
- Inventory existing remote file references using read-only checks. Page `GET /v1/folders/{folderId}/files` until `hasMore` is false; retry transient listing failures with bounds and never interpret a failed page as an empty folder. Do not assume old numeric remote file IDs map to new UUIDs.
- Confirm whether MatchaOS already contains migrated documents in the configured mission/folder before re-uploading.
- Reconcile references from a verified migration mapping, or approve a deduplicated re-upload from available local originals. Same names can represent distinct files, and the documented File schema has no content hash/ETag. Names, sizes and timestamps alone are not proof of identity; if needed, compare local and approved remote content hashes without logging document contents.
- Do not rewrite IDs or bulk-upload files during the application code migration without approval.
- Preserve existing local deactivate/reactivate behavior; these operations currently do not modify remote files. Adding remote deletion or retrieval exclusion is a separate product decision.

## 6. Focused validation and acceptance

No project test script or conventional `*.test.*`/`*.spec.*` files were found. Add a few focused tests using Node's built-in test runner and injected/mock transport; no new test dependency is required.

Cover:

1. New URL construction, explicit User-Agent, rejection of retired hosts/placeholders and redirects, and exact UUID-string payloads for all three completion routes, including alphabetic- and numeric-leading extraction UUIDs.
2. Multiple ordered output blocks, legacy error envelopes, non-JSON 502s, missing/empty text, malformed JSON, retrieval warnings and ignored required options; failures must not create a successful SOW.
3. Extraction omits `llmChatOnly`, preserves supplied document context, validates its two output fields, and handles the existing truncation and partial-file cases.
4. Multipart upload uses the folder-path endpoint and agreed filename; the exact 10 MiB local limit is enforced; UUIDs persist; remote failure or an ambiguous POST does not appear as full sync success or trigger a duplicate.
5. Queued/running/done/error and unknown processing states, `Retry-After`, queue saturation, timeout, pagination failures and restart recovery.

Then run targeted tests, `node --check` on changed backend JavaScript and `npm run build` for any UI changes.

### Behavioral-parity acceptance gate

1. Before testing, agree measurable criteria and repeat counts: critical cases must pass, and set any aggregate quality, latency and error-rate thresholds in advance. Use synthetic, non-PHI fixtures for normal, boundary, invalid, structured-output, refusal/safety and grounded cases.
2. Compare effective legacy and target settings: model/version, persona, prompt/context, history, file inputs, token and character limits, sampling/reasoning, web search, retrieval scope/corpus, timeouts and retry behavior. Mark each matched, changed, unsupported or unknown, with impact and disposition. Keep sensitive settings in approved storage; do not log production prompts.
3. Run paired, repeated tests with equivalent inputs and reset history against both systems when approved and available. Judge required facts and contract behavior, not identical wording; the old answer alone is not the oracle. If the legacy system is unavailable, use previously validated synthetic baselines and record their date and limits. Without a trustworthy baseline, legacy parity remains unverified.
4. For grounded fixtures, use `includeSources: true`, require at least one relevant source from the expected accessible corpus, and check that citations support the answer. An empty warning header or plausible answer alone does not establish grounding.
5. Record a per-capability outcome: **PASS**, **PASS WITH APPROVED DIFFERENCES**, or **BLOCKED / FAIL**. Keep fixture IDs, configuration references, dates, repeat/pass counts, latency/error summaries, known gaps and owner approvals; never record keys, PHI/PII or raw production content. Report code migration and behavioral acceptance separately.

After approval, perform live acceptance with non-sensitive fixtures:

- Read-only key/resource/access preflight passes.
- Generate repeated SOWs, including long-output cases; verify relevant sources, mission-grounded facts, completeness, template headings and exact curated assumptions/out-of-scope items. Inspect synthetic raw generation as well as final output so template post-processing cannot hide an incomplete response.
- Check `/chat` retains its response shape.
- Extract known notes/deliverables from supported document types, including boundary-sized and multi-file cases, without unrelated knowledge contamination.
- Upload a fixture, observe queued-to-done processing, then demonstrate retrieval of a unique fact from it. Storage acceptance alone is not sufficient.
- Exercise visible upload/access/indexing failure paths and the 429/502/timeout behavior.
- Verify existing SOW viewing and DOCX/PDF exports still work.
- Before cutover, run the authenticated models health check and an approved synthetic Mission smoke test from the actual deployment host to verify its effective configuration, egress, WAF and Mission access.

Live calls may incur model charges and create remote files; run only with approved test data and clean up only specifically identified test files after approval.

## 7. Documentation, rollout and release gates

- Update [.env.example](./.env.example), [README.md](./README.md#L77) and [DEPLOYMENT.md](./DEPLOYMENT.md#L153) with the new base URL, UUID placeholders, optional extraction configuration and upload-processing semantics.
- Never put real API keys or environment identifiers into documentation or commits.
- Deploy to a test instance first. Do not cut over production, remove legacy credentials or alter production integrations without explicit owner approval. Update production code and base URL together and restart the process to reload environment settings.
- Preserve a rollback copy of code/configuration and database backup. Reverting code alone will not restore service if the old API/key is no longer available; confirm legacy availability before relying on that rollback.

Owner decisions before implementation or release: extraction-isolation requirements; local-save behavior on remote failure; remote filename policy; historical-file reconciliation; long-call mode if required; and acceptance thresholds or any approved behavior differences.

Release gates:

- All completion/upload callers use the new API and UUID strings.
- Resource ownership, permissions, personas and knowledge migration are verified, with relevant sources for grounded fixtures.
- Extraction isolation is accepted or its alternative is explicitly approved.
- Failed, unknown, pending and completed remote sync states are visible and persistent.
- Focused tests, build and approved end-to-end checks pass. Required capabilities are not left blocked or unverified; any accepted differences have explicit owner approval.

Implementation order: configuration/preflight -> shared completion migration -> extraction verification -> upload processing/UI -> approved historical reconciliation -> acceptance -> production rollout.
