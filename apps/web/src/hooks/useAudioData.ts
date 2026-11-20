"use client";

import { useEffect, useRef, useState } from "react";
import { createAudioSession, type AudioState } from "../lib/audio-session";

export function useAudioData() {
  const [state, setState] = useState<AudioState>({
    status: "idle",
    error: null,
  });
  const session = useRef<ReturnType<typeof createAudioSession> | null>(null);
  if (!session.current)
    session.current = createAudioSession(
      {
        getStream: async () => {
          if (!navigator.mediaDevices?.getUserMedia)
            throw new Error("Unsupported audio capture");
          return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        },
        createContext: () => new AudioContext(),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
      },
      setState,
    );
  useEffect(() => {
    const active = session.current!;
    return () => active.stop();
  }, []);
  return {
    ...state,
    isActive: state.status === "active",
    start: session.current.start,
    stop: session.current.stop,
    read: session.current.read,
  };
}
