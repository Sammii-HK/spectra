"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Mic,
  MicOff,
  Pause,
  Play,
} from "lucide-react";
import * as THREE from "three";
import { fragmentShader } from "@/shaders/fragment.glsl";
import { vertexShader } from "@/shaders/vertex.glsl";
import { useAudioData } from "@/hooks/useAudioData";
import { SILENCE, type AudioLevels } from "@/lib/audio-session";

export default function ShaderCanvas() {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<{
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    camera: THREE.OrthographicCamera;
    world: THREE.Scene;
  } | null>(null);
  const { status, error, isActive, start, stop, read } = useAudioData();
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [meters, setMeters] = useState<AudioLevels>(SILENCE);
  const smooth = useRef<AudioLevels>({ ...SILENCE });
  const seconds = useRef(0);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    } catch {
      setRenderError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);
    const world = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
      },
    });
    world.add(new THREE.Mesh(geometry, material));
    scene.current = { renderer, material, camera, world };
    renderer.render(world, camera);
    const resize = new ResizeObserver(() => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.render(world, camera);
    });
    resize.observe(host);
    const lost = (event: Event) => {
      event.preventDefault();
      setRenderError(true);
      setRunning(false);
      stop();
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    setReady(true);
    return () => {
      scene.current = null;
      resize.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [stop]);

  useEffect(() => {
    if (!isActive) {
      setMeters(SILENCE);
      return;
    }
    const timer = setInterval(() => setMeters({ ...read() }), 100);
    return () => clearInterval(timer);
  }, [isActive, read]);

  useEffect(() => {
    if (!ready || !running || renderError) return;
    let frame = 0,
      previous = 0;
    const draw = (now: number) => {
      if (!scene.current) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      seconds.current += delta;
      const audio = read();
      for (const band of ["bass", "mid", "high"] as const)
        smooth.current[band] +=
          (audio[band] > smooth.current[band] ? 0.18 : 0.05) *
          (audio[band] - smooth.current[band]);
      const { renderer, material, camera, world } = scene.current;
      material.uniforms.uTime.value = seconds.current;
      material.uniforms.uBass.value = smooth.current.bass;
      material.uniforms.uMid.value = smooth.current.mid;
      material.uniforms.uHigh.value = smooth.current.high;
      renderer.render(world, camera);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ready, running, renderError, read]);
  const begin = async () => {
    if (await start()) setRunning(true);
  };
  const end = () => {
    stop();
    setMeters(SILENCE);
  };
  return (
    <div className="spectra-studio">
      <div className="shader-stage" ref={mount} />
      <header className="studio-header">
        <a href="#studio" className="wordmark">
          <AudioLines size={23} aria-hidden />
          spectra<span>Sound into light</span>
        </a>
        <a href="https://sammii.dev" className="portfolio-link">
          Sammii’s lab
          <ArrowUpRight size={16} aria-hidden />
        </a>
      </header>
      <main id="studio" className="studio-content">
        <section
          className={`intro-panel ${running ? "is-playing" : ""}`}
          aria-label="Visualiser controls"
        >
          <p className="eyebrow">An audio-reactive shader study</p>
          <h1>
            See the shape
            <br />
            of your sound.
          </h1>
          <p className="intro-copy">
            Low, middle and high frequency bins shape the light. Explore the
            quiet animation, or let your microphone lead.
          </p>
          {renderError ? (
            <p role="alert" className="error-note">
              The visualiser needs WebGL, which is unavailable or was
              interrupted. Try reloading in a browser with graphics support.
            </p>
          ) : (
            <div className="studio-actions">
              <button
                className="primary-action"
                type="button"
                disabled={!ready || status === "starting"}
                onClick={isActive ? end : begin}
              >
                {isActive ? (
                  <MicOff size={17} aria-hidden />
                ) : (
                  <Mic size={17} aria-hidden />
                )}
                {status === "starting"
                  ? "Waiting for microphone"
                  : isActive
                    ? "Stop microphone"
                    : "Use microphone"}
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => setRunning((value) => !value)}
              >
                {running ? (
                  <Pause size={17} aria-hidden />
                ) : (
                  <Play size={17} aria-hidden />
                )}
                {running ? "Pause visuals" : "Play silent preview"}
              </button>
            </div>
          )}
          {error && (
            <p className="error-note" role="alert">
              {error}
            </p>
          )}
          <p className="privacy-note">
            Audio stays in this tab. Nothing is recorded or uploaded. Microphone
            access starts only when you choose it.
          </p>
        </section>
      </main>
      <footer className="studio-footer">
        <div role="status" className="studio-status">
          <span
            className={isActive ? "status-dot active" : "status-dot"}
            aria-hidden
          />
          {renderError
            ? "Graphics unavailable"
            : !ready
              ? "Preparing visualiser"
              : isActive
                ? running
                  ? "Microphone on · visuals playing"
                  : "Microphone on · visuals paused"
                : running
                  ? "Silent preview · no audio input"
                  : "Ready · animation paused"}
        </div>
        <div className="meters" aria-label="Current frequency levels">
          {(["bass", "mid", "high"] as const).map((band) => (
            <div className="meter" key={band}>
              <label htmlFor={`meter-${band}`}>
                {band === "bass" ? "Low" : band === "mid" ? "Mid" : "High"}
              </label>
              <meter
                id={`meter-${band}`}
                min={0}
                max={1}
                value={meters[band]}
              />
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
