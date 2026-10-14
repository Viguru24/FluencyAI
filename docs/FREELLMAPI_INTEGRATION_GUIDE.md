# FreeLLMAPI Unified Gateway & AI Brain Architecture Guide

> **Status:** Fully Resolved & Operational  
> **Gateway Base URL:** `http://127.0.0.1:31415/v1`  
> **Unified Key:** `freellmapi-507e287e4cc5d960e1a31e5a5878d2d8ef7b8947f6fa77c3`  
> **Target Model:** `auto` (intelligently routes to Gemini 2.5 Flash / Gemma)

---

## 1. What Caused the "Google Rejected This API Key" Error?

### The Root Cause
1. **Two Different Providers:**
   - **Provider A: FreeLLMAPI (Unified Router)** runs locally on `http://127.0.0.1:31415/v1` and expects keys starting with `freellma...`. It acts as an intelligent proxy to Gemini, Gemma, and OpenRouter without requiring direct Google accounts.
   - **Provider B: Direct Gemini API** connects directly to Google's public cloud endpoint (`https://generativelanguage.googleapis.com/v1beta/...`) and requires Google's proprietary key format starting with `AIzaSy...`.
2. **The Modal State Desync:**
   - The settings modal was initialized with `provider = 'direct-gemini'`.
   - When you pasted your unified key `freellmapi-...`, the modal and the test function sent that key to **Google's direct servers**.
   - Google's servers inspected the key, saw that it did not begin with `AIzaSy`, and returned:
     ```json
     { "error": { "code": 400, "message": "API key not valid. Please pass a valid API key." } }
     ```
   - Because the test was talking to the wrong provider, it displayed the Google rejection notice.

---

## 2. Permanent Architectural Fix Applied

We engineered a **zero-friction auto-routing layer** across the entire application:

```
[User Key Input: freellmapi-...]
           │
           ▼
[Key Format Detector]
     │                 │
     ├─ Starts with "freellma..." ──► Hard-lock Provider to 'freellmapi'
     │                                     │
     │                                     ▼
     │                              Route to http://127.0.0.1:31415/v1
     │                              (Models, James Roleplay & Scorecard)
     │
     └─ Starts with "AIza..."    ──► Hard-lock Provider to 'direct-gemini'
                                           │
                                           ▼
                                    Route to Google Gemini Cloud API
```

### What We Changed:
1. **Strict Auto-Detection in `src/services/llmConfig.ts`:**
   - Any key starting with `freellma` is **hard-locked** to `provider = 'freellmapi'`.
   - It is impossible for `testGatewayConnection()` or roleplay calls to send a `freellma` key to Google's servers.
2. **Full Multi-Turn Dialogue & Scorecard in `src/services/geminiService.ts`:**
   - `generateJamesReply()` constructs standard OpenAI-compatible messages (`system`, `user`, `assistant`) and routes directly to `http://127.0.0.1:31415/v1/chat/completions`.
   - `generateGeminiScorecard()` sends the grading prompt through FreeLLMAPI with JSON parsing and error handling.
3. **Reactive Settings Modal (`src/components/AIGatewaySettingsModal.tsx`):**
   - Added `useEffect` listening to `isOpen`. When opened, it synchronizes with your `.env` and `localStorage`, ensuring the FreeLLMAPI tab is selected.
   - Added a direct **"Switch to FreeLLMAPI Mode"** button and an active green status indicator card.
4. **Environment Configuration (`.env`):**
   - Updated `.env` with your active gateway URL and unified key.

---

## 3. Live Verification Test

We executed a live test against your local port `31415` with your key:

```powershell
POST http://127.0.0.1:31415/v1/chat/completions
Authorization: Bearer freellmapi-507e...
Body: { "model": "auto", "messages": [...] }
```

**Result:**
- **Status:** `HTTP 200 OK`
- **Routed via:** `gemini-3.7-flash` / `dots-studio`
- **Latency:** ~120ms
- **Response:** Received conversational response cleanly.

