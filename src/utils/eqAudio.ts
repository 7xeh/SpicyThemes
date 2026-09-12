import { themeState, EQ_STYLES } from './state';

interface EqSegment {
    start: number;
    duration: number;
    loudness_start: number;
    loudness_max: number;
    loudness_max_time: number;
    pitches?: number[];
    timbre?: number[];
}

interface EqBeat {
    start: number;
    duration: number;
    confidence?: number;
}

interface EqAnalysis {
    segments: EqSegment[];
    beats: EqBeat[];
    min: number;
    max: number;
    timbreMean: number[];
    timbreDev: number[];
    beatDur: number;
}

const BAND_COUNT = 10;
const BAND_LO = 40;
const BAND_HI = 16000;
const BAND_OCTAVES = Math.log2(BAND_HI / BAND_LO);
const BAND_EDGE = Array.from({ length: BAND_COUNT + 1 }, (_, k) => BAND_LO * 2 ** ((BAND_OCTAVES * k) / BAND_COUNT));
const BAND_POS = Array.from({ length: BAND_COUNT }, (_, k) => (k + 0.5) / BAND_COUNT);
const TIMBRE_BASIS_COUNT = 4;
const TIMBRE_BASIS = Array.from({ length: TIMBRE_BASIS_COUNT }, (_, c) =>
    BAND_POS.map(x => (c === 0 ? -1 : 1) * Math.cos(Math.PI * (c + 1) * x)));
const TIMBRE_WEIGHT = [0.85, 0.5, 0.34, 0.24];
const CHROMA_WEIGHT = buildChromaWeights();
const PULSE_WEIGHT = [1, 0.85, 0.7, 0.55, 0.45, 0.36, 0.28, 0.22, 0.16, 0.12];
const BAND_ATTACK = [56, 62, 70, 78, 84, 90, 96, 104, 112, 120];
const BAND_RELEASE = [7, 8, 9, 10.5, 12, 13.5, 15.5, 17.5, 20, 23];
const STEREO_LAG_MAX = 0.09;
const STEREO_TILT_MAX = 0.4;
const PEAK_HOLD = 0.32;
const PEAK_FALL = 0.9;
const OUTPUT_LATENCY = 0.05;
const SEEK_THRESHOLD = 0.35;
const CLOCK_CATCHUP = 12;
const CLOCK_EASE = 2;
const BAND_KNEE = 0.75;

function buildChromaWeights(): number[][] {
    const weights = Array.from({ length: BAND_COUNT }, () => new Array(12).fill(0));
    for (let pc = 0; pc < 12; pc++) {
        for (let octave = 0; octave <= 10; octave++) {
            const freq = 16.3516 * 2 ** octave * 2 ** (pc / 12);
            if (freq < BAND_EDGE[0] || freq >= BAND_EDGE[BAND_COUNT]) continue;
            let k = BAND_COUNT - 1;
            while (k > 0 && freq < BAND_EDGE[k]) k--;
            weights[k][pc] += 1;
        }
    }
    return weights.map(row => {
        const total = row.reduce((a, b) => a + b, 0);
        return total > 0 ? row.map(v => v / total) : row.map(() => 1 / 12);
    });
}

const EQ_SIZING = new Map(EQ_STYLES.map(s => [s.id, s]));
const EQ_PEAK_STYLES = new Set(EQ_STYLES.filter(s => s.peaks).map(s => s.id));

let analysis: EqAnalysis | null = null;
let analysisUri: string | null = null;
let fetching = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let rafId: number | null = null;
let lastTick = 0;
interface EqChannel {
    levels: number[];
    peaks: number[];
    holds: number[];
    targets: number[];
    overall: number;
    pulse: number;
    phase: number;
    segIdx: number;
    beatIdx: number;
    agcMin: number;
    agcMax: number;
}

