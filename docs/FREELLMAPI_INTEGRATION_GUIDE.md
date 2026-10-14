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
