export const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;

  varying vec2 vUv;

  // --- noise helpers ---

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // --- domain warp ---

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 domainWarp(vec2 p, float t, float warpStrength) {
    vec3 q = vec3(
      fbm(vec3(p + vec2(0.0, 0.0), t * 0.3)),
      fbm(vec3(p + vec2(5.2, 1.3), t * 0.3)),
      0.0
    );
    vec3 r = vec3(
      fbm(vec3(p + warpStrength * q.xy + vec2(1.7, 9.2), t * 0.25)),
      fbm(vec3(p + warpStrength * q.xy + vec2(8.3, 2.8), t * 0.25)),
      0.0
    );
    float n = fbm(vec3(p + warpStrength * r.xy, t * 0.2));
    return vec3(n, q.x, r.y);
  }

  // --- colour palette (deep purple -> electric blue -> white-hot) ---

  vec3 palette(float t, float hueShift) {
    t = fract(t + hueShift);
    // Bias toward purple end so mid-range noise shows more purple than blue
    t = pow(t, 1.6);

    vec3 deep   = vec3(0.04, 0.0, 0.15);   // near-black purple
    vec3 purple = vec3(0.42, 0.0, 0.80);   // vivid purple
    vec3 violet = vec3(0.55, 0.1, 1.0);    // blue-violet bridge
    vec3 blue   = vec3(0.0,  0.4, 1.0);    // electric blue
    vec3 cyan   = vec3(0.0,  0.9, 1.0);    // cyan peak
    vec3 white  = vec3(1.0,  1.0, 1.0);    // white hot

    vec3 col;
    if (t < 0.3) {
      col = mix(deep,   purple, t / 0.3);
    } else if (t < 0.5) {
      col = mix(purple, violet, (t - 0.3) / 0.2);
    } else if (t < 0.68) {
      col = mix(violet, blue,   (t - 0.5) / 0.18);
    } else if (t < 0.82) {
      col = mix(blue,   cyan,   (t - 0.68) / 0.14);
    } else {
      col = mix(cyan,   white,  (t - 0.82) / 0.18);
    }
    return col;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    uv.x *= 1.5; // mild widescreen stretch

    float t = uTime * 0.18;

    // Bass drives warp intensity (0.8 ambient + up to 2.4 extra)
    float warpStrength = 0.8 + uBass * 2.4;

    vec3 warp = domainWarp(uv * 1.8, t, warpStrength);
    float n = warp.x * 0.5 + 0.5; // remap [-1,1] -> [0,1]

    // Mid drives hue rotation
    float hue = uMid * 0.35;

    vec3 col = palette(n, hue);

    // Bass pulse: brighten the whole field
    col *= 1.0 + uBass * 0.6;

    // High shimmer: fast noise overlay
    float shimmer = snoise(vec3(uv * 12.0, uTime * 3.0));
    shimmer = smoothstep(0.3, 0.9, shimmer);
    col += uHigh * shimmer * vec3(0.6, 0.8, 1.0) * 0.8;

    // Vignette
    float vignette = smoothstep(1.1, 0.3, length(uv * vec2(1.0, 1.4)));
    col *= vignette;

    // Clamp and apply mild gamma
    col = clamp(col, 0.0, 1.0);
    col = pow(col, vec3(0.85));

    gl_FragColor = vec4(col, 1.0);
  }
`;