function makeChannel(): EqChannel {
    return {
        levels: new Array(BAND_COUNT).fill(0),
        peaks: new Array(BAND_COUNT).fill(0),
        holds: new Array(BAND_COUNT).fill(0),
        targets: new Array(BAND_COUNT).fill(0),
        overall: 0,
        pulse: 0,
        phase: 0,
        segIdx: 0,
        beatIdx: 0,
        agcMin: -40,
        agcMax: 0,
    };
}

const chMain = makeChannel();
const chAlt = makeChannel();
let lastRawProgress = -1;
let lastRawAt = 0;
let progressEst = -1;
let lastMeasure = 0;
let songChangeHooked = false;
let cachedEls: HTMLElement[] = [];
let lastCollect = 0;
let sizeObserver: ResizeObserver | null = null;
let observed: Element[] = [];
let measureQueued = true;
let idleWritten = false;
let paddedMetas: HTMLElement[] = [];

function eqNaturalU(el: HTMLElement, sr: DOMRect, metaRect: DOMRect): { u: number; wf: number; gap: number } {
    const style = el.getAttribute('data-style') || 'equalizer';
    const sizing = EQ_SIZING.get(style);
    const wf = sizing?.width ?? 8.3;
    const hf = sizing?.height ?? 3.6;
    const top = sr.top - metaRect.top + sr.height / 2;
    let u = (sr.height * themeState.activeTheme.eqSize) / hf;
    const vRoom = Math.min(top, metaRect.height - top);
    if (vRoom > 0) u = Math.min(u, (vRoom * 2 * 0.9) / hf);
    return { u, wf, gap: Math.max(sr.height * 0.3, 6) };
}

function clearEqRoom(): void {
    paddedMetas.forEach(meta => { meta.style.paddingLeft = ''; });
    paddedMetas = [];
}

function reserveEqRoom(els: HTMLElement[]): void {
    const metas: HTMLElement[] = [];
    els.forEach(el => {
        const meta = el.parentElement as HTMLElement | null;
        if (meta && !metas.includes(meta)) metas.push(meta);
    });
    paddedMetas.forEach(meta => {
        if (!metas.includes(meta)) meta.style.paddingLeft = '';
    });
    const padded: HTMLElement[] = [];
    metas.forEach(meta => {
        const left = meta.querySelector<HTMLElement>('.st-eq-left');
        const song = meta.querySelector('.SongName');
        const current = parseFloat(meta.style.paddingLeft) || 0;
        if (!left || !song) {
            if (current !== 0) meta.style.paddingLeft = '';
            return;
        }
        const metaRect = meta.getBoundingClientRect();
        const sr = song.getBoundingClientRect();
        if (metaRect.width < 10 || metaRect.height < 10 || sr.width <= 0 || sr.height <= 0) {
            if (current !== 0) padded.push(meta);
            return;
        }
        const { u, wf, gap } = eqNaturalU(left, sr, metaRect);
        const needed = wf * u + gap + 2;
        const intrinsic = sr.left - metaRect.left - current;
        const target = intrinsic >= needed - 0.5 ? 0 : needed - intrinsic;
        if (target <= 0.5) {
            if (current !== 0) meta.style.paddingLeft = '';
            return;
        }
        if (Math.abs(target - current) > 0.5) meta.style.paddingLeft = `${target.toFixed(1)}px`;
        padded.push(meta);
    });
    paddedMetas = padded;
}

