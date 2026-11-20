# Spectra product review, 20 November 2026

Local branch `codex/spectra-product-polish`, source base `d43105a`. Owner main checkout had two untracked generated/config files; neither was changed. No environment files, private runtime state, database, provider, microphone grant or release was used.

## Actual fixes

The original hook replaced its private audio object each frame, but ShaderCanvas only received the object from a React render. The replacement session exposes a stable `read` function, so the renderer reads current frequency values directly. Synthetic-buffer regression verifies this without requiring a component re-render.

The original click bubbled through both the button and its wrapper, requesting duplicate streams. Its overlay closed even after failed permission, and audio contexts were never closed. Start is now deduplicated and returns success/failure; error guidance remains in the interface. Stop and unmount release tracks, analyser/source, context and frame. A permission result arriving after stop is released immediately. A separate microphone control can stop capture while leaving the silent shader available.

The actual tool now has an introduction, explicit controls, frequency meters, readable status, portfolio navigation, favicon, responsive layout and Lucide icons. It opens paused, including for reduced-motion users; animation begins only after explicit interaction. Silent preview does not request audio. WebGL setup/context-loss failures show a usable error. Audio stays within the tab, with no upload or recording path.

## Source and build evidence

- Seven audio/resource tests and eight shared icon tests passed (15 total).
- Full source ESLint, icon guard and strict TypeScript passed. Icon gate has zero blocking findings and zero review candidates.
- Normal Next 15.5.29 production build passed, including static homepage and favicon.
- Full dependency audit is zero after compatible framework, PostCSS and tooling patches. pnpm 11 reads the scoped override from `apps/web/pnpm-workspace.yaml`; no ignored package.json override is relied on. Reference: https://pnpm.io/settings.
- Root scripts now delegate directly to `apps/web`; they no longer rely on an absent workspace definition. `outputFileTracingRoot` identifies the actual web app, without copying parent workspace files.

Browser verified the rebuilt production app at port 4820: the intended Spectra title and controls, real WebGL canvas and visible shader, mouse and Enter-operated silent Play/Pause, accurate paused/no-input status, and native frequency meters. Desktop width was 1144px; at 390px both document widths were 390px, the canvas was 390x844 and controls were 48px high. Fresh captures are `.codex-artifacts/spectra-desktop.jpg` and `spectra-phone.jpg`. The microphone button was never clicked, no permission was accepted, and the page was left paused. An initial port4817 collision showed Crystal's clearly labelled offline fixtures and was recognised before any interaction or false Spectra evidence; Spectra was moved to4820. Real microphone permission/capture, physical audio devices, cross-browser graphics and assistive-technology behaviour are not verified by the mock tests. No audio-reactive performance or calibrated frequency claims are made. This remains local and unreleased.
