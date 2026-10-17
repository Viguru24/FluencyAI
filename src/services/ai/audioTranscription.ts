// AI-Powered Audio Speech-to-Text Transcription Service
// Converts learner voice clips to text using Google Gemini Multimodal Audio or FreeLLMAPI Whisper

import { getLLMConfig } from '../llmConfig';
import { readFromPersistentVaultSync } from '../persistentKeyVault';
import { fetchFreeLLMWithFallback, filterTextForTTS } from './aiClient';

export interface TranscribeAudioParams {
  base64: string;
  mimeType: string;
  blob?: Blob;
}

export async function transcribeAudioWithAI(params: TranscribeAudioParams): Promise<string | null> {
  const { base64, mimeType, blob } = params;
  if (!base64 || base64.length < 50) return null;

  const config = getLLMConfig();
  const vault = readFromPersistentVaultSync();
  const apiKey = (config.apiKey || vault.apiKey || '').trim();

  // 1. Direct Gemini Multimodal Transcription (Google Generative Language API)
  const isDirectGemini = config.provider === 'direct-gemini' || apiKey.startsWith('AIza');
  if (isDirectGemini && apiKey.startsWith('AIza')) {
    try {
      const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';
      const model =
        config.model && config.model.includes('gemini') && !config.model.includes('3.1') && !config.model.includes('3.8')
          ? config.model
          : 'gemini-2.5-flash';

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: base64,
                  },
                },
                {
                  text: 'You are an accurate speech-to-text engine for English language learners. Transcribe the spoken English words in this audio verbatim. Output ONLY the raw transcript text. Do not include markdown, explanations, speaker labels, or quotes. If the audio is silent or only background noise, reply with EMPTY.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 250,
            ...(model.includes('2.5') || model.includes('2.0')
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const cleaned = filterTextForTTS(rawText, '').trim();
        if (
          cleaned &&
          cleaned.toUpperCase() !== 'EMPTY' &&
          !cleaned.toLowerCase().includes('no audible speech') &&
          !cleaned.toLowerCase().includes('silent')
        ) {
          console.log('[AudioTranscription] Transcribed via Direct Gemini:', cleaned);
          return cleaned;
        }
      }
    } catch (err) {
      console.warn('[AudioTranscription] Direct Gemini transcription error:', err);
    }
  }

  // 2. FreeLLMAPI Router Audio Transcriptions Fallback
  if (config.provider === 'freellmapi' || apiKey.startsWith('freellma')) {
    try {
      // Try /audio/transcriptions endpoint if available (standard OpenAI format)
      if (blob) {
        const formData = new FormData();
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        formData.append('file', blob, `audio.${ext}`);
        formData.append('model', 'whisper-1');

        const audioRes = await fetchFreeLLMWithFallback(
          '/audio/transcriptions',
          {
            method: 'POST',
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            body: formData,
          },
          config.baseUrl
        );

        if (audioRes.ok) {
          const data = await audioRes.json();
          const transcript = (data?.text || '').trim();
          if (transcript) {
            console.log('[AudioTranscription] Transcribed via FreeLLMAPI Whisper:', transcript);
            return transcript;
          }
        }
      }
    } catch {
      // Audio endpoint not implemented or failed on FreeLLMAPI router
    }
  }

  return null;
}