function positionEq(el: HTMLElement): void {
    const meta = el.parentElement;
    if (!meta) return;
    const metaRect = meta.getBoundingClientRect();
    if (metaRect.width < 10 || metaRect.height < 10) {
        el.style.display = 'none';
        return;
    }
    const isLeft = el.classList.contains('st-eq-left');

    const song = meta.querySelector('.SongName');
    const sr = song ? song.getBoundingClientRect() : null;
    if (!sr || sr.width <= 0 || sr.height <= 0) {
        el.style.display = 'none';
        return;
    }

    const top = sr.top - metaRect.top + sr.height / 2;
    const { u: natural, wf, gap } = eqNaturalU(el, sr, metaRect);

    const hRoom = (isLeft ? sr.left - metaRect.left : metaRect.right - sr.right) - gap - 2;
    const u = Math.min(natural, hRoom > 0 ? hRoom / wf : 0);

    if (u < 1.2) {
        el.style.display = 'none';
        return;
    }

    el.style.display = '';
    el.style.visibility = 'visible';
    el.style.setProperty('--st-eq-u', `${u.toFixed(2)}px`);
    el.style.top = `${top.toFixed(1)}px`;
    if (isLeft) {
        el.style.right = `${(metaRect.right - sr.left + gap).toFixed(1)}px`;
        el.style.left = 'auto';
    } else {
        el.style.left = `${(sr.right - metaRect.left + gap).toFixed(1)}px`;
        el.style.right = 'auto';
    }
}

function getPIPWindow(): Window | null {
    try {
        const docPiP = (window as any).documentPictureInPicture;
        if (docPiP && docPiP.window) return docPiP.window;
    } catch (e) {}
    return null;
}

function watchTargets(els: HTMLElement[]): void {
    if (typeof ResizeObserver === 'undefined') return;
    const targets: Element[] = [];
    els.forEach(el => {
        const meta = el.parentElement;
        if (!meta) return;
        if (!targets.includes(meta)) targets.push(meta);
        const song = meta.querySelector('.SongName');
        if (song && !targets.includes(song)) targets.push(song);
    });
    if (targets.length === observed.length && targets.every((t, i) => t === observed[i])) return;
    if (!sizeObserver) sizeObserver = new ResizeObserver(() => { measureQueued = true; });
    sizeObserver.disconnect();
    targets.forEach(t => sizeObserver!.observe(t));
    observed = targets;
    measureQueued = true;
}

function collectEls(ts: number): HTMLElement[] {
    if (cachedEls.length > 0 && cachedEls.every(el => el.isConnected)) return cachedEls;
    if (cachedEls.length === 0 && lastCollect && ts - lastCollect < 400) return cachedEls;
    lastCollect = ts;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.st-eq'));
    const pipWindow = getPIPWindow();
    if (pipWindow) els.push(...Array.from(pipWindow.document.querySelectorAll<HTMLElement>('.st-eq')));
    cachedEls = els;
    idleWritten = false;
    watchTargets(els);
    return els;
}

export function refreshEqElements(): void {
    cachedEls = [];
    lastCollect = 0;
    idleWritten = false;
}

function currentTrackUri(): string | null {
    try {
        return Spicetify?.Player?.data?.item?.uri || Spicetify?.Player?.data?.track?.uri || null;
    } catch (e) {
        return null;
    }
}

async function fetchAnalysisData(uri: string): Promise<any> {
    try {
        const data = await (Spicetify as any).getAudioData();
        if (Array.isArray(data?.segments) && data.segments.length > 0) return data;
    } catch (e) {}
    try {
        const id = uri.split(':')[2];
        if (id) {
            const data = await Spicetify.CosmosAsync.get(`https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${id}?format=json`);
            if (Array.isArray(data?.segments) && data.segments.length > 0) return data;
        }
    } catch (e) {}
    return null;
}

