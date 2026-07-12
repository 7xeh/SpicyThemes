import { themeState } from './state';

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
    t1min: number;
    t1max: number;
    beatDur: number;
}

const BAND_COUNT = 10;
const BAR_BINS = [[0], [1], [2], [3], [4], [5], [6], [7], [8, 9], [10, 11]];
const BAR_POS = Array.from({ length: BAND_COUNT }, (_, k) => k / (BAND_COUNT - 1));
const PULSE_WEIGHT = [1, 0.85, 0.7, 0.55, 0.45, 0.36, 0.28, 0.22, 0.16, 0.12];

const EQ_WIDTH_FACTOR: Record<string, number> = {
    equalizer: 8.3,
    dotwave: 8.1,
    signal: 5.9,
    orbit: 5.3,
    pulsedot: 3.6,
    spectrumring: 4.7,
};

const EQ_HEIGHT_FACTOR: Record<string, number> = {
    equalizer: 3.6,
    dotwave: 2.1,
    signal: 2.4,
    orbit: 5.3,
    pulsedot: 3.6,
    spectrumring: 4.7,
};

let analysis: EqAnalysis | null = null;
let analysisUri: string | null = null;
let fetching = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let rafId: number | null = null;
let lastTick = 0;
let overall = 0;
const levels = new Array(BAND_COUNT).fill(0);
let segIdx = 0;
let beatIdx = 0;
let agcMin = -40;
let agcMax = 0;
let lastRawProgress = -1;
let lastRawAt = 0;
let lastMeasure = 0;
let songChangeHooked = false;

function positionEq(el: HTMLElement): void {
    const meta = el.parentElement;
    if (!meta) return;
    const metaRect = meta.getBoundingClientRect();
    if (metaRect.width < 10 || metaRect.height < 10) {
        el.style.display = 'none';
        return;
    }
    const config = themeState.activeTheme;
    const style = el.getAttribute('data-style') || 'equalizer';
    const wf = EQ_WIDTH_FACTOR[style] ?? 8.3;
    const hf = EQ_HEIGHT_FACTOR[style] ?? 4.4;

    let uCfg = metaRect.height * 0.06 * config.eqSize;
    uCfg = Math.min(uCfg, (metaRect.height * 0.95) / hf);

    let sideGap = metaRect.width * 0.075;
    let top = metaRect.height * 0.3;
    const song = meta.querySelector('.SongName');
    if (song) {
        const sr = song.getBoundingClientRect();
        if (sr.width > 0 && sr.height > 0) {
            sideGap = el.classList.contains('st-eq-left')
                ? sr.left - metaRect.left
                : metaRect.right - sr.right;
            top = sr.top - metaRect.top + sr.height / 2;
            uCfg = Math.min(uCfg, (sr.height * 1.2) / hf);
        }
    }

    const room = Math.min(top, metaRect.height - top);
    uCfg = Math.min(uCfg, (room * 2 * 0.95) / hf);

    const avail = sideGap - metaRect.width * 0.02 - 8;
    const u = Math.min(uCfg, avail > 0 ? avail / wf : 0);
    if (u < 1.2) {
        el.style.display = 'none';
        return;
    }
    el.style.display = '';
    el.style.visibility = 'visible';
    el.style.setProperty('--st-eq-u', `${u.toFixed(2)}px`);
    el.style.top = `${top.toFixed(1)}px`;
}

function getPIPWindow(): Window | null {
    try {
        const docPiP = (window as any).documentPictureInPicture;
        if (docPiP && docPiP.window) return docPiP.window;
    } catch (e) {}
    return null;
}