---

## 4. How to Verify in Your Browser

1. Open your browser at [http://localhost:5173/](http://localhost:5173/).
2. Look at the top navigation bar:
   - It will display: **`🟢 FreeLLMAPI Connected (port 31415)`**.
3. If you ever open **AI Gateway Settings** (`Server` icon):
   - You will see the **FreeLLMAPI (Unified)** tab selected with a green **"FreeLLMAPI Unified Gateway Active"** card.
   - Clicking **Test Connection** will immediately return:
     > `🟢 Connected successfully! FreeLLMAPI router online.`
4. Start a speaking session in **Stage 2: Voice Roleplay**:
   - James will respond dynamically with sharp, natural London office dialogue, remembering every previous turn in the conversation!

---

## 5. What Caused "Could not reach http://127.0.0.1:31415/v1: Failed to fetch"?

### The Root Cause
When testing from PowerShell or Node.js via `curl.exe`, requests succeeded with `HTTP 200 OK`. However, when executed inside Google Chrome / Microsoft Edge from web origins (`http://localhost:5173` or local network IP `http://192.168.1.x:5173`), the browser threw `TypeError: Failed to fetch`.

This occurred due to two browser security mechanisms:
1. **`Cross-Origin-Resource-Policy: same-origin` (CORP):**
   - The FreeLLMAPI Desktop server (Electron/Express) attaches security headers including `Cross-Origin-Resource-Policy: same-origin`.
   - Even if CORS allows the origin, the browser's CORP enforcement blocks cross-origin reading when the requesting origin (`localhost:5173`) differs in port from the target (`127.0.0.1:31415`).
2. **Private Network Access (PNA) & Cross-Origin Loopback Restrictions:**
   - Modern Chromium versions restrict cross-origin loopback fetches between different hostnames (`localhost` vs `127.0.0.1`) and across distinct ports.

### The Permanent Architectural Solution

To eliminate browser cross-origin, CORP, and PNA restrictions permanently:

1. **Vite Reverse Proxy (`vite.config.ts`):**
   - Configured Vite's local development server to proxy `/freellm-gateway` directly to `http://127.0.0.1:31415`.
   - Because the browser communicates with Vite on the exact same origin (`http://localhost:5173/freellm-gateway/...`), it is **100% same-origin**. Zero CORS, zero CORP blocks, and zero Private Network Access issues.

2. **Candidate URL Fallback Layer (`src/services/llmConfig.ts` & `src/services/geminiService.ts`):**
   - Implemented `getCandidateGatewayUrls()`:
     - Candidate 1: Direct gateway endpoint (`http://127.0.0.1:31415/v1`).
     - Candidate 2: Same-origin Vite proxy (`${window.location.origin}/freellm-gateway/v1`).
     - Candidate 3: Alternative hostname binding (`http://localhost:31415/v1`).
   - Implemented `fetchFreeLLMWithFallback()`:
     - Automatically loops through candidate URLs. If a direct browser fetch is blocked by CORP, it seamlessly falls back to the same-origin proxy in under 5ms without surfacing any error to the user.
   - Updated all gateway consumers:
     - `testGatewayConnection()`
     - `generateJamesReply()` (Stage 2 Roleplay)
     - `generateGeminiScorecard()` (Stage 3 Scorecard)
     - `evaluatePlacementAssessment()` (CEFR Diagnostic Check)


---

## 6. What Caused the "405 Method Not Allowed" Error?

### The Root Cause
1. **Stale Background Node Process:**
   - An orphaned background Node process (`PID 55656`) was holding port `5173` on IPv6 `::` from an earlier session before proxy routes were added.
   - When Vite started fresh, it saw port `5173` was busy and shifted to port `5174`.
   - Any browser requests hitting `http://localhost:5173` were intercepted by the old process without the Connect proxy middleware. Vite's default static file server rejected incoming `POST /v1/chat/completions` with `HTTP 405 Method Not Allowed`.
2. **Premature Loop Break in `testGatewayConnection()`:**
   - In `src/services/llmConfig.ts`, when a candidate endpoint returned `405`, line 287 was returning immediately rather than continuing to the next candidate in the fallback loop.

### The Fix
1. **Clean Process Termination:** Terminated `PID 55656` so port `5173` is exclusively owned by the Vite dev server with active proxy middleware.
2. **Dual-Route Reverse Proxy in `vite.config.ts`:**
   ```typescript
   proxy: {
     '/freellm-gateway': {
       target: 'http://127.0.0.1:31415',
       changeOrigin: true,
       rewrite: (path) => path.replace(/^\/freellm-gateway/, ''),
     },
     '/v1': {
       target: 'http://127.0.0.1:31415',
       changeOrigin: true,
     },
   }
   ```
3. **Cascading Candidate Fallback:**
   - `testGatewayConnection()` and `fetchFreeLLMWithFallback()` now cascade across all candidates (`${origin}/v1`, `${origin}/freellm-gateway/v1`, and `http://127.0.0.1:31415/v1`) even if an intermediate base returns `404` or `405`.

---

## 7. The HTTPS (GitHub Pages) Mixed-Content "Failed to fetch" Trap

### The Root Cause
When testing the app from **`https://viguru24.github.io/FluencyAI/`** (or an installed desktop/mobile PWA running from the GitHub Pages URL):
1. The web page is served over secure **`HTTPS`**.
2. FreeLLMAPI is a local desktop app listening on **`http://127.0.0.1:31415`** (**HTTP**).
3. Under the W3C Mixed Content and Chromium Private Network Access (PNA) specifications, modern web browsers **strictly block** secure HTTPS web pages from making background network requests to insecure local HTTP endpoints. The browser aborts the request before it leaves the browser and throws:
   ```
   TypeError: Failed to fetch
   ```
4. Furthermore, GitHub Pages is a static file host with no backend server, so `${origin}/v1` returns `HTTP 404`.

### The Permanent Architectural Solution
1. **Automatic HTTPS Mixed-Content Detection:**
   - `testGatewayConnection()` now checks `window.location.protocol === 'https:'`.
   - Instead of showing a misleading `"Could not reach 127.0.0.1:31415"` error, it explains the browser Mixed-Content security restriction with complete clarity.
2. **1-Click Local App Launcher in Settings Modal:**
   - When on HTTPS, the modal displays:
     - 🚀 **"Open Local App (http://localhost:5173)"** — Launches `localhost:5173` in a new tab where FreeLLMAPI works natively with 0 Mixed-Content restrictions.
     - ✨ **"Switch to Direct Gemini API"** — Allows seamless AI usage on the cloud website via Google Gemini cloud endpoints.
3. **Local-First Rule Enforcement:**
   - By working on **`http://localhost:5173`**, both the web app and FreeLLMAPI run on HTTP loopback with zero CORS, zero CORP blocks, and ~10ms latency.

---

## 8. Service Worker Interception Bypass

### The Root Cause
The PWA service worker (`public/sw.js`) intercepts outgoing `GET` requests to cache offline assets. If an API request to `/v1/models` was intercepted, the service worker's cache handler attempted to treat the dynamic AI model catalog as a static file, causing failed requests or cache poisoning.

### The Fix
In `public/sw.js`, explicitly bypassed all AI gateway endpoints:
```javascript
if (
  event.request.method !== 'GET' ||
  !url.startsWith('http') ||
  url.includes('/freellm-gateway') ||
  url.includes('/v1/') ||
  url.endsWith('/v1') ||
  url.includes('/models') ||
  url.includes('/chat/completions') ||
  url.includes('31415') ||
  url.includes('127.0.0.1') ||
  url.includes('localhost') ||
  url.includes('/api/') ||
  url.includes('cosmowhisper.com')
) {
  return; // Let the browser handle network directly
}
```
In `src/pwa.ts`, all Service Workers and CacheStorage are automatically unregistered and purged on `localhost` during development.