async function fetchAnalysis(): Promise<void> {
    const uri = currentTrackUri();
    if (!uri || fetching || uri === analysisUri) return;
    fetching = true;
    let ok = false;
    const data = await fetchAnalysisData(uri);
    const segs: EqSegment[] | undefined = data?.segments;
    if (Array.isArray(segs) && segs.length > 0) {
        let min = Infinity;
        let max = -Infinity;
        const sum = new Array(TIMBRE_BASIS_COUNT).fill(0);
        const sumSq = new Array(TIMBRE_BASIS_COUNT).fill(0);
        const seen = new Array(TIMBRE_BASIS_COUNT).fill(0);
        for (const s of segs) {
            if (typeof s.loudness_max === 'number') max = Math.max(max, s.loudness_max);
            if (typeof s.loudness_start === 'number') min = Math.min(min, s.loudness_start);
            for (let c = 0; c < TIMBRE_BASIS_COUNT; c++) {
                const v = s.timbre?.[c + 1];
                if (typeof v !== 'number' || !isFinite(v)) continue;
                sum[c] += v;
                sumSq[c] += v * v;
                seen[c]++;
            }
        }
        if (!isFinite(min) || !isFinite(max) || max - min < 1) {
            min = -60;
            max = 0;
        }
        min = Math.max(min, max - 40);
        const timbreMean = new Array(TIMBRE_BASIS_COUNT).fill(0);
        const timbreDev = new Array(TIMBRE_BASIS_COUNT).fill(1);
        for (let c = 0; c < TIMBRE_BASIS_COUNT; c++) {
            if (seen[c] < 8) continue;
            const mean = sum[c] / seen[c];
            timbreMean[c] = mean;
            timbreDev[c] = Math.max(Math.sqrt(Math.max(sumSq[c] / seen[c] - mean * mean, 0)), 1);
        }
        const beats: EqBeat[] = Array.isArray(data?.beats) ? data.beats : [];
        let tempo = data?.track?.tempo;
        if (typeof tempo !== 'number' || !isFinite(tempo) || tempo < 40 || tempo > 250) {
            if (beats.length > 4) {
                tempo = 60 / Math.max((beats[beats.length - 1].start - beats[0].start) / (beats.length - 1), 0.05);
            } else {
                tempo = 120;
            }
        }
        const beatDur = Math.min(Math.max(60 / tempo, 0.24), 1.5);
        analysis = { segments: segs, beats, min, max, timbreMean, timbreDev, beatDur };
        chMain.agcMin = min;
        chMain.agcMax = max;
        chAlt.agcMin = min;
        chAlt.agcMax = max;
        ok = true;
    } else {
        analysis = null;
    }
    analysisUri = uri;
    for (const ch of [chMain, chAlt]) {
        ch.segIdx = 0;
        ch.beatIdx = 0;
    }
    fetching = false;
    if (!ok && running && !retryTimer) {
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (running && currentTrackUri() === analysisUri) {
                analysisUri = null;
                fetchAnalysis();
            }
        }, 3000);
    }
}

function onSongChange(): void {
    analysis = null;
    analysisUri = null;
    lastRawProgress = -1;
    progressEst = -1;
    measureQueued = true;
    for (const ch of [chMain, chAlt]) {
        for (let k = 0; k < BAND_COUNT; k++) {
            ch.peaks[k] = 0;
            ch.holds[k] = 0;
        }
    }
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    if (running) setTimeout(() => fetchAnalysis(), 250);
}

function advanceIndex(arr: { start: number }[], t: number, cur: number): number {
    if (cur >= arr.length) cur = arr.length - 1;
    if (cur < 0) cur = 0;
    if (t < arr[cur].start) {
        let lo = 0;
        let hi = cur;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (arr[mid].start <= t) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }
    while (cur + 1 < arr.length && arr[cur + 1].start <= t) cur++;
    return cur;
}

const envelope = new Array(BAND_COUNT).fill(1);

function spectralEnvelope(timbre: number[] | undefined, a: EqAnalysis): void {
    for (let k = 0; k < BAND_COUNT; k++) envelope[k] = 0;
    if (timbre) {
        for (let c = 0; c < TIMBRE_BASIS_COUNT; c++) {
            const v = timbre[c + 1];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            const n = Math.min(Math.max((v - a.timbreMean[c]) / (2 * a.timbreDev[c]), -1), 1) * TIMBRE_WEIGHT[c];
            const basis = TIMBRE_BASIS[c];
            for (let k = 0; k < BAND_COUNT; k++) envelope[k] += n * basis[k];
        }
    }
    let total = 0;
    for (let k = 0; k < BAND_COUNT; k++) {
        envelope[k] = Math.exp(envelope[k]);
        total += envelope[k];
    }
    const mean = total / BAND_COUNT;
    for (let k = 0; k < BAND_COUNT; k++) envelope[k] /= mean;
}

