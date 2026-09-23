import { themeState, ThemeConfig, ANIM_BG_STYLE_IDS } from './state';
import { acquireEqAudio, releaseEqAudio, eqSnapshot } from './eqAudio';
import { warn } from './debug';

export const ANIM_BG_LAYER_ID = 'spicy-themes-animbg';
export const ANIM_BG_ACTIVE_CLASS = 'st-animbg-active';
export const ANIM_BG_SOLID_CLASS = 'st-animbg-solid';

const MUSIC_VIDEO_ID = 'spicy-themes-mv';
const BG_IMAGE_LAYER_ID = 'spicy-themes-bgimg';
const AUDIO_KEY = 'animated-background';
const HIST_H = 64;
const QUALITY_SCALE: Record<string, number> = { performance: 0.5, balanced: 0.75, quality: 1 };
const FPS_INTERVAL: Record<string, number> = { '30': 1000 / 30, '60': 1000 / 60, max: 0 };

type Rgb = [number, number, number];

const VERTEX_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const COMMON_SRC = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uClock;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uBg;
uniform float uSolidBg;
uniform float uLevel;
uniform float uPulse;
uniform float uBands[10];
uniform float uDensity;
uniform float uThick;
uniform float uAmp;
uniform float uAngle;
uniform float uPersp;
uniform float uGlow;
uniform float uBright;
uniform float uGrain;
uniform float uVignette;
uniform float uHue;
uniform float uReact;
uniform float uMirror;
uniform float uSolid;
uniform float uSpectrum;
uniform sampler2D uHist;
uniform float uHistFrac;

const float HIST_ROWS = ${HIST_H.toFixed(1)};
const float TAU = 6.28318530718;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(17.1, 9.2);
        a *= 0.5;
    }
    return v;
}

mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, s, -s, c);
}

vec3 hsv(float h, float s, float v) {
    vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), k, s);
}

vec3 hueShift(vec3 c, float a) {
    vec3 k = vec3(0.57735);
    float ca = cos(a);
    return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

vec3 palette(float t) {
    vec3 c = uSpectrum > 0.5 ? hsv(fract(t * 0.8 + 0.5), 0.7, 1.0) : mix(uColA, uColB, clamp(t, 0.0, 1.0));
    return uHue > 0.0 ? max(hueShift(c, uClock * uHue * 0.8), 0.0) : c;
}

float bandAt(float x) {
    float f = clamp(x, 0.0, 1.0) * 9.0;
    float v = 0.0;
    for (int i = 0; i < 10; i++) {
        v += uBands[i] * max(0.0, 1.0 - abs(f - float(i)));
    }
    return v;
}

float histAt(float u, float row) {
    vec4 t = texture2D(uHist, vec2(clamp(u, 0.0, 1.0), (row + 0.5) / HIST_ROWS));
    return min(t.r + t.a, 1.0);
}

float histMusic(float u, float row) {
    return texture2D(uHist, vec2(clamp(u, 0.0, 1.0), (row + 0.5) / HIST_ROWS)).r;
}

float span() {
    return 0.5 * length(vec2(uRes.x / uRes.y, 1.0));
}

float pixel() {
    return 1.0 / uRes.y;
}
`;

const RIDGES_SRC = `
float ridgeHeight(float u, float row) {
    float inside = step(0.0, u) * step(u, 1.0);
    float p = abs(u * 2.0 - 1.0);
    float env = uMirror > 0.5 ? 1.0 - p * p * p : smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
    float s = histAt(uMirror > 0.5 ? p : u, row);
    return s * env * inside;
}

vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float R = span();
    float px = pixel();
    float n = floor(mix(14.0, 64.0, uDensity));
    float depth = uPersp * 4.0;
    float zmax = 1.0 + depth;
    float norm = 1.0 - 1.0 / zmax;
    float front = -R * 0.92;
    float horizon = R * mix(0.9, 0.62, uPersp);
    float amp = mix(0.04, 0.42, uAmp);
    float thick = mix(0.5, 4.0, uThick) * px;
    float glowR = mix(0.002, 0.022, min(uGlow, 1.0));
    float halfW = R * mix(0.95, 0.6, uPersp);
    vec3 col = vec3(0.0);
    for (int i = 0; i < 64; i++) {
        float fi = float(i);
        if (fi >= n) break;
        float row = fi + uHistFrac;
        float t = row / n;
        float z = 1.0 + t * depth;
        float s = 1.0 / z;
        float k = depth > 0.001 ? (1.0 - s) / norm : t;
        float y0 = mix(front, horizon, k);
        float ampS = amp * s;
        float lw = thick * mix(1.0, 0.45, t);
        float reach = lw + glowR * 6.0 + px * 2.0;
        if (p.y < y0 - reach) {
            if (uSolid > 0.5) break;
            continue;
        }
        if (p.y > y0 + ampS + reach) continue;
        float w = halfW * s;
        float u = p.x / (2.0 * w) + 0.5;
        float du = 0.004;
        float h = ridgeHeight(u, fi);
        float h2 = ridgeHeight(u + du, fi);
        float cy = y0 + h * ampS;
        float slope = (h2 - h) * ampS / (du * 2.0 * w);
        float d = abs(p.y - cy) / sqrt(1.0 + slope * slope);
        float fade = smoothstep(0.0, 1.0 / n, t) * smoothstep(1.0, 0.8, t) * mix(1.0, 0.35, t);
        float core = 1.0 - smoothstep(lw, lw + px * 1.2, d);
        float glow = uGlow * 0.55 * exp(-d / (glowR * mix(1.0, 0.5, t)));
        col += palette(t) * (core + glow) * fade;
        if (uSolid > 0.5 && p.y < cy - lw - px) break;
    }
    return col;
}
`;

const SILK_SRC = `
vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float R = span();
    float n = mix(8.0, 72.0, uDensity);
    float t = uTime;
    float amp = mix(0.02, 0.32, uAmp);
    float ax = clamp(abs(p.x) / R, 0.0, 1.0);
    float disp = sin(p.x * 2.1 + t * 0.6 + p.y * 0.35) * 0.55
        + sin(p.x * 4.3 - t * 0.9 + p.y * 0.6) * 0.25
        + (fbm(vec2(p.x * 1.2 + t * 0.15, p.y * 0.45 - t * 0.1)) - 0.5) * 1.4;
    disp *= amp * (1.0 + uReact * (uLevel * 0.6 + uPulse * 0.35));
    disp += amp * uReact * 0.45 * bandAt(uMirror > 0.5 ? ax : p.x / (2.0 * R) + 0.5) * sin(p.x * 9.0 - t * 3.0 + p.y * 0.8);
    float f = (p.y + disp) * n;
    float id = floor(f + 0.5);
    float d = abs(fract(f + 0.5) - 0.5);
#ifdef HAS_DERIV
    float fw = max(fwidth(f), 1e-4);
#else
    float fw = n / uRes.y;
