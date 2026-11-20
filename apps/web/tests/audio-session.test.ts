import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAudioSession,
  frequencyLevels,
  type AudioEnvironment,
  type AudioState,
} from "../src/lib/audio-session.ts";

function fixture() {
  let stopped = 0,
    closed = 0,
    requested = 0,
    disconnected = 0;
  const frames = new Map<number, () => void>();
  let next = 0;
  const states: AudioState[] = [];
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          stopped++;
        },
      },
    ],
  } as unknown as MediaStream;
  let raw = 0;
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 256,
    getByteFrequencyData: (data: Uint8Array) => {
      data.fill(raw);
    },
    disconnect: () => {
      disconnected++;
    },
  } as unknown as AnalyserNode;
  const env: AudioEnvironment = {
    getStream: async () => {
      requested++;
      return stream;
    },
    createContext: () => ({
      createMediaStreamSource: () =>
        ({
          connect: () => {},
          disconnect: () => {
            disconnected++;
          },
        }) as unknown as MediaStreamAudioSourceNode,
      createAnalyser: () => analyser,
      resume: async () => {},
      close: async () => {
        closed++;
      },
    }),
    requestFrame: (callback) => {
      frames.set(++next, callback);
      return next;
    },
    cancelFrame: (id) => {
      frames.delete(id);
    },
  };
  const session = createAudioSession(env, (state) => states.push(state));
  return {
    env,
    session,
    states,
    frames,
    stream,
    counts: () => ({ stopped, closed, requested, disconnected }),
    setRaw: (value: number) => {
      raw = value;
    },
  };
}

test("start is deduplicated and repeated active starts never acquire a second microphone", async () => {
  const f = fixture();
  const first = f.session.start();
  assert.equal(f.session.start(), first);
  assert.equal(await first, true);
  assert.equal(await f.session.start(), true);
  assert.equal(f.counts().requested, 1);
  f.session.stop();
});
test("frequency reads stay live without needing a React render", async () => {
  const f = fixture();
  await f.session.start();
  assert.equal(f.session.read().bass, 0);
  f.setRaw(100);
  const callback = [...f.frames.values()][0];
  f.frames.clear();
  callback();
  assert.equal(f.session.read().bass, 0.5);
  assert.ok(f.session.read().high > 0);
  f.session.stop();
  assert.equal(f.session.read().bass, 0);
});
test("stop releases tracks, the audio context, graph and animation frame", async () => {
  const f = fixture();
  await f.session.start();
  f.session.stop();
  assert.deepEqual(f.counts(), {
    stopped: 1,
    closed: 1,
    requested: 1,
    disconnected: 2,
  });
  assert.equal(f.frames.size, 0);
  assert.equal(f.states.at(-1)!.status, "idle");
});
test("a permission result arriving after stop releases its track without starting audio", async () => {
  const f = fixture();
  let grant!: (stream: typeof f.stream) => void;
  f.env.getStream = () =>
    new Promise((resolve) => {
      grant = resolve;
    });
  const pending = f.session.start();
  f.session.stop();
  grant(f.stream);
  assert.equal(await pending, false);
  assert.equal(f.counts().stopped, 1);
  assert.equal(f.counts().closed, 0);
  assert.equal(f.frames.size, 0);
});
test("permission failures stay visible and can be retried without a false active state", async () => {
  const f = fixture();
  const original = f.env.getStream;
  f.env.getStream = async () => {
    throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
  };
  assert.equal(await f.session.start(), false);
  assert.equal(f.states.at(-1)!.status, "error");
  assert.match(f.states.at(-1)!.error!, /browser settings/);
  f.env.getStream = original;
  assert.equal(await f.session.start(), true);
  assert.equal(f.states.at(-1)!.error, null);
  f.session.stop();
});
test("audio setup failures release the acquired microphone and support retry", async () => {
  const f = fixture();
  f.env.createContext = () => {
    throw new Error("audio unavailable");
  };
  assert.equal(await f.session.start(), false);
  assert.equal(f.counts().stopped, 1);
  assert.equal(f.frames.size, 0);
  assert.equal(f.states.at(-1)!.status, "error");
});
test("empty and saturated frequency bins stay finite within the UI meter range", () => {
  assert.deepEqual(frequencyLevels(new Uint8Array()), {
    bass: 0,
    mid: 0,
    high: 0,
  });
  assert.deepEqual(frequencyLevels(new Uint8Array(256).fill(255)), {
    bass: 1,
    mid: 1,
    high: 1,
  });
});
