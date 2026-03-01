"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { fragmentShader } from "@/shaders/fragment.glsl";
import { vertexShader } from "@/shaders/vertex.glsl";
import { useAudioData } from "@/hooks/useAudioData";

export default function ShaderCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    camera: THREE.OrthographicCamera;
    scene: THREE.Scene;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());

  const { isActive, error, start, audioData } = useAudioData();
  const audioDataRef = useRef(audioData);

  // Keep the ref in sync without triggering re-renders
  useEffect(() => {
    audioDataRef.current = audioData;
  });

  const [showOverlay, setShowOverlay] = useState(true);
  const [meters, setMeters] = useState({ bass: 0, mid: 0, high: 0 });

  // --- Three.js setup ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid:  { value: 0 },
        uHigh: { value: 0 },
      },
    });

    scene.add(new THREE.Mesh(geometry, material));
    sceneRef.current = { renderer, material, camera, scene };

    const onResize = () => {
      if (!mount || !sceneRef.current) return;
      const { renderer } = sceneRef.current;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    let frameCount = 0;
    // Smoothed values — lerped toward raw audio each frame to remove jumpiness
    let sBass = 0, sMid = 0, sHigh = 0;

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      if (!sceneRef.current) return;

      const { renderer: r, material: m, camera: c, scene: s } = sceneRef.current;
      const elapsed = clockRef.current.getElapsedTime();
      const ad = audioDataRef.current;

      // Asymmetric smoothing: fast attack (0.18), slow release (0.05)
      const attack  = 0.18;
      const release = 0.05;
      sBass += (ad.bass > sBass ? attack : release) * (ad.bass - sBass);
      sMid  += (ad.mid  > sMid  ? attack : release) * (ad.mid  - sMid);
      sHigh += (ad.high > sHigh ? attack : release) * (ad.high - sHigh);

      m.uniforms.uTime.value = elapsed;
      m.uniforms.uBass.value = sBass;
      m.uniforms.uMid.value  = sMid;
      m.uniforms.uHigh.value = sHigh;

      r.render(s, c);

      // Update meters at ~10fps to avoid layout thrash
      frameCount++;
      if (frameCount % 6 === 0) {
        setMeters({ bass: ad.bass, mid: ad.mid, high: ad.high });
      }
    };

    render();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleStart = async () => {
    await start();
    setShowOverlay(false);
  };

  return (
    <div className="relative w-full h-full">
      {/* Canvas mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Start overlay */}
      {showOverlay && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer select-none"
          style={{ background: "rgba(0,0,0,0.72)" }}
          onClick={handleStart}
        >
          <div className="text-center px-8">
            <h1
              className="text-white font-light tracking-[0.35em] uppercase mb-3"
              style={{ fontSize: "clamp(1.8rem, 5vw, 3.5rem)", letterSpacing: "0.35em" }}
            >
              Spectra
            </h1>
            <p className="text-white/50 text-sm tracking-widest uppercase mb-10">
              Audio-reactive shader visualiser
            </p>
            <button
              className="px-8 py-3 rounded-full border border-white/30 text-white/80 text-sm tracking-widest uppercase hover:border-white/70 hover:text-white transition-all duration-300"
              style={{ backdropFilter: "blur(8px)" }}
              onClick={handleStart}
            >
              Tap to start
            </button>
            {error && (
              <p className="mt-6 text-red-400 text-xs">{error}</p>
            )}
            <p className="mt-4 text-white/25 text-xs">
              Microphone access required
            </p>
          </div>
        </div>
      )}

      {/* Level meters — bottom centre */}
      {isActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-end gap-3 pointer-events-none select-none">
          {(["bass", "mid", "high"] as const).map((band) => (
            <div key={band} className="flex flex-col items-center gap-1.5">
              <div className="relative w-1.5 rounded-full overflow-hidden" style={{ height: 40, background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full transition-none"
                  style={{
                    height: `${meters[band] * 100}%`,
                    background:
                      band === "bass"
                        ? "rgba(160,80,255,0.9)"
                        : band === "mid"
                        ? "rgba(80,160,255,0.9)"
                        : "rgba(160,240,255,0.9)",
                  }}
                />
              </div>
              <span className="text-white/30 text-[9px] tracking-widest uppercase">{band}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