#endif
    float dpx = d / fw;
    float lw = mix(0.3, 3.0, uThick);
    float core = 1.0 - smoothstep(lw, lw + 1.2, dpx);
    float glow = uGlow * 0.45 * exp(-dpx / mix(2.0, 16.0, uGlow));
    float fold = fbm(p * 0.9 + vec2(t * 0.05, -t * 0.03));
    float shimmer = (0.55 + 0.45 * sin(id * 1.7 + t * 0.5 + p.x * 0.8)) * (0.45 + 1.1 * fold);
    vec3 c = palette(clamp(0.5 + p.x / (2.0 * R) + 0.18 * sin(id * 0.31) + (fold - 0.5) * 0.4, 0.0, 1.0));
    return c * (core + glow) * shimmer * (0.8 + 0.4 * uReact * uPulse);
}
`;

const HALO_SRC = `
vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float R = span();
    float px = pixel();
    float r = length(p);
    float a = atan(p.y, p.x) / TAU + 0.5;
    float u = uMirror > 0.5 ? abs(a * 2.0 - 1.0) : a;
    float seam = uMirror > 0.5 ? 1.0 : smoothstep(0.0, 0.04, a) * smoothstep(1.0, 0.96, a);
    float n = floor(mix(6.0, 40.0, uDensity));
    float r0 = 0.05;
    float spacing = (R * 1.05 - r0) / n;
    float amp = mix(0.3, 2.8, uAmp) * spacing;
    float thick = mix(0.5, 4.0, uThick) * px;
    float glowR = mix(0.002, 0.022, min(uGlow, 1.0));
    float fi = floor((r - r0) / spacing - uHistFrac);
    vec3 col = vec3(0.0);
    for (int k = -4; k <= 1; k++) {
        float i = fi + float(k);
        if (i < 0.0 || i >= n) continue;
        float row = i + uHistFrac;
        float t = row / n;
        float h = (histMusic(u, i) * 0.4 + (histMusic(u - 0.035, i) + histMusic(u + 0.035, i)) * 0.3) * seam;
        float cr = r0 + row * spacing + h * amp * (0.4 + t);
        float d = abs(r - cr);
        float lw = thick * mix(1.0, 0.6, t);
        float fade = smoothstep(0.0, 1.0 / n, t) * smoothstep(1.0, 0.85, t);
        float core = 1.0 - smoothstep(lw, lw + px * 1.2, d);
        float glow = uGlow * 0.55 * exp(-d / glowR);
        col += palette(t) * (core + glow) * fade;
    }
    col += palette(0.0) * exp(-r * r / 0.004) * (0.15 + uReact * (uLevel * 0.35 + uPulse * 0.5)) * uGlow;
    return col;
}
`;

const AURORA_SRC = `
vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float layers = floor(mix(2.0, 5.0, uDensity) + 0.5);
    float height = mix(0.12, 0.55, uThick);
    vec3 col = vec3(0.0);
    for (int j = 0; j < 5; j++) {
        float fj = float(j);
        if (fj >= layers) break;
        float lt = layers > 1.0 ? fj / (layers - 1.0) : 0.5;
        float t = uTime * (0.05 + 0.02 * fj);
        float band = bandAt(0.1 + 0.8 * lt);
        float x = p.x + fj * 1.37;
        float fold = fbm(vec2(x * 0.7 + t, fj * 2.3)) - 0.5;
        float curve = mix(-0.3, 0.1, lt) + fold * mix(0.1, 0.6, uAmp) + 0.05 * sin(x * 2.3 + t * 3.0) + band * uReact * 0.08;
        float dy = p.y - curve;
        float body = dy >= 0.0 ? exp(-dy / height) : exp(dy / 0.012);
        float rays = fbm(vec2(x * 24.0 + fold * 7.0 + t * 2.0, fj * 7.1));
        rays = mix(0.35, 1.6, smoothstep(0.3, 0.8, rays));
        float shimmer = 0.8 + 0.2 * sin(x * 9.0 - uTime * 2.2 + fj * 1.7);
        float energy = 0.5 + uReact * (band * 1.1 + uPulse * 0.35);
        vec3 c = mix(palette(lt * 0.25), palette(1.0), smoothstep(0.0, height * 1.6, dy));
        col += c * body * rays * shimmer * energy * (0.35 + 0.5 * uGlow);
    }
    col += palette(0.6) * 0.035 * smoothstep(0.7, -0.5, p.y) * uSolidBg;
    vec2 cell = floor(gl_FragCoord.xy / 3.0);
    float star = step(0.9975, hash(cell)) * (0.5 + 0.5 * sin(uClock * 2.0 + hash(cell + 3.7) * TAU));
    col += vec3(star) * 0.55 * uSolidBg * (1.0 - clamp(length(col) * 2.0, 0.0, 1.0));
    return col;
}
`;

const ORBS_SRC = `
float orbField(vec2 p, out vec3 tint, out vec3 halo) {
    float aspect = uRes.x / uRes.y;
    float n = floor(mix(3.0, 14.0, uDensity) + 0.5);
    float field = 0.0;
    tint = vec3(0.0);
    halo = vec3(0.0);
    for (int i = 0; i < 14; i++) {
        float fi = float(i);
        if (fi >= n) break;
        vec2 seed = vec2(hash(vec2(fi, 1.3)), hash(vec2(fi, 7.7)));
        float t = uTime * (0.12 + seed.x * 0.2);
        vec2 c = vec2(sin(t * 1.3 + seed.x * TAU) * aspect * 0.4, cos(t * 0.9 + seed.y * TAU) * 0.34);
        float lt = n > 1.0 ? fi / (n - 1.0) : 0.5;
        float band = bandAt(lt);
        float r = mix(0.035, 0.2, uThick) * (0.65 + seed.y * 0.7) * (1.0 + uReact * (band * mix(0.1, 0.6, uAmp) + uPulse * 0.08));
        vec2 d = p - c;
        float q = clamp(1.0 - dot(d, d) / (r * r * 4.0), 0.0, 1.0);
        float f = q * q * q;
        field += f;
        vec3 pc = palette(lt);
        tint += pc * (f + 1e-4);
        halo += pc * exp(-length(d) / (r * 1.2));
    }
    tint /= max(field + 1e-4 * n, 1e-4);
    return field;
}