function collectEls(): HTMLElement[] {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.st-eq'));
    const pipWindow = getPIPWindow();
    if (pipWindow) els.push(...Array.from(pipWindow.document.querySelectorAll<HTMLElement>('.st-eq')));
    return els;
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
        let t1min = Infinity;
        let t1max = -Infinity;
        for (const s of segs) {
            if (typeof s.loudness_max === 'number') max = Math.max(max, s.loudness_max);
            if (typeof s.loudness_start === 'number') min = Math.min(min, s.loudness_start);
            const t1 = s.timbre?.[1];
            if (typeof t1 === 'number') {
                t1max = Math.max(t1max, t1);
                t1min = Math.min(t1min, t1);
            }
        }
        if (!isFinite(min) || !isFinite(max) || max - min < 1) {
            min = -60;
            max = 0;
        }
        min = Math.max(min, max - 40);
        if (!isFinite(t1min) || !isFinite(t1max) || t1max - t1min < 1) {
            t1min = 0;
            t1max = 1;
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
        analysis = { segments: segs, beats, min, max, t1min, t1max, beatDur };
        agcMin = min;
        agcMax = max;
        ok = true;
    } else {
        analysis = null;
    }
    analysisUri = uri;
    segIdx = 0;
    beatIdx = 0;
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

function analysisLevels(progress: number, dt: number, targets: number[]): number {
    const a = analysis as EqAnalysis;
    const segs = a.segments;
    segIdx = advanceIndex(segs, progress, segIdx);
    const seg = segs[segIdx];
    const next = segs[segIdx + 1];
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

    agcMax = Math.max(db, agcMax - 2.5 * dt);
    agcMin = Math.min(db, agcMin + 2.0 * dt);
    const span = Math.max(agcMax - agcMin, 12);
    const ampLocal = Math.min(Math.max((db - agcMin) / span, 0), 1);
    const ampGlobal = Math.min(Math.max((db - a.min) / (a.max - a.min), 0), 1);
    const amp = Math.pow(0.25 * ampLocal + 0.75 * ampGlobal, 1.25);

    let pulse = 0;
    if (a.beats.length > 0) {
        beatIdx = advanceIndex(a.beats, progress, beatIdx);
        const beat = a.beats[beatIdx];
        const phase = Math.max(progress - beat.start, 0) / Math.max(beat.duration, 0.1);
        const conf = typeof beat.confidence === 'number' ? beat.confidence : 0.5;
        pulse = Math.exp(-phase * 8) * (0.4 + 0.6 * conf);
    }

    const t1 = seg.timbre?.[1];
    const bright = typeof t1 === 'number'
        ? Math.min(Math.max((t1 - a.t1min) / (a.t1max - a.t1min), 0), 1)
        : 0.5;

    const pitches = seg.pitches || [];
    BAR_BINS.forEach((bins, k) => {
        let c = 0;
        bins.forEach(b => { c += pitches[b] ?? 0.5; });
        c /= bins.length;
        const d = BAR_POS[k] - bright;
        const tilt = Math.exp(-(d * d) / 0.22);
        targets[k] = Math.min(amp * (0.12 + 0.66 * tilt + 0.22 * c) + pulse * 0.45 * PULSE_WEIGHT[k] * amp, 1);
    });
    return Math.min(amp * (0.8 + 0.45 * pulse), 1);
}

function syntheticLevels(ts: number, speed: number, targets: number[]): number {
    const t = (ts / 1000) * speed;
    const pulse = Math.exp(-((t % 0.5) / 0.5) * 5);
    const bright = 0.5 + 0.4 * Math.sin(t * 0.7);
    for (let k = 0; k < BAND_COUNT; k++) {
        const d = BAR_POS[k] - bright;
        const tilt = Math.exp(-(d * d) / 0.22);
        const wave = 0.3 + 0.3 * Math.sin(t * (1.6 + k * 0.43) + k * 1.7);
        targets[k] = Math.min(Math.max(wave * tilt + 0.2 + pulse * 0.35 * PULSE_WEIGHT[k], 0), 1);
    }
    return Math.min(Math.max(0.5 + 0.25 * Math.sin(t * 2.1) * Math.sin(t * 0.9) + 0.25 * pulse, 0), 1);
}

function tick(ts: number): void {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    const dt = lastTick ? Math.min((ts - lastTick) / 1000, 0.2) : 0.016;
    if (dt < 0.008) return;
    lastTick = ts;

    const els = collectEls();
    if (els.length === 0) return;

    if (ts - lastMeasure > 500 || els.some(el => !el.style.getPropertyValue('--st-eq-u'))) {
        lastMeasure = ts;
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
        const raw = player.getProgress?.() || 0;
        if (raw !== lastRawProgress) {
            lastRawProgress = raw;
            lastRawAt = ts;
        }
        progress = lastRawProgress / 1000;
        if (playing) progress += (ts - lastRawAt) / 1000 + 0.05;
    } catch (e) {}

    const uri = currentTrackUri();
    if (uri && uri !== analysisUri && !fetching) fetchAnalysis();

    const targets = new Array(BAND_COUNT).fill(0);
    let overallTarget = 0;
    if (playing) {
        overallTarget = analysis ? analysisLevels(progress, dt, targets) : syntheticLevels(ts, speed, targets);
    }

    const attack = 1 - Math.exp(-dt * 90 * speed);
    const release = 1 - Math.exp(-dt * 14 * speed);
    overall += (overallTarget - overall) * (overallTarget > overall ? attack : release);
    for (let k = 0; k < BAND_COUNT; k++) {
        levels[k] += (targets[k] - levels[k]) * (targets[k] > levels[k] ? attack : release);
    }

    const beatStr = `${(analysis ? analysis.beatDur : 0.5).toFixed(3)}s`;
    els.forEach(el => {
        el.classList.toggle('st-eq-paused', !playing);
        el.style.setProperty('--st-eq-level', overall.toFixed(3));
        for (let k = 0; k < BAND_COUNT; k++) {
            el.style.setProperty(`--st-eq-b${k + 1}`, levels[k].toFixed(3));
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
}
