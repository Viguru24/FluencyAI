// MediaRecorder Service for Multimodal Gemini Speech Capture
// Records spoken audio turns as base64 inlineData for Gemini 2.5 Flash

export interface RecordedAudioClip {
  base64: string; // Raw base64 data suitable for Gemini inlineData
  mimeType: string; // Clean MIME type (e.g. 'audio/webm' or 'audio/mp4')
  dataUrl: string; // Full data URL (data:audio/webm;base64,...)
  blob: Blob;
  durationMs: number;
}

export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];

  for (const type of preferredTypes) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // Continue checking next type
    }
  }

  return 'audio/webm';
}

export class AudioRecorderController {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private activeStream: MediaStream | null = null;
  private ownsStream: boolean = false;
  private mimeTypeUsed: string = 'audio/webm';

  async start(existingStream?: MediaStream | null): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
        console.warn('[AudioRecorder] MediaRecorder is not supported in this browser');
        return false;
      }

      this.stop(); // Clear any previous active recording

      let stream = existingStream;
      if (!stream || !stream.active) {
        if (!navigator.mediaDevices?.getUserMedia) {
          return false;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.ownsStream = true;
      } else {
        this.ownsStream = false;
      }

      this.activeStream = stream;
      this.recordedChunks = [];
      this.mimeTypeUsed = getSupportedAudioMimeType();

      const options: MediaRecorderOptions = {};
      if (this.mimeTypeUsed) {
        options.mimeType = this.mimeTypeUsed;
      }

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.startTime = Date.now();
      // Collect in 250ms timeslices so chunks are flushed reliably
      this.mediaRecorder.start(250);
      return true;
    } catch (err) {
      console.warn('[AudioRecorder] Failed to start MediaRecorder:', err);
      this.cleanup();
      return false;
    }
  }

  async stop(): Promise<RecordedAudioClip | null> {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      this.cleanup();
      return null;
    }

    const durationMs = Date.now() - this.startTime;

    return new Promise<RecordedAudioClip | null>((resolve) => {
      recorder.onstop = async () => {
        try {
          if (this.recordedChunks.length === 0) {
            resolve(null);
            return;
          }

          const rawMime = this.mimeTypeUsed || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: rawMime });

          // Gemini inlineData expects pure audio types without codec parameters (e.g. 'audio/webm' or 'audio/mp4')
          const cleanMime = rawMime.split(';')[0].trim() || 'audio/webm';

          const dataUrl = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });

          const base64 = dataUrl.split(',')[1] || '';

          resolve({
            base64,
            mimeType: cleanMime,
            dataUrl,
            blob,
            durationMs,
          });
        } catch (e) {
          console.warn('[AudioRecorder] Failed to finalize audio blob:', e);
          resolve(null);
        } finally {
          this.cleanup();
        }
      };

      try {
        recorder.stop();
      } catch (e) {
        console.warn('[AudioRecorder] Error invoking recorder.stop():', e);
        this.cleanup();
        resolve(null);
      }
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  private cleanup() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    if (this.ownsStream && this.activeStream) {
      this.activeStream.getTracks().forEach((t) => t.stop());
    }
    this.activeStream = null;
    this.ownsStream = false;
  }
}
