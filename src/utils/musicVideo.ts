import { YtModulePlayer, YTMODULE_STATE, ytModuleParentOrigin } from './ytmodule';
import { debug } from './debug';

interface VideoBreak {
    start_ms: number;
    end_ms: number;
    hold_ms?: number;
}

interface VideoMeta {
    spotify_track_id: string;
    source_type: 'youtube' | 'mp4_url';
    source_ref: string;
    video_start_ms: number;
    video_end_ms: number;
    breaks: VideoBreak[];
    track_duration_ms: number;
    track_title?: string;
    track_artist?: string;
    track_album_art?: string;
}

const API_BASE = 'https://7xeh.dev/apps/spicythemes/api/videos.php';
const CONTAINER_ID = 'spicy-themes-mv';

const FETCH_TIMEOUT = 6000;
const SEEK_THRESHOLD_MS = 350;
const SYNC_INTERVAL_MS = 60;
const OFFICIAL_CHECK_MS = 600;
const PREFETCH_COUNT = 5;
const AD_CONFIRM_TICKS = 3;
const AD_DURATION_MARGIN_MS = 1500;
const LOAD_TIMEOUT_MS = 9000;
const SEEK_COOLDOWN_MS = 400;
const PLAY_RETRY_MS = 400;
const MAX_SOURCE_ATTEMPTS = 2;
const MODE_CHECK_MS = 400;
const YTMODULE_COOLDOWN_MS = 10 * 60 * 1000;
const YTMODULE_FAIL_LIMIT = 2;
const YTMODULE_VIDEO_ERRORS = ['unavailable'];
const YTMODULE_STALL_MS = 4000;

const videoCache = new Map<string, VideoMeta | null>();
const failCounts = new Map<string, number>();

let running = false;
let rafId: number | null = null;
let songChangeHooked = false;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;
let evaluating = false;

let currentId: string | null = null;
let currentMeta: VideoMeta | null = null;
let activeSource: 'youtube' | 'mp4_url' | null = null;
let officialForId: string | null = null;

let mp4El: HTMLVideoElement | null = null;
let ytPlayer: any = null;
let ytModulePlayer: YtModulePlayer | null = null;
let ytEngine: 'ytmodule' | 'iframe_api' | null = null;
let ytReady = false;
let buildToken = 0;

let ytModuleFails = 0;
let ytModuleBlockedUntil = 0;
let ytModuleLastSample = -1;
let ytModuleStallDeadline = 0;

let ytApiLoading = false;
const ytApiCallbacks: Array<() => void> = [];

let mediaPlaying = false;
let mediaVisible = false;
let loadDeadline = 0;
let adActive = false;
let adSignalCount = 0;
let lastSync = 0;
let lastOfficialCheck = 0;
let lastSeekAt = 0;
let lastPlayAttempt = 0;
let lastModeCheck = 0;
let lastStatePlayAttempt = 0;
let allowCompact = false;
let compactBlocked = false;

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

function currentTrackUri(): string | null {
    try {
        return Spicetify?.Player?.data?.item?.uri || Spicetify?.Player?.data?.track?.uri || null;
    } catch (e) {
        return null;
    }
}

function uriToId(uri: string | null): string | null {
    if (!uri) return null;
    const parts = uri.split(':');
    const id = parts[parts.length - 1];
    return id || null;
}

function currentTrackId(): string | null {
    return uriToId(currentTrackUri());
}

function currentSongMs(): number {
    try {
        return (Spicetify.Player as any).getProgress?.() || 0;
    } catch (e) {
        return 0;
    }
}

function isYouTubeHost(host: string): boolean {
    return (
        host === 'youtu.be' ||
        host === 'youtube.com' ||
        host === 'www.youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'www.youtube-nocookie.com' ||
        host === 'youtube-nocookie.com'
    );
}