vec3 scene(vec2 p) {
    vec3 tint;
    vec3 halo;
    vec3 t2;
    vec3 h2;
    float e = 2.0 * pixel();
    float f = orbField(p, tint, halo);
    float fx = orbField(p + vec2(e, 0.0), t2, h2);
    float fy = orbField(p + vec2(0.0, e), t2, h2);
    vec2 grad = vec2(fx - f, fy - f) / e;
    vec3 nrm = normalize(vec3(-grad * 0.035, 1.0));
    vec3 light = normalize(vec3(-0.45, 0.55, 0.7));
    float diffuse = clamp(dot(nrm, light), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-light, nrm), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 28.0);
    float soft = mix(0.01, 0.2, clamp(uGlow / 1.5, 0.0, 1.0));
    float body = smoothstep(0.42 - soft, 0.42 + soft * 0.3, f);
    float rim = smoothstep(0.42, 0.5, f) * (1.0 - smoothstep(0.5, 0.75, f));
    vec3 lit = tint * (0.28 + 0.72 * diffuse) + tint * rim * 0.5 + vec3(spec) * 0.55;
    return lit * body * 0.85 + halo * uGlow * 0.07;
}
`;

const HORIZON_SRC = `
vec3 scene(vec2 p) {
    float R = span();
    float aspect = uRes.x / uRes.y;
    float yh = mix(-0.2, 0.18, uPersp);
    vec3 col = vec3(0.0);
    float dens = mix(1.5, 7.0, uDensity);
    float thick = mix(0.6, 3.5, uThick);
    if (p.y < yh) {
        float dy = yh - p.y;
        float z = 0.35 / dy;
        vec2 w = vec2(p.x * z, z + uTime * 1.6);
        vec2 g = w * dens * 0.35;
#ifdef HAS_DERIV
        vec2 fw = max(fwidth(g), vec2(1e-4));
#else
        vec2 fw = vec2(dens * z / uRes.y, dens * z * z / uRes.y);
#endif
        vec2 gd = abs(fract(g + 0.5) - 0.5) / fw;
        float line = min(gd.x, gd.y);
        float lod = smoothstep(0.12, 0.45, max(fw.x, fw.y));
        float core = (1.0 - smoothstep(thick * 0.5, thick * 0.5 + 1.2, line)) * (1.0 - lod);
        float glow = uGlow * 0.4 * exp(-line / mix(2.0, 14.0, uGlow)) * (1.0 - lod) + lod * (0.12 + 0.12 * uGlow);
        float fog = exp(-z * 0.08) * smoothstep(0.0, 0.02, dy);
        float beat = 1.0 + uReact * uPulse * 0.8;
        col += palette(clamp(0.2 + z * 0.02, 0.0, 1.0)) * (core + glow) * fog * beat;
        col += palette(0.6) * exp(-dy * 18.0) * 0.35 * (0.6 + uReact * uLevel);
        col += mix(palette(0.0), palette(1.0), 0.5) * exp(-abs(p.x) * 5.0) * exp(-dy * 6.0) * 0.2 * (0.6 + 0.4 * sin(z * 8.0 - uTime * 4.0));
    } else {
        float sy = p.y - yh;
        float sun = length(vec2(p.x, sy - 0.2));
        float sr = 0.2 * (1.0 + uReact * uPulse * 0.05);
        float lower = clamp((0.2 - sy) / sr, 0.0, 1.0);
        float stripes = step(lower * 0.7, fract((sy + uTime * 0.02) * 24.0));
        float disc = (1.0 - smoothstep(sr - 0.003, sr + 0.003, sun)) * stripes;
        float vert = clamp((0.2 + sr - sy) / (2.0 * sr), 0.0, 1.0);
        col += mix(palette(0.0) * 1.25, palette(1.0), vert) * disc;
        col += mix(palette(0.0), palette(1.0), 0.5) * exp(-max(sun - sr, 0.0) * 7.0) * 0.3 * uGlow;
        float u = p.x / (2.0 * R * aspect / length(vec2(aspect, 1.0))) + 0.5;
        float ax = abs(u * 2.0 - 1.0);
        float spec = histAt(uMirror > 0.5 ? ax : u, 1.0 - uHistFrac);
        float hills = (fbm(vec2(p.x * 3.0, 1.7)) * 0.08 + spec * mix(0.04, 0.3, uAmp)) * (0.4 + ax * 0.9);
        float mtn = sy - hills;
        float edge = abs(mtn);
        if (mtn < 0.0) col = palette(1.0) * 0.05 * smoothstep(-0.25, 0.0, mtn);
        float px = pixel();
        col += palette(0.75) * ((1.0 - smoothstep(thick * px * 0.6, thick * px * 0.6 + px * 1.2, edge)) + uGlow * 0.5 * exp(-edge / mix(0.002, 0.02, uGlow)));
        vec2 cell = floor(gl_FragCoord.xy / 3.0);
        float star = step(0.9965, hash(cell)) * step(0.0, mtn) * (1.0 - step(sun, sr + 0.02)) * (0.5 + 0.5 * sin(uClock * 1.7 + hash(cell + 1.3) * TAU));
        col += vec3(star) * 0.5 * uSolidBg;
    }
    return col;
}
`;

const NEBULA_SRC = `
vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float scale = mix(0.8, 3.0, uDensity);
    vec2 q = p * scale;
    float t = uTime * 0.08;
    vec2 w1 = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3 - t)));
    float warp = mix(0.6, 3.2, uAmp) * (1.0 + uReact * uLevel * 0.4);
    vec2 w2 = vec2(fbm(q + warp * w1 + vec2(1.7, 9.2) + t * 0.7), fbm(q + warp * w1 + vec2(8.3, 2.8) - t * 0.5));
    float v = fbm(q + warp * w2);
    float contrast = mix(1.0, 3.2, uThick);
    float dens = pow(clamp(v * 1.25, 0.0, 1.0), contrast) * 2.0;
    vec3 c = mix(palette(0.0), palette(1.0), clamp(length(w2) * 0.9, 0.0, 1.0));
    c = mix(c, palette(0.5) * 1.3, smoothstep(0.55, 0.9, v) * 0.45);
    float energy = 0.55 + uReact * (bandAt(v) * 0.6 + uPulse * 0.35);
    vec3 col = c * dens * energy * (0.5 + 0.5 * uGlow);
    vec2 cell = floor(gl_FragCoord.xy / 3.0);
    float star = step(0.997, hash(cell)) * (0.5 + 0.5 * sin(uClock * 1.5 + hash(cell + 5.1) * TAU));
    col += vec3(star) * 0.5 * uSolidBg * (1.0 - clamp(dens, 0.0, 1.0));
    return col;
}
`;

const TUNNEL_SRC = `
vec3 scene(vec2 p) {
    float R = span();
    vec2 bend = vec2(sin(uTime * 0.21), cos(uTime * 0.17)) * 0.1;
    vec2 q = p - bend * (1.0 - smoothstep(0.0, R, length(p)));
    q = rot(uAngle) * q;
    float r = max(length(q), 1e-4);
    float a = atan(q.y, q.x) / TAU + 0.5;
    float u = uMirror > 0.5 ? abs(a * 2.0 - 1.0) : a;
    float seam = uMirror > 0.5 ? 1.0 : smoothstep(0.0, 0.05, a) * smoothstep(1.0, 0.95, a);
    float depth = mix(0.1, 0.35, uPersp);
    float row = clamp(depth / r * 5.0 - 2.0, 0.0, HIST_ROWS - 1.0);
    float bulge = mix(0.0, 0.4, uAmp) * histMusic(u, row) * seam;
    float z = depth / (r * (1.0 + bulge));
    float flow = uTime * 0.9 + uPulse * uReact * 0.12;
    float arms = floor(mix(2.0, 9.0, uDensity));
    float spin = log(max(z, 1e-3)) * 0.32;
    float phase = (a + spin) * arms - flow * 1.5;
#ifdef HAS_DERIV
    float fp = max(min(fwidth(phase), fwidth((fract(a + 0.5) + spin) * arms)), 1e-4);
#else
    float fp = arms * (1.0 / TAU + 0.32) / (r * uRes.y);
#endif
    float lp = abs(fract(phase + 0.5) - 0.5) / fp;
    float thick = mix(0.8, 5.0, uThick);
    float lod = smoothstep(0.2, 0.6, fp);
    float filament = (1.0 - smoothstep(thick * 0.5, thick * 0.5 + 1.5, lp)) * (1.0 - lod);
    float halo = uGlow * 0.5 * exp(-lp / mix(3.0, 18.0, min(uGlow, 1.0))) * (1.0 - lod) + lod * 0.12;
    float ang = (a + spin * 0.8) * TAU;
    vec2 circle = vec2(cos(ang), sin(ang)) * 2.2;
    float gas = fbm(circle + vec2(z * 0.9 - flow, z * 0.4 + flow * 0.3));
    gas = pow(smoothstep(0.25, 0.85, gas), 1.6) * (0.7 + 0.8 * uReact * uLevel);
    float near = smoothstep(0.0, 0.14, r) * mix(1.0, 0.25, smoothstep(0.25, 1.0, r / R));
    float fade = 1.0 - exp(-z * 1.2);
    vec3 wall = mix(palette(0.0), palette(1.0), smoothstep(0.6, 5.0, z));
    float bands = 0.65 + 0.35 * sin(log(max(z, 1e-3)) * 9.0 - flow * 4.0);
    vec3 col = wall * (gas * 0.9 * bands + (filament + halo) * 0.8) * near * fade;
    float coreR = 0.03 * (1.0 + uPulse * uReact * 0.35);
    vec3 light = mix(palette(1.0), vec3(1.0), 0.45);
    col += light * exp(-r * r / (coreR * coreR * 1.5)) * (0.7 + 0.5 * uGlow);
    col += palette(0.5) * exp(-abs(r - coreR * 1.8) / 0.004) * 0.5 * (0.4 + uGlow);
    col += light * exp(-r / 0.12) * 0.12 * (0.5 + uGlow + uReact * uLevel);
    vec2 lens = q * (1.0 + 0.012 / (r * r));
    vec2 cell = floor(lens * 90.0);
    vec2 fc = fract(lens * 90.0) - 0.5;
    float star = step(0.992, hash(cell)) * smoothstep(0.35, 0.0, length(fc)) * (0.6 + 0.4 * sin(uClock * 1.7 + hash(cell + 2.3) * TAU));
    col += vec3(star) * 0.6 * uSolidBg * smoothstep(0.35, 0.9, r / R) * (1.0 - clamp(gas + filament, 0.0, 1.0));
    return col;
}
`;

const HYPERSPACE_SRC = `
vec3 scene(vec2 p) {
    float R = span();
    float r = length(p);
    float a = atan(p.y, p.x) / TAU + 0.5;
    float bins = floor(mix(40.0, 180.0, uDensity));
    float px = pixel();
    float size = mix(0.5, 2.5, uThick) * px;
    float streak = mix(0.05, 0.65, uAmp) * (1.0 + uReact * (uPulse * 1.2 + uLevel * 0.4));
    float glowR = mix(0.002, 0.012, min(uGlow, 1.0));
    vec3 col = vec3(0.0);
    float kb = floor(a * bins);
    for (int di = -1; di <= 1; di++) {
        float k = mod(kb + float(di), bins);
        for (int s = 0; s < 3; s++) {
            vec2 seed = vec2(k, float(s) * 17.3);
            float h1 = hash(seed);
            float h2 = hash(seed + 3.1);
            float h3 = hash(seed + 7.7);
            float ang = ((k + h1) / bins - 0.5) * TAU;
            vec2 dir = vec2(cos(ang), sin(ang));
            float life = fract(h2 + uTime * (0.1 + h3 * 0.16));
            float head = pow(life, 2.2) * R * 1.3 + 0.02;
            float tail = max(head * (1.0 - streak * life), 0.015);
            float proj = clamp(dot(p, dir), tail, head);
            float d = length(p - dir * proj);
            float along = clamp((proj - tail) / max(head - tail, 1e-4), 0.0, 1.0);
            float bright = smoothstep(0.0, 0.2, life) * (0.35 + life);
            float core = 1.0 - smoothstep(size, size + px * 1.5, d);
            float glow = uGlow * 0.4 * exp(-d / glowR);
            col += palette(h3) * (core + glow) * bright * mix(0.2, 1.0, along);
        }
    }
    col += palette(0.0) * exp(-r * r / 0.01) * (0.1 + uReact * uPulse * 0.4) * uGlow;
    return col;
}
`;

const PULSE_SRC = `
vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float R = span();
    float n = floor(mix(2.0, 7.0, uDensity) + 0.5);
    float px = pixel();
    float thick = mix(0.6, 4.0, uThick) * px;
    float glowR = mix(0.003, 0.03, min(uGlow, 1.0));
    float x = p.x / R;
    float env = pow(max(1.0 - x * x, 0.0), 2.0);
    float band = bandAt(uMirror > 0.5 ? abs(x) : x * 0.5 + 0.5);
    vec3 col = vec3(0.0);
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        if (fi >= n) break;
        float lt = n > 1.0 ? fi / (n - 1.0) : 0.5;
        float freq = mix(3.0, 9.0, hash(vec2(fi, 2.0)));
        float phase = uTime * (0.8 + fi * 0.37) + fi * 1.9;
        float height = mix(0.04, 0.34, uAmp) * (0.25 + uReact * (0.9 * band + 0.5 * uLevel) + 0.12 * sin(uTime * 0.7 + fi));
        float w = sin(x * freq + phase);
        float y = w * env * height;
        float slope = cos(x * freq + phase) * freq / R * env * height;
        float d = abs(p.y - y) / sqrt(1.0 + slope * slope);
        float core = 1.0 - smoothstep(thick, thick + px * 1.2, d);
        float glow = uGlow * 0.5 * exp(-d / glowR);
        float inside = step(0.0, p.y * y) * step(abs(p.y), abs(y)) * pow(abs(p.y) / max(abs(y), 1e-4), 1.5);
        col += palette(lt) * (core + glow + inside * 0.16 * (0.5 + 0.5 * uGlow));
    }
    return col;
}
`;

const DOTS_SRC = `
vec3 scene(vec2 p) {
    p = rot(uAngle) * p;
    float R = span();
    float cells = mix(18.0, 70.0, uDensity);
    vec2 g = p * cells;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 c = (id + 0.5) / cells;
    float x = c.x / R;
    float u = uMirror > 0.5 ? abs(x) : x * 0.5 + 0.5;
    float top = R;
    float k = (top - c.y) * cells * mix(0.5, 1.5, uAmp) - uHistFrac;
    float v = histAt(u, max(k, 0.0)) * smoothstep(HIST_ROWS - 1.0, HIST_ROWS - 12.0, k);
    v = smoothstep(0.18, 0.9, v * (0.8 + uReact * 0.4));
    float radius = mix(0.05, mix(0.25, 0.5, uThick), v);
    float px = pixel() * cells;
    float d = length(f);
    float core = 1.0 - smoothstep(radius, radius + px * 1.2, d);
    float glow = uGlow * 0.35 * exp(-max(d - radius, 0.0) / mix(0.04, 0.25, min(uGlow, 1.0))) * v;
    return palette(v) * (core * (0.08 + 0.92 * v * v) + glow);
}
`;

const MAIN_SRC = `
void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 col = max(scene(p), 0.0) * uBright;
    col = 1.0 - exp(-col * 1.6);
    vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float vig = uVignette * smoothstep(0.25, 1.0, length(q) * 1.25);
    float g = (hash(gl_FragCoord.xy + fract(uClock * 7.13) * 91.7) - 0.5) * uGrain;
    if (uSolidBg > 0.5) {
        gl_FragColor = vec4(clamp((uBg + col) * (1.0 - vig) + g, 0.0, 1.0), 1.0);
    } else {
        float a = min(max(col.r, max(col.g, col.b)) * 1.5, 1.0);
        vec3 rgb = clamp(col * (1.0 - vig) + g * a, 0.0, 1.0);
        gl_FragColor = vec4(rgb, clamp(a * (1.0 - vig) + vig, 0.0, 1.0));
    }
}
`;

const STYLE_SRC: Record<string, string> = {
    ridges: RIDGES_SRC,
    silk: SILK_SRC,
    halo: HALO_SRC,
    aurora: AURORA_SRC,
    orbs: ORBS_SRC,
    horizon: HORIZON_SRC,
    nebula: NEBULA_SRC,
    tunnel: TUNNEL_SRC,
    hyperspace: HYPERSPACE_SRC,
    pulse: PULSE_SRC,
    dots: DOTS_SRC,
};

const SHADERS = { vertex: VERTEX_SRC, common: COMMON_SRC, main: MAIN_SRC, styles: STYLE_SRC };

interface CoreSettings {
    version: number;
    style: string;
    solidBg: boolean;
    colA: Rgb;
    colB: Rgb;
    bg: Rgb;
    density: number;
    thickness: number;
    amplitude: number;
    angle: number;
    perspective: number;
    glow: number;
    brightness: number;
    grain: number;
    vignette: number;
    hue: number;
    react: number;
    mirror: boolean;
    solid: boolean;
    spectrum: boolean;
    speed: number;
    idle: number;
    scale: number;
    interval: number;
}

interface CoreAudio {
    levels: number[];
    overall: number;
    pulse: number;
    playing: boolean;
}

interface Core {
    setSettings(settings: CoreSettings): void;
    setAudio(audio: CoreAudio): void;
    setSize(width: number, height: number, ratio: number): void;
    setVisible(visible: boolean): void;
    frame(ts: number): void;
    dispose(): void;
}

function renderCore(canvas: any, shaders: typeof SHADERS, report: (text: string) => void): Core {
    const HIST_W = 128;
    const HIST_H = 64;
    const BANDS = 10;
    const ROWS_PER_SECOND = 16;
    const UNIFORM_NAMES = [
        'uRes', 'uTime', 'uClock', 'uColA', 'uColB', 'uBg', 'uSolidBg', 'uLevel', 'uPulse', 'uBands',
        'uDensity', 'uThick', 'uAmp', 'uAngle', 'uPersp', 'uGlow', 'uBright', 'uGrain', 'uVignette',
        'uHue', 'uReact', 'uMirror', 'uSolid', 'uSpectrum', 'uHist', 'uHistFrac',
    ];

    let settings: CoreSettings | null = null;
    let audio: CoreAudio = { levels: [], overall: 0, pulse: 0, playing: false };
    let cssW = 0;
    let cssH = 0;
    let ratio = 1;
    let visible = true;
    let gl: WebGLRenderingContext | null = null;
    let deriv = false;
    let lost = false;
    let disposed = false;
    const programs = new Map<string, { program: WebGLProgram; aPos: number; u: Record<string, WebGLUniformLocation | null> } | null>();
    let quad: WebGLBuffer | null = null;
    let hist: WebGLTexture | null = null;
    let uploaded = -1;
    const histBytes = new Uint8Array(HIST_W * HIST_H * 2);
    let histVersion = 0;
    let histAccum = 0;
    let rowSeed = Math.random() * 100;
    const bands = new Float32Array(BANDS);
    let level = 0;
    let pulse = 0;
    const curA = [0.37, 0.92, 0.83];
    const curB = [0.15, 0.39, 0.92];
    let colorsReady = false;
    let colorsSettled = false;
    let time = 0;
    let clock = 0;
    let lastTs = 0;
    let lastDraw = 0;
    let refreshMs = 1000 / 60;
    let drawnKey = '';

    const smoothNoise = (x: number): number => {
        const i = Math.floor(x);
        const f = x - i;
        const u = f * f * (3 - 2 * f);
        const h = (n: number) => {
            const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
            return s - Math.floor(s);
        };
        return h(i) * (1 - u) + h(i + 1) * u;
    };

    const bandInterp = (x: number): number => {
        const f = Math.min(Math.max(x, 0), 1) * (BANDS - 1);
        const i = Math.min(Math.floor(f), BANDS - 2);
        const t = f - i;
        const s = t * t * (3 - 2 * t);
        return bands[i] + (bands[i + 1] - bands[i]) * s;
    };

    const pushRow = (react: number): void => {
        histBytes.copyWithin(HIST_W * 2, 0, HIST_W * 2 * (HIST_H - 1));
        rowSeed += 0.11;
        for (let x = 0; x < HIST_W; x++) {
            const u = x / (HIST_W - 1);
            const detail = 0.55 + 0.45 * smoothNoise(u * 22 + rowSeed * 9.3);
            const spectrum = bandInterp(u) * detail * react;
            const calm = (smoothNoise(u * 7 + rowSeed) * 0.6 + smoothNoise(u * 17 - rowSeed * 1.7) * 0.4) * 0.22;
            histBytes[x * 2] = Math.round(Math.min(Math.max(spectrum * 0.9, 0), 1) * 255);
            histBytes[x * 2 + 1] = Math.round(Math.min(Math.max(calm, 0), 1) * 255);
        }
        histVersion++;
    };

    const init = (): void => {
        gl = (gl || canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
        })) as WebGLRenderingContext | null;
        if (!gl) return;
        deriv = !!gl.getExtension('OES_standard_derivatives');
        quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        hist = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, hist);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, HIST_W, HIST_H, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, histBytes);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        uploaded = histVersion;
    };

    const onLost = (e: Event): void => {
        e.preventDefault();
        lost = true;
    };

    const onRestored = (): void => {
        lost = false;
        programs.clear();
        uploaded = -1;
        drawnKey = '';
        init();
    };

    if (typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('webglcontextlost', onLost);
        canvas.addEventListener('webglcontextrestored', onRestored);
    }

    const compile = (type: number, src: string): WebGLShader | null => {
        const g = gl as WebGLRenderingContext;
        const shader = g.createShader(type);
        if (!shader) return null;
        g.shaderSource(shader, src);
        g.compileShader(shader);
        if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) {
            if (!g.isContextLost()) report(`Animated background shader failed to compile: ${g.getShaderInfoLog(shader)}`);
            g.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const program = (style: string) => {
        if (programs.has(style)) return programs.get(style) || null;
        const g = gl as WebGLRenderingContext;
        const header = deriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n' : '';
        const vs = compile(g.VERTEX_SHADER, shaders.vertex);
        const fs = compile(g.FRAGMENT_SHADER, header + shaders.common + (shaders.styles[style] || shaders.styles.ridges) + shaders.main);
        let result: { program: WebGLProgram; aPos: number; u: Record<string, WebGLUniformLocation | null> } | null = null;
        if (vs && fs) {
            const prog = g.createProgram();
            if (prog) {
                g.attachShader(prog, vs);
                g.attachShader(prog, fs);
                g.linkProgram(prog);
                if (g.getProgramParameter(prog, g.LINK_STATUS)) {
                    const u: Record<string, WebGLUniformLocation | null> = {};
                    UNIFORM_NAMES.forEach(name => {
                        u[name] = g.getUniformLocation(prog, name === 'uBands' ? 'uBands[0]' : name);
                    });
                    result = { program: prog, aPos: g.getAttribLocation(prog, 'aPos'), u };
                } else {
                    if (!g.isContextLost()) report(`Animated background shader failed to link: ${g.getProgramInfoLog(prog)}`);
                    g.deleteProgram(prog);
                }
            }
        }
        if (vs) g.deleteShader(vs);
        if (fs) g.deleteShader(fs);
        if (!g.isContextLost()) programs.set(style, result);
        return result;
    };

    const syncSize = (s: CoreSettings): boolean => {
        if (cssW < 2 || cssH < 2) return false;
        const scale = s.scale * Math.min(ratio || 1, 2);
        const tw = Math.max(1, Math.round(cssW * scale));
        const th = Math.max(1, Math.round(cssH * scale));
        if (canvas.width !== tw || canvas.height !== th) {
            canvas.width = tw;
            canvas.height = th;
            drawnKey = '';
        }
        return true;
    };

    const easeColors = (dt: number, s: CoreSettings): void => {
        if (!colorsReady) {
            for (let i = 0; i < 3; i++) {
                curA[i] = s.colA[i];
                curB[i] = s.colB[i];
            }
            colorsReady = true;
            colorsSettled = true;
            return;
        }
        const k = 1 - Math.exp(-dt * 3);
        let delta = 0;
        for (let i = 0; i < 3; i++) {
            curA[i] += (s.colA[i] - curA[i]) * k;
            curB[i] += (s.colB[i] - curB[i]) * k;
            delta = Math.max(delta, Math.abs(s.colA[i] - curA[i]), Math.abs(s.colB[i] - curB[i]));
        }
        colorsSettled = delta < 0.002;
        if (colorsSettled) {
            for (let i = 0; i < 3; i++) {
                curA[i] = s.colA[i];
                curB[i] = s.colB[i];
            }
        }
    };

    const draw = (s: CoreSettings, key: string): void => {
        const g = gl;
        if (!g || lost || g.isContextLost()) return;
        if (!syncSize(s)) return;
        if (key && key === drawnKey) return;
        const prog = program(s.style);
        g.viewport(0, 0, canvas.width, canvas.height);
        if (!prog) {
            g.clearColor(0, 0, 0, 0);
            g.clear(g.COLOR_BUFFER_BIT);
            drawnKey = key;
            return;
        }
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, hist);
        if (uploaded !== histVersion) {
            g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
            g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, HIST_W, HIST_H, g.LUMINANCE_ALPHA, g.UNSIGNED_BYTE, histBytes);
            uploaded = histVersion;
        }
        g.useProgram(prog.program);
        g.bindBuffer(g.ARRAY_BUFFER, quad);
        g.enableVertexAttribArray(prog.aPos);
        g.vertexAttribPointer(prog.aPos, 2, g.FLOAT, false, 0, 0);
        const u = prog.u;
        g.uniform2f(u.uRes, canvas.width, canvas.height);
        g.uniform1f(u.uTime, time);
        g.uniform1f(u.uClock, clock);
        g.uniform3f(u.uColA, curA[0], curA[1], curA[2]);
        g.uniform3f(u.uColB, curB[0], curB[1], curB[2]);
        g.uniform3f(u.uBg, s.bg[0], s.bg[1], s.bg[2]);
        g.uniform1f(u.uSolidBg, s.solidBg ? 1 : 0);
        g.uniform1f(u.uLevel, level);
        g.uniform1f(u.uPulse, pulse);
        g.uniform1fv(u.uBands, bands);
        g.uniform1f(u.uDensity, s.density);
        g.uniform1f(u.uThick, s.thickness);
        g.uniform1f(u.uAmp, s.amplitude);
        g.uniform1f(u.uAngle, s.angle);
        g.uniform1f(u.uPersp, s.perspective);
        g.uniform1f(u.uGlow, s.glow);
        g.uniform1f(u.uBright, s.brightness);
        g.uniform1f(u.uGrain, s.grain);
        g.uniform1f(u.uVignette, s.vignette);
        g.uniform1f(u.uHue, s.hue);
        g.uniform1f(u.uReact, s.react);
        g.uniform1f(u.uMirror, s.mirror ? 1 : 0);
        g.uniform1f(u.uSolid, s.solid ? 1 : 0);
        g.uniform1f(u.uSpectrum, s.spectrum ? 1 : 0);
        g.uniform1i(u.uHist, 0);
        g.uniform1f(u.uHistFrac, histAccum);
        g.disable(g.BLEND);
        g.drawArrays(g.TRIANGLES, 0, 6);
        drawnKey = key;
    };

    const frame = (ts: number): void => {
        const s = settings;
        if (disposed || !s) return;
        const delta = lastTs ? ts - lastTs : 0;
        lastTs = ts;
        if (delta > 2 && delta < 40) refreshMs += (delta - refreshMs) * 0.05;
        if (s.interval > 0 && lastDraw && ts - lastDraw < s.interval - refreshMs * 0.5) return;
        const dt = lastDraw ? Math.min((ts - lastDraw) / 1000, 0.25) : 1 / 60;
        lastDraw = ts;

        const activity = audio.playing ? 1 : s.idle;
        const advance = dt * s.speed * activity;
        time += advance;
        clock += dt;

        const follow = 1 - Math.exp(-dt * 30);
        let moving = false;
        for (let k = 0; k < BANDS; k++) {
            const target = audio.levels[k] || 0;
            const next = bands[k] + (target - bands[k]) * follow;
            if (Math.abs(next - bands[k]) > 0.001) moving = true;
            bands[k] = next;
        }
        level += (audio.overall - level) * follow;
        pulse += (audio.pulse - pulse) * follow;

        histAccum += advance * ROWS_PER_SECOND;
        let pushes = 0;
        while (histAccum >= 1 && pushes < HIST_H) {
            histAccum -= 1;
            pushes++;
            pushRow(s.react);
        }
        if (histAccum >= 1) histAccum %= 1;

        const wasSettled = colorsSettled;
        easeColors(dt, s);
        if (!visible) return;
        const animating = advance > 0 || moving || level > 0.002 || pulse > 0.002 || s.hue > 0 || !wasSettled;
        draw(s, animating ? '' : `${s.version}:${histVersion}`);
    };

    init();

    return {
        setSettings(next: CoreSettings): void {
            settings = next;
            drawnKey = '';
        },
        setAudio(next: CoreAudio): void {
            audio = next;
        },
        setSize(width: number, height: number, nextRatio: number): void {
            cssW = width;
            cssH = height;
            ratio = nextRatio;
            drawnKey = '';
        },
        setVisible(next: boolean): void {
            if (next && !visible) drawnKey = '';
            visible = next;
        },
        frame,
        dispose(): void {
            disposed = true;
            if (typeof canvas.removeEventListener === 'function') {
                canvas.removeEventListener('webglcontextlost', onLost);
                canvas.removeEventListener('webglcontextrestored', onRestored);
            }
            const g = gl;
            if (g && !g.isContextLost()) {
                programs.forEach(p => { if (p) g.deleteProgram(p.program); });
                if (quad) g.deleteBuffer(quad);
                if (hist) g.deleteTexture(hist);
                g.getExtension('WEBGL_lose_context')?.loseContext();
            }
            programs.clear();
            gl = null;
        },
    };
}

function workerBoot(factory: typeof renderCore): void {
    const scope = self as any;
    let core: Core | null = null;
    let raf = 0;
    const loop = (ts: number): void => {
        raf = scope.requestAnimationFrame(loop);
        if (core) core.frame(ts);
    };
    scope.onmessage = (e: MessageEvent): void => {
        const msg = e.data || {};
        if (msg.type === 'init') {
            try {
                core = factory(msg.canvas, msg.shaders, (text: string) => scope.postMessage({ type: 'warn', text }));
                raf = scope.requestAnimationFrame(loop);
                scope.postMessage({ type: 'ready' });
            } catch (err) {
                scope.postMessage({ type: 'failed', text: String(err) });
            }
            return;
        }
        if (!core) return;
        if (msg.type === 'settings') core.setSettings(msg.value);
        else if (msg.type === 'audio') core.setAudio(msg.value);
        else if (msg.type === 'size') core.setSize(msg.width, msg.height, msg.ratio);
        else if (msg.type === 'visible') core.setVisible(msg.value);
        else if (msg.type === 'dispose') {
            scope.cancelAnimationFrame(raf);
            core.dispose();
            core = null;
            scope.close();
        }
    };
}

let workerUrl: string | null = null;
let workersBroken = false;

function workerSource(): string | null {
    if (workersBroken) return null;
    if (!workerUrl) {
        try {
            const src = `(${workerBoot.toString()})(${renderCore.toString()});`;
            workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        } catch (e) {
            workersBroken = true;
            return null;
        }
    }
    return workerUrl;
}

class Renderer {
    readonly layer: HTMLElement;
    canvas: HTMLCanvasElement;
    private worker: Worker | null = null;
    private core: Core | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private cssW = -1;
    private cssH = -1;
    private shown = true;
    private videoCovering = false;
    private videoCheckedAt = 0;
    private lastSettings: CoreSettings | null = null;

    constructor(doc: Document) {
        this.layer = doc.createElement('div');
        this.layer.id = ANIM_BG_LAYER_ID;
        this.layer.setAttribute('aria-hidden', 'true');
        this.canvas = doc.createElement('canvas');
        this.layer.appendChild(this.canvas);
        this.start();
    }

    private start(): void {
        const url = typeof Worker !== 'undefined' && typeof (this.canvas as any).transferControlToOffscreen === 'function'
            ? workerSource()
            : null;
        if (url) {
            try {
                const offscreen = (this.canvas as any).transferControlToOffscreen();
                const worker = new Worker(url);
                worker.onmessage = (e: MessageEvent) => {
                    const msg = e.data || {};
                    if (msg.type === 'warn') warn(msg.text);
                    else if (msg.type === 'failed') this.fallBack(msg.text);
                };
                worker.onerror = (e: ErrorEvent) => {
                    e.preventDefault();
                    this.fallBack(e.message);
                };
                worker.postMessage({ type: 'init', canvas: offscreen, shaders: SHADERS }, [offscreen]);
                this.worker = worker;
            } catch (e) {
                this.fallBack(String(e));
            }
        } else {
            this.core = renderCore(this.canvas, SHADERS, text => warn(text));
        }
        this.observe();
    }

    private fallBack(reason: string): void {
        if (this.core) return;
        warn('Animated background worker unavailable, rendering on the main thread:', reason);
        workersBroken = true;
        this.worker?.terminate();
        this.worker = null;
        const fresh = this.layer.ownerDocument.createElement('canvas');
        this.canvas.replaceWith(fresh);
        this.canvas = fresh;
        this.core = renderCore(fresh, SHADERS, text => warn(text));
        if (this.lastSettings) this.core.setSettings(this.lastSettings);
        this.cssW = -1;
        this.cssH = -1;
        this.observe();
    }

    private observe(): void {
        this.resizeObserver?.disconnect();
        if (typeof ResizeObserver === 'undefined') return;
        this.resizeObserver = new ResizeObserver(entries => {
            const rect = entries[entries.length - 1]?.contentRect;
            if (!rect) return;
            this.cssW = rect.width;
            this.cssH = rect.height;
            const view = this.layer.ownerDocument.defaultView || window;
            this.send({ type: 'size', width: rect.width, height: rect.height, ratio: view.devicePixelRatio || 1 });
        });
        this.resizeObserver.observe(this.canvas);
    }

    private send(msg: any): void {
        if (this.worker) {
            this.worker.postMessage(msg);
            return;
        }
        const core = this.core;
        if (!core) return;
        if (msg.type === 'settings') core.setSettings(msg.value);
        else if (msg.type === 'audio') core.setAudio(msg.value);
        else if (msg.type === 'size') core.setSize(msg.width, msg.height, msg.ratio);
        else if (msg.type === 'visible') core.setVisible(msg.value);
    }

    settings(value: CoreSettings): void {
        this.lastSettings = value;
        this.send({ type: 'settings', value });
    }

    audio(value: CoreAudio): void {
        this.send({ type: 'audio', value });
    }

    tick(ts: number): void {
        if (ts - this.videoCheckedAt > 500 || ts < this.videoCheckedAt) {
            this.videoCheckedAt = ts;
            const page = this.layer.closest('#SpicyLyricsPage');
            const video = page && page.classList.contains('st-mv-active')
                ? page.querySelector<HTMLElement>(`:scope > #${MUSIC_VIDEO_ID}`)
                : null;
            this.videoCovering = !!video && video.getClientRects().length > 0;
        }
        const shown = this.layer.isConnected && !this.videoCovering && this.cssW > 1 && this.cssH > 1;
        if (shown !== this.shown) {
            this.shown = shown;
            this.send({ type: 'visible', value: shown });
        }
        if (this.core) this.core.frame(ts);
    }

    destroy(): void {
        this.resizeObserver?.disconnect();
        if (this.worker) {
            this.worker.postMessage({ type: 'dispose' });
            const worker = this.worker;
            setTimeout(() => worker.terminate(), 1000);
            this.worker = null;
        }
        this.core?.dispose();
        this.core = null;
        this.layer.remove();
    }
}

