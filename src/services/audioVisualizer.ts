// Web Audio API Microphone Stream & Waveform Visualizer Service
import { diagnosticLogger } from './diagnosticLogger';

export class AudioVisualizerController {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private sourceStream: MediaStream | null = null;
  private isListening: boolean = false;
  private animationFrameId: number | null = null;

  /**
   * Synchronously enables any pre-existing microphone audio tracks at tick 0
   * before SpeechRecognition is invoked, preventing muted-track startup lag.
   */
  enableTracksSync(): void {
    if (this.mediaStream && this.mediaStream.active) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.enabled = true;
        }
      });
    }
  }

  async prewarm(): Promise<MediaStream | null> {
    try {
      if (
        this.mediaStream &&
        this.mediaStream.active &&
        this.mediaStream.getAudioTracks().some((t) => t.readyState === 'live')
      ) {
        return this.mediaStream;
      }
      if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
        return null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.mediaStream = stream;
      this.initAudioGraph(stream);
      // Mute tracks while idle so no background audio is processed
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      diagnosticLogger.log('MIC', 'Microphone pre-warmed and ready for immediate capture');
      return stream;
    } catch {
      // Permission blocked or user hasn't interacted yet; will prompt on user gesture
      return null;
    }
  }

  private initAudioGraph(stream: MediaStream) {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.75;
    }
    if (!this.sourceNode || this.sourceStream !== stream) {
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch {
          /* ignore */
        }
        this.sourceNode = null;
      }
      try {
        this.sourceNode = this.audioContext.createMediaStreamSource(stream);
        this.sourceStream = stream;
        this.sourceNode.connect(this.analyser);
      } catch (e) {
        diagnosticLogger.warn('MIC', 'Could not create MediaStreamSource', e);
      }
    }
  }

  async startMicrophone(onAudioData?: (normalizedAmplitudes: number[]) => void): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      // Check if we already have an active, usable stream
      let stream = this.mediaStream;
      const isStreamActive = Boolean(
        stream && stream.active && stream.getAudioTracks().some((t) => t.readyState === 'live')
      );

      if (!isStreamActive) {
        if (!navigator?.mediaDevices?.getUserMedia) {
          diagnosticLogger.warn('MIC', 'navigator.mediaDevices.getUserMedia is unavailable');
          return false;
        }

        diagnosticLogger.log('MIC', 'Requesting microphone access via getUserMedia...');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.mediaStream = stream;
        diagnosticLogger.log('MIC', 'Acquired fresh microphone stream');
      }

      // Unmute/enable all audio tracks instantly
      stream!.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      this.initAudioGraph(stream!);

      this.isListening = true;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // Real-time animation loop
      const bufferLength = this.analyser!.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLoop = () => {
        if (!this.isListening || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        if (onAudioData) {
          const bands: number[] = [];
          const step = Math.max(1, Math.floor(bufferLength / 16));
          for (let i = 0; i < 16; i++) {
            const val = dataArray[i * step] || 0;
            // Report true normalized vocal energy (0.0 -> 1.0) without artificial floor
            // so voice activity detection can accurately distinguish speech from silence
            bands.push(Math.min(1, val / 255));
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
      this.stopMicrophone(true);
      return false;
    }
  }

  stopMicrophone(releaseHardware: boolean = false) {
    this.isListening = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      if (releaseHardware) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      } else {
        // Between turns: mute audio tracks so no background data is captured, but maintain the live hardware stream for 0ms restart
        this.mediaStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
    }

    if (releaseHardware) {
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch {
          /* ignore */
        }
        this.sourceNode = null;
      }
      this.sourceStream = null;

      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch {
          /* ignore */
        }
        this.audioContext = null;
      }
      this.analyser = null;
    }
  }

  start(onAudioData?: (normalizedAmplitudes: number[]) => void): Promise<boolean> {
    return this.startMicrophone(onAudioData);
  }

  stop(releaseHardware: boolean = false) {
    this.stopMicrophone(releaseHardware);
  }

  getStream(): MediaStream | null {
    return this.mediaStream;
  }

  isActive(): boolean {
    return this.isListening;
  }
}

