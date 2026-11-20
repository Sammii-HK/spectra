export type AudioLevels = { bass: number; mid: number; high: number };
export type AudioStatus = "idle" | "starting" | "active" | "error";
export type AudioState = { status: AudioStatus; error: string | null };
export const SILENCE: AudioLevels = { bass: 0, mid: 0, high: 0 };

type Stream = MediaStream;
type Analyser = AnalyserNode;
type Context = Pick<
  AudioContext,
  "createMediaStreamSource" | "createAnalyser" | "resume" | "close"
>;
export type AudioEnvironment = {
  getStream: () => Promise<Stream>;
  createContext: () => Context;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

export function audioError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was blocked. Allow it in your browser settings, then try again.";
  if (name === "NotFoundError")
    return "No microphone was found. Connect one, then try again.";
  if (name === "NotReadableError")
    return "Your microphone is unavailable. Check whether another app is using it, then try again.";
  return "Audio could not start. Check your microphone and browser support, then try again.";
}

export function frequencyLevels(raw: Uint8Array): AudioLevels {
  const bassEnd = Math.floor(raw.length / 8),
    midEnd = Math.floor(raw.length / 2);
  const mean = (from: number, to: number, scale: number) => {
    if (to <= from) return 0;
    let sum = 0;
    for (let i = from; i < to; i++) sum += raw[i];
    return Math.min(1, Math.max(0, sum / (to - from) / scale));
  };
  return {
    bass: mean(0, bassEnd, 200),
    mid: mean(bassEnd, midEnd, 180),
    high: mean(midEnd, raw.length, 160),
  };
}

export function createAudioSession(
  env: AudioEnvironment,
  onState: (state: AudioState) => void,
) {
  let levels: AudioLevels = SILENCE;
  let state: AudioStatus = "idle";
  let generation = 0;
  let pending: Promise<boolean> | null = null;
  let stream: Stream | null = null;
  let context: Context | null = null;
  let source: ReturnType<Context["createMediaStreamSource"]> | null = null;
  let analyser: Analyser | null = null;
  let frame: number | null = null;
  const release = () => {
    if (frame !== null) env.cancelFrame(frame);
    frame = null;
    source?.disconnect();
    source = null;
    analyser?.disconnect();
    analyser = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (context) void context.close().catch(() => {});
    context = null;
    levels = SILENCE;
  };
  const stop = () => {
    generation++;
    pending = null;
    release();
    state = "idle";
    onState({ status: state, error: null });
  };
  const start = (): Promise<boolean> => {
    if (pending) return pending;
    if (state === "active") return Promise.resolve(true);
    const attempt = ++generation;
    state = "starting";
    onState({ status: state, error: null });
    const operation = (async () => {
      try {
        const acquired = await env.getStream();
        if (attempt !== generation) {
          acquired.getTracks().forEach((track) => track.stop());
          return false;
        }
        stream = acquired;
        context = env.createContext();
        await context.resume();
        if (attempt !== generation) return false;
        source = context.createMediaStreamSource(acquired);
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (attempt !== generation || !analyser) return;
          analyser.getByteFrequencyData(buffer);
          levels = frequencyLevels(buffer);
          frame = env.requestFrame(tick);
        };
        state = "active";
        onState({ status: state, error: null });
        tick();
        return true;
      } catch (error) {
        if (attempt !== generation) return false;
        release();
        state = "error";
        onState({ status: state, error: audioError(error) });
        return false;
      } finally {
        if (attempt === generation) pending = null;
      }
    })();
    pending = operation;
    return operation;
  };
  return { start, stop, read: () => levels };
}