const renderers = new Map<HTMLElement, Renderer>();
let rafId: number | null = null;
let configVersion = 0;
let audioHeld = false;

let albumColors: { a: Rgb; b: Rgb } | null = null;
let albumUri = '';
let albumToken = 0;
let songHooked = false;

function parseColor(value: string, fallback: Rgb): Rgb {
    const v = (value || '').trim();
    let m = /^#([0-9a-f]{3,4})$/i.exec(v);
    if (m) {
        const h = m[1];
        return [0, 1, 2].map(i => parseInt(h[i] + h[i], 16) / 255) as Rgb;
    }
    m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(v);
    if (m) {
        const h = m[1];
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
    }
    m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(v);
    if (m) return [m[1], m[2], m[3]].map(n => Math.min(Math.max(parseFloat(n) / 255, 0), 1)) as Rgb;
    return fallback;
}

function targetColors(config: ThemeConfig): { a: Rgb; b: Rgb } {
    const custom = {
        a: parseColor(config.animBgColor, [0.37, 0.92, 0.83]),
        b: parseColor(config.animBgColor2, [0.15, 0.39, 0.92]),
    };
    if (config.animBgPalette === 'album' && albumColors) return albumColors;
    return custom;
}

function coverUrl(): string {
    try {
        const meta = (Spicetify?.Player?.data?.item as any)?.metadata || {};
        const raw: string = meta.image_large_url || meta.image_url || meta.image_xlarge_url || meta.image_small_url || '';
        if (raw.startsWith('spotify:image:')) return `https://i.scdn.co/image/${raw.slice('spotify:image:'.length)}`;
        if (/^https:\/\//.test(raw)) return raw;
    } catch (e) {}
    return '';
}

function rgbToHsl([r, g, b]: Rgb): Rgb {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
    return [h, s, l];
}

function hslToRgb([h, s, l]: Rgb): Rgb {
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t: number) => {
        t = ((t % 1) + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

function glowable(rgb: Rgb, grey: boolean): Rgb {
    const [h, s, l] = rgbToHsl(rgb);
    return hslToRgb([h, grey ? Math.min(s, 0.12) : Math.max(s, 0.6), Math.min(Math.max(l, 0.55), 0.72)]);
}

function paletteFromImage(img: HTMLImageElement): { a: Rgb; b: Rgb } | null {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const BUCKETS = 24;
    const weight = new Array(BUCKETS).fill(0);
    const sums = Array.from({ length: BUCKETS }, () => [0, 0, 0]);
    const avg = [0, 0, 0];
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
        const rgb: Rgb = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
        avg[0] += rgb[0];
        avg[1] += rgb[1];
        avg[2] += rgb[2];
        const max = Math.max(...rgb);
        const min = Math.min(...rgb);
        const sat = max > 0 ? (max - min) / max : 0;
        const w = sat * sat * max * (max > 0.12 ? 1 : 0);
        if (w <= 0) continue;
        const k = Math.floor(rgbToHsl(rgb)[0] * BUCKETS) % BUCKETS;
        weight[k] += w;
        sums[k][0] += rgb[0] * w;
        sums[k][1] += rgb[1] * w;
        sums[k][2] += rgb[2] * w;
        total += w;
    }
    const pixels = data.length / 4;
    if (total < pixels * 0.02) {
        const mean: Rgb = [avg[0] / pixels, avg[1] / pixels, avg[2] / pixels];
        const light = glowable(mean, true);
        return { a: light, b: light.map(v => v * 0.55) as Rgb };
    }
    const smooth = weight.map((w, k) => w + 0.5 * (weight[(k + 1) % BUCKETS] + weight[(k + BUCKETS - 1) % BUCKETS]));
    const colorOf = (k: number): Rgb => {
        const ks = [k, (k + 1) % BUCKETS, (k + BUCKETS - 1) % BUCKETS];
        const w = ks.reduce((a, j) => a + weight[j], 0) || 1;
        return [0, 1, 2].map(c => ks.reduce((a, j) => a + sums[j][c], 0) / w) as Rgb;
    };
    let first = 0;
    smooth.forEach((w, k) => { if (w > smooth[first]) first = k; });
    let second = -1;
    smooth.forEach((w, k) => {
        const dist = Math.min(Math.abs(k - first), BUCKETS - Math.abs(k - first));
        if (dist >= 3 && w >= smooth[first] * 0.18 && (second < 0 || w > smooth[second])) second = k;
    });
    const a = glowable(colorOf(first), false);
    if (second < 0) {
        const [h, sat, l] = rgbToHsl(a);
        return { a, b: hslToRgb([h + 0.09, sat, l * 0.8]) };
    }
    return { a, b: glowable(colorOf(second), false) };
}

function refreshAlbumColors(): void {
    const t = themeState.activeTheme;
    if (!themeState.isEnabled || !t.animBgEnabled || t.animBgPalette !== 'album') return;
    const url = coverUrl();
    if (!url || url === albumUri) return;
    albumUri = url;
    const token = ++albumToken;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.decode().then(() => {
        if (token !== albumToken) return;
        const colors = paletteFromImage(img);
        if (!colors) return;
        albumColors = colors;
        pushSettings();
    }).catch(() => {
        if (token === albumToken) albumUri = '';
    });
}

function onSongChange(): void {
    albumUri = '';
    refreshAlbumColors();
}

function playingNow(): boolean {
    try {
        const player = Spicetify.Player as any;
        if (typeof player.isPlaying === 'function') return !!player.isPlaying();
        const d = player.data;
        return !(d?.isPaused ?? d?.is_paused ?? true);
    } catch (e) {
        return false;
    }
}

function buildSettings(): CoreSettings {
    const t = themeState.activeTheme;
    const colors = targetColors(t);
    let scale = QUALITY_SCALE[t.animBgQuality] || 0.75;
    if (t.animBgBlur > 0) scale *= 0.6;
    return {
        version: configVersion,
        style: ANIM_BG_STYLE_IDS.includes(t.animBgStyle) ? t.animBgStyle : 'ridges',
        solidBg: t.animBgBackdrop !== 'blend',
        colA: colors.a,
        colB: colors.b,
        bg: parseColor(t.animBgBgColor, [0.02, 0.03, 0.035]),
        density: t.animBgDensity,
        thickness: t.animBgThickness,
        amplitude: t.animBgAmplitude,
        angle: (t.animBgAngle * Math.PI) / 180,
        perspective: t.animBgPerspective,
        glow: t.animBgGlow,
        brightness: t.animBgBrightness,
        grain: t.animBgGrain,
        vignette: t.animBgVignette,
        hue: t.animBgHueCycle,
        react: audioHeld ? t.animBgReactivity : 0,
        mirror: !!t.animBgMirror,
        solid: !!t.animBgSolid,
        spectrum: t.animBgPalette === 'spectrum',
        speed: t.animBgSpeed,
        idle: t.animBgIdleMotion,
        scale,
        interval: FPS_INTERVAL[t.animBgFps] ?? FPS_INTERVAL['60'],
    };
}

function pushSettings(): void {
    const settings = buildSettings();
    renderers.forEach(renderer => renderer.settings(settings));
}

function tick(ts: number): void {
    if (renderers.size === 0) {
        rafId = null;
        return;
    }
    rafId = requestAnimationFrame(tick);
    const snap = eqSnapshot();
    const audio: CoreAudio = {
        levels: Array.from(snap.levels),
        overall: snap.overall,
        pulse: snap.pulse,
        playing: playingNow(),
    };
    renderers.forEach((renderer, page) => {
        if (!page.isConnected) {
            renderer.destroy();
            renderers.delete(page);
            return;
        }
        renderer.audio(audio);
        renderer.tick(ts);
    });
}

function startLoop(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(tick);
}

function stopLoop(): void {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function documents(): Document[] {
    const list: Document[] = [document];
    try {
        const pip = (window as any).documentPictureInPicture?.window as Window | undefined;
        if (pip && pip.document !== document) list.push(pip.document);
    } catch (e) {}
    return list;
}

function isWanted(): boolean {
    return themeState.isEnabled && !!themeState.activeTheme.animBgEnabled;
}

interface Anchor {
    parent: HTMLElement;
    after: HTMLElement | null;
}

function anchorFor(page: HTMLElement): Anchor {
    if (themeState.activeTheme.animBgBackdrop === 'blend' && !page.classList.contains('CardMode')) {
        const bgs = page.querySelectorAll<HTMLElement>('.ContentBox > .spicy-dynamic-bg');
        const last = bgs[bgs.length - 1];
        if (last && last.parentElement) return { parent: last.parentElement, after: last };
    }
    return { parent: page, after: null };
}

function isPlaced(layer: HTMLElement, anchor: Anchor): boolean {
    if (layer.parentElement !== anchor.parent) return false;
    const blocker = anchor.after ? '.spicy-dynamic-bg' : `#${BG_IMAGE_LAYER_ID}`;
    for (let el = layer.nextElementSibling; el; el = el.nextElementSibling) {
        if (el.matches(blocker)) return false;
    }
    return true;
}

function place(layer: HTMLElement, anchor: Anchor): void {
    if (isPlaced(layer, anchor)) return;
    if (anchor.after) anchor.after.after(layer);
    else anchor.parent.appendChild(layer);
}

function syncMounts(): void {
    const config = themeState.activeTheme;
    const pages = documents().flatMap(doc => Array.from(doc.querySelectorAll<HTMLElement>('#SpicyLyricsPage')));
    renderers.forEach((renderer, page) => {
        if (!pages.includes(page) || !page.contains(renderer.layer)) {
            renderer.destroy();
            renderers.delete(page);
        }
    });
    pages.forEach(page => {
        let renderer = renderers.get(page);
        if (!renderer) {
            page.querySelectorAll(`#${ANIM_BG_LAYER_ID}`).forEach(el => el.remove());
            renderer = new Renderer(page.ownerDocument);
            renderers.set(page, renderer);
            renderer.settings(buildSettings());
        }
        place(renderer.layer, anchorFor(page));
        page.classList.add(ANIM_BG_ACTIVE_CLASS);
        page.classList.toggle(ANIM_BG_SOLID_CLASS, config.animBgBackdrop !== 'blend');
    });
}

function syncAudio(): void {
    const want = isWanted() && themeState.activeTheme.animBgReactivity > 0;
    if (want && !audioHeld) {
        acquireEqAudio(AUDIO_KEY);
        audioHeld = true;
    } else if (!want && audioHeld) {
        releaseEqAudio(AUDIO_KEY);
        audioHeld = false;
    }
}

export function updateAnimatedBackground(): void {
    if (!isWanted()) {
        removeAnimatedBackground();
        return;
    }
    configVersion++;
    syncAudio();
    syncMounts();
    pushSettings();
    if (!songHooked) {
        try {
            Spicetify.Player.addEventListener('songchange', onSongChange);
            songHooked = true;
        } catch (e) {}
    }
    if (themeState.activeTheme.animBgPalette === 'album') refreshAlbumColors();
    if (renderers.size > 0) startLoop();
}

export function removeAnimatedBackground(): void {
    stopLoop();
    renderers.forEach(renderer => renderer.destroy());
    renderers.clear();
    documents().forEach(doc => {
        doc.querySelectorAll(`#${ANIM_BG_LAYER_ID}`).forEach(el => el.remove());
        doc.querySelectorAll(`.${ANIM_BG_ACTIVE_CLASS}, .${ANIM_BG_SOLID_CLASS}`).forEach(el => {
            el.classList.remove(ANIM_BG_ACTIVE_CLASS, ANIM_BG_SOLID_CLASS);
        });
    });
    if (audioHeld) {
        releaseEqAudio(AUDIO_KEY);
        audioHeld = false;
    }
}

export function animatedBackgroundNeedsMount(): boolean {
    if (!isWanted()) return false;
    return documents().some(doc => Array.from(doc.querySelectorAll<HTMLElement>('#SpicyLyricsPage')).some(page => {
        const renderer = renderers.get(page);
        return !renderer || !isPlaced(renderer.layer, anchorFor(page));
    }));
}
