// AI-Powered Audio Speech-to-Text Transcription Service
// Converts learner voice clips to 16kHz mono WAV and transcribes verbatim via
// FreeLLMAPI Multimodal Gemini (gemini-3.5-flash-lite / gemini-3.8-flash) or Direct Google Gemini API.

import { getLLMConfig } from '../llmConfig';
import { readFromPersistentVaultSync } from '../persistentKeyVault';
import { fetchFreeLLMWithFallback, filterTextForTTS } from './aiClient';
import { diagnosticLogger } from '../diagnosticLogger';

export interface TranscribeAudioParams {
  base64: string;
  mimeType: string;
  blob?: Blob;
}

interface WavConversionResult {
  base64: string;
  mimeType: string;
  maxAmplitude: number;
  durationSec: number;
}

/**
 * Decodes browser MediaRecorder blobs (audio/webm, audio/mp4, audio/ogg) into
 * universal 16kHz 16-bit mono PCM WAV base64 so every Gemini endpoint can parse it reliably.
 */
async function convertBlobToWavBase64(blob: Blob): Promise<WavConversionResult | null> {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  let audioCtx: AudioContext | null = null;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 64) return null;

    audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const durationSec = audioBuffer.duration;
    if (durationSec <= 0.05) return null;

    const targetSampleRate = 16000;
    const numSamples = Math.max(1, Math.floor(durationSec * targetSampleRate));
    const offlineCtx = new OfflineAudioContext(1, numSamples, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const samples = renderedBuffer.getChannelData(0);

    let maxAmplitude = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxAmplitude) maxAmplitude = abs;
    }

    const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wavBuffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format = 1
    view.setUint16(22, 1, true); // Mono = 1 channel
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const bytes = new Uint8Array(wavBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }

    return {
      base64: btoa(binary),
      mimeType: 'audio/wav',
      maxAmplitude,
      durationSec,
    };
  } catch (err) {
    console.warn('[AudioTranscription] WAV conversion fallback to raw container:', err);
    return null;
  } finally {
    if (audioCtx && audioCtx.state !== 'closed') {
      try {
        await audioCtx.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function cleanTranscriptionOutput(rawText: string): string | null {
  if (!rawText) return null;
  const cleaned = filterTextForTTS(rawText, '')
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .trim();

  if (
    !cleaned ||
    cleaned.toUpperCase() === 'EMPTY' ||
    cleaned.toUpperCase() === 'SILENT' ||
    cleaned.toLowerCase().includes('no audible speech') ||
    cleaned.toLowerCase().includes('no spoken words') ||
    cleaned.toLowerCase().includes('audio is silent')
  ) {
    return null;
  }
  return cleaned;
}

export async function transcribeAudioWithAI(params: TranscribeAudioParams): Promise<string | null> {
  const { base64, mimeType, blob } = params;
  if (!base64 || base64.length < 50) return null;

  // Convert recorded blob to universal 16kHz mono WAV whenever possible
  let payloadBase64 = base64;
  let payloadMime = mimeType.split(';')[0].trim() || 'audio/webm';

  if (blob) {
    const wav = await convertBlobToWavBase64(blob);
    if (wav) {
      // If peak amplitude is effectively zero, the microphone recorded pure silence
      if (wav.maxAmplitude < 0.004) {
        console.log('[AudioTranscription] Audio peak amplitude below threshold (silence):', wav.maxAmplitude);
        return null;
      }
      payloadBase64 = wav.base64;
      payloadMime = wav.mimeType;
    }
  }

  const config = getLLMConfig();
  const vault = readFromPersistentVaultSync();
  const apiKey = (config.apiKey || vault.apiKey || '').trim();

  const transcriptionPrompt =
    'You are an accurate speech-to-text engine for English language learners. Transcribe the exact spoken English words in this audio recording verbatim. Output ONLY the raw transcript text. Do not include markdown, explanations, speaker labels, or quotes. If the audio is silent or contains no spoken words, reply with EMPTY.';

  // 1. Direct Google Gemini API (when an AIzaSy... key is configured)
  const isDirectGemini = config.provider === 'direct-gemini' || apiKey.startsWith('AIza');
  if (isDirectGemini && apiKey.startsWith('AIza')) {
    const directCandidates = Array.from(
      new Set([
        config.model && config.model.includes('gemini') ? config.model : 'gemini-2.5-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
      ])
    );

    for (const model of directCandidates) {
      try {
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
                      mimeType: payloadMime,
                      data: payloadBase64,
                    },
                  },
                  {
                    text: transcriptionPrompt,
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
          const cleaned = cleanTranscriptionOutput(rawText);
          if (cleaned) {
            diagnosticLogger.log('AI', `Audio transcribed via Direct Gemini (${model}): "${cleaned}"`);
            console.log(`[AudioTranscription] Transcribed via Direct Gemini (${model}):`, cleaned);
            return cleaned;
          }
        }
      } catch (err) {
        diagnosticLogger.warn('AI', `Direct Gemini (${model}) error:`, err);
        console.warn(`[AudioTranscription] Direct Gemini (${model}) error:`, err);
      }
    }
  }

  // 2. FreeLLMAPI Unified Gateway Multimodal Gemini Transcription
  // FreeLLMAPI's Google provider translates OpenAI `image_url` data URLs (`data:audio/wav;base64,...`)
  // directly into Gemini's native `{ inlineData: { mimeType, data } }` parts.
  const freeLLMCandidates = Array.from(
    new Set([
      config.model &&
      config.model !== 'auto' &&
      config.model !== 'gemini-3.1-flash-lite' &&
      config.model.includes('gemini')
        ? config.model
        : 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
    ])
  );

  for (const candidateModel of freeLLMCandidates) {
    try {
      const chatRes = await fetchFreeLLMWithFallback(
        '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: candidateModel,
            temperature: 0.0,
            max_tokens: 250,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${payloadMime};base64,${payloadBase64}`,
                    },
                  },
                  {
                    type: 'text',
                    text: transcriptionPrompt,
                  },
                ],
              },
            ],
          }),
        },
        config.baseUrl
      );

      if (chatRes.ok) {
        const data = await chatRes.json();
        const rawText = data?.choices?.[0]?.message?.content?.trim() || '';
        const cleaned = cleanTranscriptionOutput(rawText);
        if (cleaned) {
          diagnosticLogger.log('AI', `Audio transcribed via FreeLLMAPI (${candidateModel}): "${cleaned}"`);
          console.log(`[AudioTranscription] Transcribed via FreeLLMAPI (${candidateModel}):`, cleaned);
          return cleaned;
        }
        diagnosticLogger.log('AI', `FreeLLMAPI (${candidateModel}) returned empty speech`, { raw: rawText });
        // If model explicitly returned EMPTY/SILENT, do not retry other models
        if (rawText.toUpperCase().includes('EMPTY')) {
          return null;
        }
      }
    } catch (err) {
      console.warn(`[AudioTranscription] FreeLLMAPI (${candidateModel}) transcription attempt failed:`, err);
    }
  }

  return null;
}
