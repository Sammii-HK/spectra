# Spectra

A browser shader study that maps low, middle and high FFT bin groups to GLSL uniforms. Three.js renders the full-screen visual; the Web Audio API analyses microphone input locally. These are relative visual bands, not calibrated frequency, loudness or audio-quality measurements.

The visualiser starts paused. **Play silent preview** explores the time-driven shader without requesting a microphone. **Use microphone** explicitly requests audio input; **Stop microphone** releases it. Pausing the visuals is separate from stopping capture, and the status makes that distinction visible. Live frequency meters remain current while the visuals are paused.

Audio is not recorded or uploaded. There is no model, account or provider integration. Permission failures stay visible with retry guidance. The application releases tracks, audio graph, context and animation frames when stopped or unmounted; permission results arriving after stop are discarded and released.

## Local development

Use Node 24 and pnpm 11.26.0 for the verified setup. The web application maintains its lockfile and pnpm settings in `apps/web`; root commands delegate to it.

```sh
pnpm -C apps/web install --frozen-lockfile --ignore-scripts
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm -C apps/web start --port 4820
```

The interface uses Lucide icons and a Lucide-derived favicon. The normal lint and test commands include the shared icon guard. Audio tests use synthetic frequency buffers and mocked browser resources; they do not request access to a real microphone.
