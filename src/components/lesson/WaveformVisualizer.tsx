import React, { useEffect, useState } from 'react';

export type VisualizerMode = 'idle' | 'ai' | 'user';

interface Props {
  mode?: VisualizerMode;
  active?: boolean;
  /** Live 0..1 amplitudes from the microphone (used in 'user' mode) */
  bands?: number[];
}

const BAR_COUNT = 16;

/** Centre-stage animated waveform.
 *  - 'idle': Passive listening state with gentle ambient breathing motion and subtle slate accents.
 *  - 'user': Active recording pulse with glowing rose/amber gradient, dynamic rhythm floor that never
 *    goes dead during thinking pauses, blended with live mic amplitudes.
 *  - 'ai': Synthetic expressive speech envelope in emerald/brand accents while the AI speaks.
 */
export const WaveformVisualizer: React.FC<Props> = ({ mode: rawMode, active, bands = [] }) => {
  const mode: VisualizerMode = rawMode || (active ? 'user' : 'idle');
  const [pulseTick, setPulseTick] = useState(0);

  useEffect(() => {
    let t = 0;
    const interval = window.setInterval(() => {
      t += 1;
      setPulseTick(t);
    }, 60);
    return () => window.clearInterval(interval);
  }, []);

  // Compute heights based on mode
  const computedValues = Array.from({ length: BAR_COUNT }, (_, i) => {
    if (mode === 'user') {
      // PTT Engaged: Active recording pulse blended with live mic input
      const liveAmp = bands[i] ?? 0;
      // Active background recording pulse (heartbeat envelope)
      // Non-native learners pause frequently: even during silence, the visualizer
      // shows a reassuring, energetic recording pulse so they know the mic is wide open
      const activePulseFloor = 0.16 + 0.11 * Math.sin(pulseTick / 3 + i / 1.7);
      return Math.min(1, Math.max(activePulseFloor, liveAmp * 1.5));
    }
    if (mode === 'ai') {
      const envelope = 0.45 + 0.35 * Math.sin(pulseTick / 3 + i / 2);
      const variation = 0.75 + 0.25 * Math.sin(pulseTick * 1.3 + i * 2.7);
      return Math.max(0.12, Math.min(1, envelope * variation));
    }
    // Idle / passive listening state: calm, subtle breathing
    return 0.10 + 0.04 * Math.sin(pulseTick / 8 + i / 2);
  });

  // Mirror so the waveform is symmetric around the centre
  const mirrored = [
    ...computedValues.slice(0, BAR_COUNT / 2).reverse(),
    ...computedValues.slice(0, BAR_COUNT / 2),
  ];

  const color =
    mode === 'user'
      ? 'from-rose-500 via-rose-400 to-amber-400 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
      : mode === 'ai'
      ? 'from-brand-600 to-emerald-400'
      : 'from-slate-300 to-slate-200';

  return (
    <div className="relative flex items-center justify-center h-36" aria-hidden>
      {/* Background radial glow */}
      <div
        className={`absolute w-52 h-52 rounded-full blur-3xl transition-all duration-500 pointer-events-none ${
          mode === 'user'
            ? 'bg-rose-500/25 scale-110 animate-pulse'
            : mode === 'ai'
            ? 'bg-brand-500/20 scale-100'
            : 'bg-slate-200/40 scale-90'
        }`}
      />

      {/* Concentric active pulse ring when PTT is engaged */}
      {mode === 'user' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-24 rounded-full border border-rose-400/30 animate-ping opacity-25" />
        </div>
      )}

      <div className="relative flex items-center gap-1.5 h-full z-10">
        {mirrored.map((v, i) => (
          <span
            key={i}
            className={`w-2.5 rounded-full bg-gradient-to-t ${color} transition-[height] duration-75 ease-out`}
            style={{
              height: `${Math.round(10 + v * 115)}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
