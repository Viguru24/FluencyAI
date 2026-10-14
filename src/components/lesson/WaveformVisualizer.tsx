import React, { useEffect, useState } from 'react';

type Mode = 'idle' | 'ai' | 'user';

interface Props {
  mode: Mode;
  /** Live 0..1 amplitudes from the microphone (used in 'user' mode) */
  bands: number[];
}

const BAR_COUNT = 16;

/** Centre-stage animated waveform. Uses real mic data while the student speaks,
 *  a synthetic speech envelope while the AI talks, and a gentle "breathing" idle state. */
export const WaveformVisualizer: React.FC<Props> = ({ mode, bands }) => {
  const [synthetic, setSynthetic] = useState<number[]>(() => Array(BAR_COUNT).fill(0.15));

  useEffect(() => {
    if (mode === 'user') return;
    let t = 0;
    const id = window.setInterval(() => {
      t += 1;
      setSynthetic(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          if (mode === 'ai') {
            const envelope = 0.45 + 0.35 * Math.sin(t / 3 + i / 2);
            return Math.max(0.12, Math.min(1, envelope * (0.6 + Math.random() * 0.6)));
          }
          return 0.12 + 0.06 * Math.sin(t / 6 + i / 1.5); // idle breathing
        })
      );
    }, 90);
    return () => window.clearInterval(id);
  }, [mode]);

  const values = mode === 'user' && bands.length ? bands : synthetic;
  // Mirror so the waveform is symmetric around the centre
  const mirrored = [...values.slice(0, BAR_COUNT / 2).reverse(), ...values.slice(0, BAR_COUNT / 2)];

  const color =
    mode === 'user'
      ? 'from-rose-500 to-amber-400'
      : mode === 'ai'
      ? 'from-brand-600 to-emerald-400'
      : 'from-slate-300 to-slate-200';

  return (
    <div className="relative flex items-center justify-center h-36" aria-hidden>
      {/* soft glow */}
      <div
        className={`absolute w-48 h-48 rounded-full blur-3xl transition-colors duration-500 ${
          mode === 'user' ? 'bg-rose-200/60' : mode === 'ai' ? 'bg-brand-200/60' : 'bg-slate-200/40'
        }`}
      />
      <div className="relative flex items-center gap-1.5 h-full">
        {mirrored.map((v, i) => (
          <span
            key={i}
            className={`w-2.5 rounded-full bg-gradient-to-t ${color} transition-[height] duration-100 ease-out`}
            style={{ height: `${Math.round(12 + v * 110)}px` }}
          />
        ))}
      </div>
    </div>
  );
};
