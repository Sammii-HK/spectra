"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioData {
  bass: number;
  mid: number;
  high: number;
  raw: Uint8Array;
}

interface UseAudioDataReturn {
  audioData: AudioData;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
}

const DEFAULT_DATA: AudioData = {
  bass: 0,
  mid: 0,
  high: 0,
  raw: new Uint8Array(0),
};

export function useAudioData(): UseAudioDataReturn {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioDataRef = useRef<AudioData>(DEFAULT_DATA);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Expose a stable ref-backed getter so ShaderCanvas reads latest without re-renders
  const getAudioData = useCallback(() => audioDataRef.current, []);

  const tick = useCallback(() => {
    if (!analyserRef.current || !bufferRef.current) return;

    analyserRef.current.getByteFrequencyData(bufferRef.current);
    const raw = bufferRef.current;
    const len = raw.length;

    // FFT bins: 0–(len/8) = bass, (len/8)–(len/2) = mid, (len/2)–len = high
    const bassEnd = Math.floor(len / 8);
    const midEnd = Math.floor(len / 2);

    let bassSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += raw[i];
    const bass = Math.min(1, (bassSum / bassEnd) / 200);

    let midSum = 0;
    for (let i = bassEnd; i < midEnd; i++) midSum += raw[i];
    const mid = Math.min(1, (midSum / (midEnd - bassEnd)) / 180);

    let highSum = 0;
    for (let i = midEnd; i < len; i++) highSum += raw[i];
    const high = Math.min(1, (highSum / (len - midEnd)) / 160);

    audioDataRef.current = { bass, mid, high, raw };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      bufferRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      setIsActive(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mic access denied";
      setError(message);
    }
  }, [tick]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { audioData: audioDataRef.current, isActive, error, start };
}

// Export the ref getter type for ShaderCanvas
export type { UseAudioDataReturn };