function trackProgress(ts: number, dt: number, playing: boolean, rawMs: number, rate: number): number {
    if (rawMs !== lastRawProgress) {
        lastRawProgress = rawMs;
        lastRawAt = ts;
    }
    const reported = lastRawProgress / 1000 + (playing ? ((ts - lastRawAt) / 1000) * rate : 0) + OUTPUT_LATENCY;
    const drift = reported - progressEst;
    if (!playing || progressEst < 0 || Math.abs(drift) > SEEK_THRESHOLD) {
        progressEst = reported;
    } else {
        progressEst += dt * rate + drift * (1 - Math.exp(-dt * (drift > 0 ? CLOCK_CATCHUP : CLOCK_EASE)));
    }
    return progressEst;
}

function softClip(x: number): number {
    if (x <= BAND_KNEE) return Math.max(x, 0);
    return 1 - (1 - BAND_KNEE) * Math.exp(-(x - BAND_KNEE) / (1 - BAND_KNEE));
}

function chromaEnergy(pitches: number[], k: number): number {
    const w = CHROMA_WEIGHT[k];
    let sum = 0;
    for (let pc = 0; pc < 12; pc++) sum += w[pc] * (pitches[pc] ?? 0.5);
    return sum;
}

function applyTilt(tilt: number): void {
    if (tilt === 0) return;
    let total = 0;
    for (let k = 0; k < BAND_COUNT; k++) {
        envelope[k] = Math.max(envelope[k] * (1 + tilt * (BAND_POS[k] - 0.5) * 2), 0.05);
        total += envelope[k];
    }
    const mean = total / BAND_COUNT;
    for (let k = 0; k < BAND_COUNT; k++) envelope[k] /= mean;
}

function analysisLevels(progress: number, dt: number, targets: number[], ch: EqChannel, tilt: number): number {
    const a = analysis as EqAnalysis;
    const segs = a.segments;
    ch.segIdx = advanceIndex(segs, progress, ch.segIdx);
    const seg = segs[ch.segIdx];
    const next = segs[ch.segIdx + 1];
    const dtSeg = Math.max(progress - seg.start, 0);
    const lmt = Math.max(seg.loudness_max_time, 0.001);
    let db: number;
    if (dtSeg <= lmt) {
        db = seg.loudness_start + (seg.loudness_max - seg.loudness_start) * (dtSeg / lmt);
    } else {
        const endDb = next ? next.loudness_start : seg.loudness_start;
        const rest = Math.max(seg.duration - lmt, 0.001);
        db = seg.loudness_max + (endDb - seg.loudness_max) * Math.min((dtSeg - lmt) / rest, 1);
    }

    ch.agcMax = Math.max(db, ch.agcMax - 2.5 * dt);
    ch.agcMin = Math.min(db, ch.agcMin + 2.0 * dt);
    const span = Math.max(ch.agcMax - ch.agcMin, 12);
    const ampLocal = Math.min(Math.max((db - ch.agcMin) / span, 0), 1);
    const ampGlobal = Math.min(Math.max((db - a.min) / (a.max - a.min), 0), 1);
    const amp = Math.pow(0.25 * ampLocal + 0.75 * ampGlobal, 1.25);

    let beatPulse = 0;
    if (a.beats.length > 0) {
        ch.beatIdx = advanceIndex(a.beats, progress, ch.beatIdx);
        const beat = a.beats[ch.beatIdx];
        const p = Math.min(Math.max(progress - beat.start, 0) / Math.max(beat.duration, 0.1), 1);
        const conf = typeof beat.confidence === 'number' ? beat.confidence : 0.5;
        beatPulse = Math.exp(-p * 8) * (0.4 + 0.6 * conf);
        ch.phase = p;
    } else {
        ch.phase = (ch.phase + dt / Math.max(a.beatDur, 0.1)) % 1;
    }

    spectralEnvelope(seg.timbre, a);
    applyTilt(tilt);
    const pitches = seg.pitches || [];
    for (let k = 0; k < BAND_COUNT; k++) {
        const body = amp * 0.78 * envelope[k] * (0.72 + 0.28 * chromaEnergy(pitches, k));
        targets[k] = softClip(body + beatPulse * 0.22 * PULSE_WEIGHT[k] * amp);
    }
    ch.pulse = beatPulse;
    return Math.min(amp * (0.8 + 0.45 * beatPulse), 1);
}

