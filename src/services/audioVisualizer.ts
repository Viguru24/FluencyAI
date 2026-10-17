// Web Audio API Microphone Stream & Waveform Visualizer Service
import { diagnosticLogger } from './diagnosticLogger';

export class AudioVisualizerController {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isListening: boolean = false;
  private animationFrameId: number | null = null;

  async startMicrophone(onAudioData?: (normalizedAmplitudes: number[]) => void): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
        diagnosticLogger.warn('MIC', 'navigator.mediaDevices.getUserMedia is unavailable');
        return false;
      }

      // Stop any existing session
      this.stopMicrophone();

      diagnosticLogger.log('MIC', 'Requesting microphone access via getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;
      const tracks = stream.getAudioTracks();
      diagnosticLogger.log('MIC', `Microphone stream acquired (${tracks.length} track(s))`, {
        label: tracks[0]?.label,
        enabled: tracks[0]?.enabled,
        muted: tracks[0]?.muted,
      });

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      
      if (this.audioContext.state === 'suspended') {
        diagnosticLogger.log('AUDIO', 'AudioContext suspended, resuming for user gesture...');
        await this.audioContext.resume();
      }
      diagnosticLogger.log('AUDIO', `AudioContext running (sampleRate: ${this.audioContext.sampleRate})`);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.isListening = true;

      // Real-time animation loop
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLoop = () => {
        if (!this.isListening || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        if (onAudioData) {
          // Normalize 0..255 to 0..1 range across ~16 representative frequency bands
          const bands: number[] = [];
          const step = Math.max(1, Math.floor(bufferLength / 16));
          for (let i = 0; i < 16; i++) {
            const val = dataArray[i * step] || 0;
            bands.push(Math.min(1, Math.max(0.08, val / 255)));
          }
          onAudioData(bands);
        }

        this.animationFrameId = requestAnimationFrame(updateLoop);
      };

      updateLoop();
      return true;
    } catch (err) {
      diagnosticLogger.error('MIC', 'Microphone access blocked or failed in getUserMedia', err);
      console.warn('[AudioVisualizer] Microphone access blocked or unavailable:', err);
      this.stopMicrophone();
      return false;
    }
  }

  stopMicrophone() {
    this.isListening = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      this.sourceNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        /* ignore */
      }
      this.audioContext = null;
    }
  }

  start(onAudioData?: (normalizedAmplitudes: number[]) => void): Promise<boolean> {
    return this.startMicrophone(onAudioData);
  }

  stop() {
    this.stopMicrophone();
  }

  getStream(): MediaStream | null {
    return this.mediaStream;
  }

  isActive(): boolean {
    return this.isListening;
  }
}