function extractYouTubeId(ref: string): string | null {
    const s = ref.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(
        /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\/?\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
}

function refIsYouTubeUrl(ref: string): boolean {
    const s = ref.trim();
    if (!/^(https?:)?\/\//i.test(s) && !/^(www\.)?youtu/i.test(s)) return false;
    try {
        const u = new URL(s.startsWith('//') ? `https:${s}` : /^https?:\/\//i.test(s) ? s : `https://${s}`);
        return isYouTubeHost(u.hostname.toLowerCase());
    } catch (e) {
        return false;
    }
}

function normalizeMediaUrl(ref: string): string | null {
    let s = ref.trim();
    if (!s) return null;
    if (s.startsWith('//')) s = `https:${s}`;
    else if (/^http:\/\//i.test(s)) s = `https://${s.slice(7)}`;
    else if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
    if (!/^https:\/\//i.test(s)) return null;

    let u: URL;
    try {
        u = new URL(s);
    } catch (e) {
        return null;
    }
    const host = u.hostname.toLowerCase();

    if (host === 'drive.google.com') {
        const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
        return id ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : null;
    }
    if (host === 'www.dropbox.com' || host === 'dropbox.com') {
        u.hostname = 'dl.dropboxusercontent.com';
        u.searchParams.delete('dl');
        u.searchParams.set('raw', '1');
        return u.toString();
    }
    if (host === 'github.com' && u.pathname.includes('/blob/')) {
        u.hostname = 'raw.githubusercontent.com';
        u.pathname = u.pathname.replace('/blob/', '/');
        return u.toString();
    }
    return u.toString();
}

function normalizeMeta(raw: any, id: string): VideoMeta | null {
    if (!raw || typeof raw !== 'object') return null;

    let ref = raw.source_ref == null ? '' : String(raw.source_ref).trim();
    if (!ref) return null;

    let type: 'youtube' | 'mp4_url';
    if (raw.source_type === 'youtube' || raw.source_type === 'mp4_url') {
        type = raw.source_type;
    } else {
        type = refIsYouTubeUrl(ref) || /^[A-Za-z0-9_-]{11}$/.test(ref) ? 'youtube' : 'mp4_url';
    }

    if (type === 'youtube') {
        const ytId = extractYouTubeId(ref);
        if (!ytId) return null;
        ref = ytId;
    } else if (refIsYouTubeUrl(ref)) {
        const ytId = extractYouTubeId(ref);
        if (!ytId) return null;
        type = 'youtube';
        ref = ytId;
    } else {
        const url = normalizeMediaUrl(ref);
        if (!url) return null;
        ref = url;
    }

    const num = (x: any, fallback: number) => {
        const n = typeof x === 'string' ? Number(x) : x;
        return typeof n === 'number' && isFinite(n) ? n : fallback;
    };
    const start = Math.max(num(raw.video_start_ms, 0), 0);
    const duration = Math.max(num(raw.track_duration_ms, 0), 0);
    let end = num(raw.video_end_ms, 0);
    if (end <= start && duration > 0) end = start + duration;
    if (end <= start) return null;

    const breaks: VideoBreak[] = Array.isArray(raw.breaks)
        ? raw.breaks
              .map((b: any) => {
                  if (!b) return null;
                  const br: VideoBreak = { start_ms: num(b.start_ms, NaN), end_ms: num(b.end_ms, NaN) };
                  const hold = num(b.hold_ms, 0);
                  if (isFinite(hold) && hold > 0) br.hold_ms = hold;
                  return br;
              })
              .filter(
                  (b: any): b is VideoBreak =>
                      !!b &&
                      isFinite(b.start_ms) &&
                      isFinite(b.end_ms) &&
                      (b.end_ms > b.start_ms || (b.hold_ms ?? 0) > 0)
              )
              .sort((a: VideoBreak, b: VideoBreak) => a.start_ms - b.start_ms)
        : [];

    return {
        spotify_track_id: id,
        source_type: type,
        source_ref: ref,
        video_start_ms: start,
        video_end_ms: end,
        breaks,
        track_duration_ms: duration || end - start,
        track_title: raw.track_title,
        track_artist: raw.track_artist,
        track_album_art: raw.track_album_art,
    };
}

async function fetchVideo(id: string): Promise<VideoMeta | null> {
    if (videoCache.has(id)) return videoCache.get(id) ?? null;
    try {
        const res = await fetchWithTimeout(`${API_BASE}?action=get&track=${encodeURIComponent(id)}`);
        if (res.status === 404) {
            videoCache.set(id, null);
            return null;
        }
        if (!res.ok) return null;
        const data = await res.json();
        const meta = normalizeMeta(data?.video, id);
        videoCache.set(id, meta);
        return meta;
    } catch (e) {
        return null;
    }
}

async function batchPrefetch(ids: string[]): Promise<void> {
    const want = ids.filter(id => id && !videoCache.has(id)).slice(0, 50);
    if (want.length === 0) return;
    try {
        const res = await fetchWithTimeout(`${API_BASE}?action=get&tracks=${want.map(encodeURIComponent).join(',')}`);
        if (!res.ok) return;
        const data = await res.json();
        const videos = data?.videos;
        const map = videos && !Array.isArray(videos) ? videos : {};
        for (const id of want) {
            videoCache.set(id, map[id] ? normalizeMeta(map[id], id) : null);
        }
    } catch (e) {}
}

function queueIds(): string[] {
    const ids: string[] = [];
    try {
        const q = (Spicetify as any).Queue;
        const next = q?.nextTracks || q?._queue?.nextTracks || [];
        for (const t of next) {
            const uri = t?.contextTrack?.uri || t?.uri;
            const id = uriToId(uri);
            if (id && !uri.includes(':ad:')) ids.push(id);
            if (ids.length >= PREFETCH_COUNT) break;
        }
    } catch (e) {}
    return ids;
}

export function songMsToVideoMs(v: VideoMeta, songMs: number): number {
    let remaining = Math.max(songMs, 0);
    let segStart = v.video_start_ms;
    for (const b of v.breaks) {
        const segLen = b.start_ms - segStart;
        if (remaining <= segLen) return segStart + remaining;
        remaining -= segLen;
        if (b.hold_ms && b.hold_ms > 0) {
            if (remaining <= b.hold_ms) return b.start_ms;
            remaining -= b.hold_ms;
            segStart = b.start_ms;
        } else {
            segStart = b.end_ms;
        }
    }
    return Math.min(segStart + remaining, v.video_end_ms);
}

function songMsInHold(v: VideoMeta, songMs: number): boolean {
    let remaining = Math.max(songMs, 0);
    let segStart = v.video_start_ms;
    for (const b of v.breaks) {
        const segLen = b.start_ms - segStart;
        if (remaining <= segLen) return false;
        remaining -= segLen;
        if (b.hold_ms && b.hold_ms > 0) {
            if (remaining <= b.hold_ms) return true;
            remaining -= b.hold_ms;
            segStart = b.start_ms;
        } else {
            segStart = b.end_ms;
        }
    }
    return false;
}

function spotifyHasOwnVideo(): boolean {
    const scopes = [
        document.querySelector('#SpicyLyricsPage'),
    ];
    for (const scope of scopes) {
        if (!scope) continue;
        const vids = scope.querySelectorAll('video');
        for (const vid of Array.from(vids) as HTMLVideoElement[]) {
            if (vid.closest(`#${CONTAINER_ID}`)) continue;
            const src = vid.currentSrc || vid.src || vid.querySelector('source')?.getAttribute('src') || '';
            if (src && !vid.ended) return true;
        }
    }
    return false;
}

function isCompactBlocked(): boolean {
    if (allowCompact) return false;
    const page = document.querySelector('#SpicyLyricsPage');
    if (!page) return false;
    return page.classList.contains('CardMode') || page.classList.contains('CompactMode');
}

export function setMusicVideoCompactAllowed(allowed: boolean): void {
    const next = !!allowed;
    if (next === allowCompact) return;
    allowCompact = next;
    if (!running) return;
    compactBlocked = isCompactBlocked();
    if (compactBlocked) teardownSource();
    else if (!evaluating) evaluate();
}

function setPageActive(active: boolean): void {
    const page = document.querySelector('#SpicyLyricsPage');
    if (page) page.classList.toggle('st-mv-active', active);
}

function ensureContainer(): HTMLElement | null {
    const page = document.querySelector('#SpicyLyricsPage');
    if (!page) return null;
    let c = document.getElementById(CONTAINER_ID);
    if (!c) {
        c = document.createElement('div');
        c.id = CONTAINER_ID;
    }
    if (c.parentElement !== page) page.appendChild(c);
    return c;
}

function removeContainer(): void {
    document.getElementById(CONTAINER_ID)?.remove();
}

function loadYouTubeAPI(cb: () => void): void {
    const w = window as any;
    if (w.YT && w.YT.Player) {
        cb();
        return;
    }
    ytApiCallbacks.push(cb);
    if (ytApiLoading) return;
    ytApiLoading = true;

    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
        try {
            if (typeof prev === 'function') prev();
        } catch (e) {}
        const cbs = ytApiCallbacks.slice();
        ytApiCallbacks.length = 0;
        cbs.forEach(fn => {
            try {
                fn();
            } catch (e) {}
        });
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
        ytApiLoading = false;
        ytApiCallbacks.length = 0;
    };
    document.head.appendChild(tag);
}

function disableYtCaptions(player: any): void {
    try {
        player.unloadModule?.('captions');
        player.unloadModule?.('cc');
    } catch (e) {}
}

function ytModuleAvailable(): boolean {
    if (ytModuleBlockedUntil && Date.now() >= ytModuleBlockedUntil) {
        ytModuleBlockedUntil = 0;
        ytModuleFails = 0;
    }
    return ytModuleBlockedUntil === 0;
}

function createYtModulePlayer(container: HTMLElement, videoId: string): void {
    if (!running || activeSource !== 'youtube' || currentMeta?.source_ref !== videoId) return;
    ytReady = false;
    const token = buildToken;
    const startSec = Math.max(0, Math.floor(songMsToVideoMs(currentMeta, currentSongMs()) / 1000));
    debug('music video: yt module embed', videoId, 'parent origin', ytModuleParentOrigin());
    try {
        ytModulePlayer = new YtModulePlayer(container, {
            videoId,
            start: startSec,
            autoplay: true,
            controls: false,
            className: 'st-mv-yt',
            onReady: player => {
                if (token !== buildToken || ytModulePlayer !== player) return;
                ytModuleFails = 0;
                ytReady = true;
                player.mute();
                player.setVolume(0);
                if (currentMeta) player.seekTo(songMsToVideoMs(currentMeta, currentSongMs()) / 1000);
                player.playVideo();
                ytModuleLastSample = -1;
                ytModuleStallDeadline = performance.now() + YTMODULE_STALL_MS;
            },
            onCommandError: detail => {
                debug('music video: yt module command rejected', detail);
            },
            onError: (code, message, player) => {
                if (token !== buildToken || ytModulePlayer !== player) return;
                debug('music video: yt module error', code, message);
                const videoFault = YTMODULE_VIDEO_ERRORS.indexOf(code) !== -1;
                setTimeout(() => {
                    if (token === buildToken) fallbackToIframeApi(videoFault);
                }, 0);
            },
        });
    } catch (e) {
        fallbackToIframeApi();
    }
}

function fallbackToIframeApi(videoFault = false): void {
    if (!running || activeSource !== 'youtube' || ytEngine !== 'ytmodule') return;
    const meta = currentMeta;
    const container = document.getElementById(CONTAINER_ID);
    if (!meta || !container) return;

    if (!videoFault) {
        ytModuleFails++;
        if (ytModuleFails >= YTMODULE_FAIL_LIMIT) {
            ytModuleBlockedUntil = Date.now() + YTMODULE_COOLDOWN_MS;
        }
    }

    destroyPlayers();
    container.innerHTML = '';
    mediaPlaying = false;
    mediaVisible = false;
    adActive = false;
    adSignalCount = 0;
    lastSeekAt = 0;
    lastPlayAttempt = 0;
    lastStatePlayAttempt = 0;
    ytModuleLastSample = -1;
    ytModuleStallDeadline = 0;
    loadDeadline = performance.now() + LOAD_TIMEOUT_MS;
    setPageActive(false);

    ytEngine = 'iframe_api';
    const token = buildToken;
    loadYouTubeAPI(() => {
        if (token !== buildToken) return;
        createYtPlayer(container, meta.source_ref);
    });
}

function createYtPlayer(container: HTMLElement, videoId: string): void {
    if (!running || activeSource !== 'youtube' || currentMeta?.source_ref !== videoId) return;
    const host = document.createElement('div');
    host.className = 'st-mv-yt';
    container.appendChild(host);
    ytReady = false;
    const startSec = Math.max(0, Math.floor(songMsToVideoMs(currentMeta, currentSongMs()) / 1000));
    try {
        ytPlayer = new (window as any).YT.Player(host, {
            videoId,
            playerVars: {
                controls: 0,
                disablekb: 1,
                modestbranding: 1,
                rel: 0,
                fs: 0,
                iv_load_policy: 3,
                playsinline: 1,
                autoplay: 1,
                mute: 1,
                start: startSec,
            },
            events: {
                onReady: (e: any) => {
                    ytReady = true;
                    disableYtCaptions(e.target);
                    try {
                        e.target.mute();
                        e.target.seekTo(songMsToVideoMs(currentMeta as VideoMeta, currentSongMs()) / 1000, true);
                    } catch (err) {}
                },
                onStateChange: (e: any) => {
                    disableYtCaptions(e.target);
                },
                onError: () => {
                    setTimeout(() => failSource(), 0);
                },
            },
        });
    } catch (e) {
        failSource();
    }
}

function attachMp4(container: HTMLElement, meta: VideoMeta): void {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = false;
    video.controls = false;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.playsInline = true;
    video.disablePictureInPicture = true;
    (video as any).disableRemotePlayback = true;
    video.setAttribute('disableremoteplayback', '');

    const disableTextTracks = () => {
        try {
            for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'disabled';
            }
        } catch (e) {}
    };
    try {
        video.textTracks.addEventListener('addtrack', disableTextTracks);
    } catch (e) {}

    video.addEventListener('loadedmetadata', () => {
        if (mp4El !== video) return;
        disableTextTracks();
        try {
            video.currentTime = songMsToVideoMs(meta, currentSongMs()) / 1000;
        } catch (e) {}
    });
    video.addEventListener('error', () => {
        if (mp4El === video) failSource();
    });

    video.autoplay = true;
    video.src = meta.source_ref;
    container.appendChild(video);
    mp4El = video;
    try {
        video.play().catch(() => {});
    } catch (e) {}
}

function buildSource(id: string, meta: VideoMeta): void {
    teardownSource();
    const container = ensureContainer();
    if (!container) return;

    currentId = id;
    currentMeta = meta;
    activeSource = meta.source_type;
    mediaPlaying = false;
    mediaVisible = false;
    adActive = false;
    adSignalCount = 0;

    lastSync = 0;
    lastOfficialCheck = 0;
    lastSeekAt = 0;
    lastPlayAttempt = 0;
    lastStatePlayAttempt = 0;
    ytModuleLastSample = -1;
    ytModuleStallDeadline = 0;
    loadDeadline = performance.now() + LOAD_TIMEOUT_MS;

    if (meta.source_type === 'mp4_url') {
        attachMp4(container, meta);
    } else if (ytModuleAvailable()) {
        ytEngine = 'ytmodule';
        createYtModulePlayer(container, meta.source_ref);
    } else {
        ytEngine = 'iframe_api';
        const token = buildToken;
        loadYouTubeAPI(() => {
            if (token !== buildToken) return;
            createYtPlayer(container, meta.source_ref);
        });
    }
}

function destroyPlayers(): void {
    if (mp4El) {
        const el = mp4El;
        mp4El = null;
        try {
            el.pause();
            el.removeAttribute('src');
            el.load();
        } catch (e) {}
        el.remove();
    }
    if (ytModulePlayer) {
        const p = ytModulePlayer;
        ytModulePlayer = null;
        try {
            p.pauseVideo();
        } catch (e) {}
        try {
            p.destroy();
        } catch (e) {}
    }
    if (ytPlayer) {
        const p = ytPlayer;
        ytPlayer = null;
        try {
            p.stopVideo?.();
        } catch (e) {}
        try {
            p.destroy?.();
        } catch (e) {}
    }
    ytReady = false;
}

function teardownSource(): void {
    buildToken++;
    destroyPlayers();
    ytEngine = null;
    mediaPlaying = false;
    mediaVisible = false;
    adActive = false;
    adSignalCount = 0;
    const c = document.getElementById(CONTAINER_ID);
    if (c) {
        c.querySelectorAll('iframe').forEach(f => {
            try {
                f.src = 'about:blank';
            } catch (e) {}
        });
        c.innerHTML = '';
    }
    setPageActive(false);
    currentId = null;
    currentMeta = null;
    activeSource = null;
}

function failSource(): void {
    const id = currentId;
    if (id) failCounts.set(id, (failCounts.get(id) || 0) + 1);
    teardownSource();
}

function isMediaReady(): boolean {
    if (activeSource === 'mp4_url') return !!mp4El && mp4El.readyState >= 2;
    if (activeSource === 'youtube') return ytReady && (!!ytPlayer || !!ytModulePlayer);
    return false;
}

function hasRenderableFrame(): boolean {
    try {
        if (activeSource === 'mp4_url') return !!mp4El && mp4El.readyState >= 2 && mp4El.videoWidth > 0;
        if (activeSource === 'youtube') {
            if (ytModulePlayer) {
                return (
                    ytReady &&
                    (ytModulePlayer.getDuration() > 0 ||
                        ytModulePlayer.getPlayerState() === YTMODULE_STATE.playing)
                );
            }
            return ytReady && !!ytPlayer && (ytPlayer.getDuration?.() || 0) > 0;
        }
    } catch (e) {}
    return false;
}

function isYtAdPlaying(): boolean {
    if (ytEngine === 'ytmodule') return false;
    if (activeSource !== 'youtube' || !ytReady || !ytPlayer || !currentMeta) return false;
    try {
        const data = ytPlayer.getVideoData?.();
        const playingId = data && typeof data.video_id === 'string' ? data.video_id : '';
        if (playingId && playingId !== currentMeta.source_ref) return true;

        const durMs = (ytPlayer.getDuration?.() || 0) * 1000;
        if (durMs > 0 && durMs < currentMeta.video_end_ms - AD_DURATION_MARGIN_MS) return true;
    } catch (e) {}
    return false;
}

function songIsPlaying(): boolean {
    try {
        const player = Spicetify.Player as any;
        return typeof player.isPlaying === 'function'
            ? !!player.isPlaying()
            : !(player.data?.isPaused ?? player.data?.is_paused ?? true);
    } catch (e) {
        return false;
    }
}

function getVideoMs(): number {
    try {
        if (activeSource === 'mp4_url' && mp4El) return mp4El.currentTime * 1000;
        if (activeSource === 'youtube') {
            if (ytModulePlayer) return ytModulePlayer.getCurrentTime() * 1000;
            if (ytPlayer?.getCurrentTime) return ytPlayer.getCurrentTime() * 1000;
        }
    } catch (e) {}
    return NaN;
}

function seekVideo(ms: number, ts: number): void {
    if (ts - lastSeekAt < SEEK_COOLDOWN_MS) return;
    try {
        if (activeSource === 'mp4_url' && mp4El) {
            if (mp4El.seeking) return;
            mp4El.currentTime = ms / 1000;
        } else if (activeSource === 'youtube' && ytModulePlayer) {
            ytModulePlayer.seekTo(ms / 1000);
        } else if (activeSource === 'youtube' && ytPlayer?.seekTo) {
            ytPlayer.seekTo(ms / 1000, true);
        } else {
            return;
        }
        lastSeekAt = ts;
    } catch (e) {}
}

function setMediaPlaying(play: boolean, ts: number): void {
    try {
        if (activeSource === 'mp4_url' && mp4El) {
            mediaPlaying = play;
            const paused = mp4El.paused || mp4El.ended;
            if (play && paused) {
                if (ts - lastPlayAttempt < PLAY_RETRY_MS) return;
                lastPlayAttempt = ts;
                mp4El.play().catch(() => {});
            } else if (!play && !paused) {
                mp4El.pause();
            }
            return;
        }
        if (activeSource === 'youtube' && ytModulePlayer) {
            const p = ytModulePlayer;
            const state = p.getPlayerState();
            const active = state === YTMODULE_STATE.playing || state === YTMODULE_STATE.buffering;
            mediaPlaying = play;
            if (play) {
                if (!active && ts - lastStatePlayAttempt >= PLAY_RETRY_MS) {
                    lastStatePlayAttempt = ts;
                    p.mute();
                    p.playVideo();
                }
            } else if (active) {
                p.pauseVideo();
            }
            return;
        }
        if (play === mediaPlaying) return;
        mediaPlaying = play;
        if (activeSource === 'youtube' && ytPlayer) {
            if (play) ytPlayer.playVideo?.();
            else ytPlayer.pauseVideo?.();
        }
    } catch (e) {}
}

async function evaluate(): Promise<void> {
    if (!running || evaluating) return;
    evaluating = true;
    try {
        compactBlocked = isCompactBlocked();
        if (compactBlocked) {
            teardownSource();
            return;
        }
        const id = currentTrackId();
        if (!id) {
            teardownSource();
            return;
        }
        if (officialForId === id) {
            teardownSource();
            return;
        }
        if ((failCounts.get(id) || 0) >= MAX_SOURCE_ATTEMPTS) {
            teardownSource();
            return;
        }
        if (spotifyHasOwnVideo()) {
            officialForId = id;
            teardownSource();
            return;
        }
        const meta = await fetchVideo(id);
        if (!running || currentTrackId() !== id) return;
        if (!meta) {
            teardownSource();
            return;
        }
        if (currentId === id && currentMeta && activeSource) return;
        buildSource(id, meta);
    } finally {
        evaluating = false;
    }
}

function tick(ts: number): void {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (ts - lastSync < SYNC_INTERVAL_MS) return;
    lastSync = ts;

    if (ts - lastModeCheck > MODE_CHECK_MS) {
        lastModeCheck = ts;
        const blocked = isCompactBlocked();
        if (blocked !== compactBlocked) {
            compactBlocked = blocked;
            if (blocked) {
                teardownSource();
                return;
            }
            if (!evaluating) evaluate();
        }
    }
    if (compactBlocked) return;

    if (!currentMeta || !activeSource) return;

    if (ts - lastOfficialCheck > OFFICIAL_CHECK_MS) {
        lastOfficialCheck = ts;
        if (spotifyHasOwnVideo()) {
            officialForId = currentId;
            teardownSource();
            return;
        }
    }

    if (!mediaVisible) {
        if (hasRenderableFrame()) {
            mediaVisible = true;
            setPageActive(true);
        } else if (ts > loadDeadline) {
            failSource();
            return;
        }
    }

    if (!isMediaReady()) {
        if (activeSource === 'mp4_url') setMediaPlaying(songIsPlaying(), ts);
        return;
    }

    if (ytEngine === 'ytmodule' && ytModulePlayer) {
        const sample = ytModulePlayer.getSampleTime();
        if (sample !== ytModuleLastSample || !mediaPlaying) {
            ytModuleLastSample = sample;
            ytModuleStallDeadline = ts + YTMODULE_STALL_MS;
        } else if (ts > ytModuleStallDeadline) {
            debug('music video: yt module stalled, falling back');
            fallbackToIframeApi();
            return;
        }
    }

    if (activeSource === 'youtube') {
        adSignalCount = isYtAdPlaying() ? Math.min(adSignalCount + 1, AD_CONFIRM_TICKS) : 0;
        const hide = adSignalCount >= AD_CONFIRM_TICKS;
        if (hide !== adActive) {
            adActive = hide;
            setPageActive(mediaVisible && !adActive);
        }
        if (adActive) {
            setMediaPlaying(songIsPlaying(), ts);
            return;
        }
    }

    const v = currentMeta;
    let songMs = 0;
    try {
        songMs = (Spicetify.Player as any).getProgress?.() || 0;
    } catch (e) {}
    const playing = songIsPlaying();

    const targetVideoMs = songMsToVideoMs(v, songMs);

    if (targetVideoMs >= v.video_end_ms) {
        setMediaPlaying(false, ts);
        return;
    }

    let actualVideoMs = getVideoMs();

    const holding = songMsInHold(v, songMs);

    if (isFinite(actualVideoMs)) {
        for (const b of v.breaks) {
            if (b.hold_ms && b.hold_ms > 0) continue;
            if (actualVideoMs >= b.start_ms && actualVideoMs < b.end_ms) {
                seekVideo(b.end_ms, ts);
                actualVideoMs = b.end_ms;
                break;
            }
        }
    }

    if (!isFinite(actualVideoMs) || Math.abs(actualVideoMs - targetVideoMs) > SEEK_THRESHOLD_MS) {
        seekVideo(targetVideoMs, ts);
    }

    setMediaPlaying(playing && !holding, ts);
}

function onSongChange(): void {
    officialForId = null;
    teardownSource();
    if (recheckTimer) {
        clearTimeout(recheckTimer);
        recheckTimer = null;
    }
    if (!running) return;
    evaluate();
    batchPrefetch(queueIds());
    recheckTimer = setTimeout(() => {
        recheckTimer = null;
        if (running) evaluate();
    }, 1200);
}

export function startMusicVideo(): void {
    if (running) return;
    running = true;
    if (!songChangeHooked) {
        try {
            Spicetify.Player.addEventListener('songchange', onSongChange);
            songChangeHooked = true;
        } catch (e) {}
    }
    lastSync = 0;
    lastOfficialCheck = 0;
    lastModeCheck = 0;
    compactBlocked = isCompactBlocked();
    evaluate();
    batchPrefetch(queueIds());
    rafId = requestAnimationFrame(tick);
}

export function stopMusicVideo(): void {
    if (!running) return;
    running = false;
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (recheckTimer) {
        clearTimeout(recheckTimer);
        recheckTimer = null;
    }
    teardownSource();
    removeContainer();
    officialForId = null;
}

export function refreshMusicVideoLayer(): void {
    if (!running) return;
    const page = document.querySelector('#SpicyLyricsPage');
    if (!page) return;
    compactBlocked = isCompactBlocked();
    if (compactBlocked) {
        teardownSource();
        return;
    }
    if (!currentMeta || !activeSource) {
        if (!evaluating) evaluate();
        return;
    }
    const c = document.getElementById(CONTAINER_ID);
    if (!c) {
        const id = currentId;
        const meta = currentMeta;
        if (id && meta) buildSource(id, meta);
        return;
    }
    if (c.parentElement !== page) page.appendChild(c);
    setPageActive(mediaVisible && !adActive);
}