function syntheticLevels(ts: number, speed: number, targets: number[], ch: EqChannel, tilt: number): number {
    const t = (ts / 1000) * speed;
    ch.phase = (t % 0.5) / 0.5;
    const beatPulse = Math.exp(-ch.phase * 5);
    const bright = 0.5 + 0.4 * Math.sin(t * 0.7) + tilt * 0.3;
    for (let k = 0; k < BAND_COUNT; k++) {
        const d = BAND_POS[k] - bright;
        const shape = Math.exp(-(d * d) / 0.22);
        const wave = 0.3 + 0.3 * Math.sin(t * (1.6 + k * 0.43) + k * 1.7);
        targets[k] = Math.min(Math.max(wave * shape + 0.2 + beatPulse * 0.35 * PULSE_WEIGHT[k], 0), 1);
    }
    ch.pulse = beatPulse;
    return Math.min(Math.max(0.5 + 0.25 * Math.sin(t * 2.1) * Math.sin(t * 0.9) + 0.25 * beatPulse, 0), 1);
}

function stereoAmount(): number {
    const config = themeState.activeTheme;
    if (!config.eqStereoSpread || config.eqPosition !== 'both') return 0;
    const amount = Number(config.eqStereoAmount);
    if (!isFinite(amount)) return 0;
    return Math.min(Math.max(amount, 0), 1);
}

function stepChannel(ch: EqChannel, progress: number, ts: number, dt: number, speed: number, playing: boolean, tilt: number, wantPeaks: boolean): void {
    let overallTarget = 0;
    if (playing) {
        overallTarget = analysis
            ? analysisLevels(progress, dt, ch.targets, ch, tilt)
            : syntheticLevels(ts, speed, ch.targets, ch, tilt);
    } else {
        ch.pulse = 0;
        for (let k = 0; k < BAND_COUNT; k++) ch.targets[k] = 0;
    }

    const attack = 1 - Math.exp(-dt * 90 * speed);
    const release = 1 - Math.exp(-dt * 14 * speed);
    ch.overall += (overallTarget - ch.overall) * (overallTarget > ch.overall ? attack : release);

    for (let k = 0; k < BAND_COUNT; k++) {
        const up = 1 - Math.exp(-dt * BAND_ATTACK[k] * speed);
        const down = 1 - Math.exp(-dt * BAND_RELEASE[k] * speed);
        ch.levels[k] += (ch.targets[k] - ch.levels[k]) * (ch.targets[k] > ch.levels[k] ? up : down);
        if (!wantPeaks) {
            ch.peaks[k] = 0;
            continue;
        }
        if (ch.levels[k] >= ch.peaks[k]) {
            ch.peaks[k] = ch.levels[k];
            ch.holds[k] = PEAK_HOLD;
        } else if (ch.holds[k] > 0) {
            ch.holds[k] -= dt;
        } else {
            ch.peaks[k] = Math.max(ch.levels[k], ch.peaks[k] - dt * PEAK_FALL * speed);
        }
    }
}

function channelSettled(ch: EqChannel): boolean {
    if (ch.overall >= 0.002 || ch.pulse >= 0.002) return false;
    for (let k = 0; k < BAND_COUNT; k++) {
        if (ch.levels[k] > 0.002 || ch.peaks[k] > 0.002) return false;
    }
    return true;
}

function tick(ts: number): void {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    const dt = lastTick ? Math.min((ts - lastTick) / 1000, 0.2) : 0.016;
    if (dt < 0.008) return;
    lastTick = ts;

    const els = collectEls(ts);
    if (els.length === 0) return;

    if (measureQueued || ts - lastMeasure > 1000 || els.some(el => !el.style.getPropertyValue('--st-eq-u'))) {
        measureQueued = false;
        lastMeasure = ts;
        reserveEqRoom(els);
        els.forEach(positionEq);
    }

    const speed = themeState.activeTheme.eqSpeed || 1;
    let playing = false;
    let progress = 0;
    try {
        const player = Spicetify.Player as any;
        if (typeof player.isPlaying === 'function') {
            playing = !!player.isPlaying();
        } else {
            const d = player.data;
            playing = !(d?.isPaused ?? d?.is_paused ?? true);
        }
        const rate = Number(player.data?.playbackSpeed) || 1;
        progress = trackProgress(ts, dt, playing, player.getProgress?.() || 0, rate);
    } catch (e) {}

    const uri = currentTrackUri();
    if (uri && uri !== analysisUri && !fetching) fetchAnalysis();

    const wantPeaks = EQ_PEAK_STYLES.has(themeState.activeTheme.eqStyle);
    const spread = stereoAmount();
    stepChannel(chMain, progress, ts, dt, speed, playing, 0, wantPeaks);
    if (spread > 0) {
        const lag = spread * STEREO_LAG_MAX;
        stepChannel(chAlt, Math.max(progress - lag, 0), ts - lag * 1000, dt, speed, playing, spread * STEREO_TILT_MAX, wantPeaks);
    }

    const settled = !playing && channelSettled(chMain) && (spread === 0 || channelSettled(chAlt));
    if (settled && idleWritten) return;
    idleWritten = settled;

    const beatStr = `${(analysis ? analysis.beatDur : 0.5).toFixed(3)}s`;
    els.forEach(el => {
        const ch = spread > 0 && el.classList.contains('st-eq-right') ? chAlt : chMain;
        el.classList.toggle('st-eq-paused', !playing);
        el.style.setProperty('--st-eq-level', ch.overall.toFixed(3));
        el.style.setProperty('--st-eq-pulse', ch.pulse.toFixed(3));
        el.style.setProperty('--st-eq-phase', ch.phase.toFixed(3));
        el.style.setProperty('--st-eq-phase2', ((ch.phase + 0.5) % 1).toFixed(3));
        for (let k = 0; k < BAND_COUNT; k++) {
            el.style.setProperty(`--st-eq-b${k + 1}`, ch.levels[k].toFixed(3));
            if (wantPeaks) el.style.setProperty(`--st-eq-p${k + 1}`, ch.peaks[k].toFixed(3));
        }
        if (el.style.getPropertyValue('--st-eq-beat') !== beatStr) {
            el.style.setProperty('--st-eq-beat', beatStr);
        }
    });
}

export function startEqAudio(): void {
    if (running) return;
    running = true;
    if (!songChangeHooked) {
        try {
            Spicetify.Player.addEventListener('songchange', onSongChange);
            songChangeHooked = true;
        } catch (e) {}
    }
    fetchAnalysis();
    lastTick = 0;
    refreshEqElements();
    rafId = requestAnimationFrame(tick);
}

export function stopEqAudio(): void {
    running = false;
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    if (sizeObserver) {
        sizeObserver.disconnect();
        observed = [];
    }
    clearEqRoom();
    refreshEqElements();
}
