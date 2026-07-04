interface VideoBreak {
    start_ms: number;
    end_ms: number;
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

const videoCache = new Map<string, VideoMeta | null>();

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
let ytReady = false;

let ytApiLoading = false;
const ytApiCallbacks: Array<() => void> = [];

let mediaPlaying = false;
let lastSync = 0;
let lastOfficialCheck = 0;

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

function normalizeMeta(raw: any, id: string): VideoMeta | null {
    if (!raw || typeof raw !== 'object') return null;
    const type = raw.source_type;
    const ref = raw.source_ref;
    if ((type !== 'youtube' && type !== 'mp4_url') || !ref) return null;

    const num = (x: any, fallback: number) => (typeof x === 'number' && isFinite(x) ? x : fallback);
    const start = num(raw.video_start_ms, 0);
    const end = num(raw.video_end_ms, 0);
    if (end <= start) return null;

    const breaks: VideoBreak[] = Array.isArray(raw.breaks)
        ? raw.breaks
              .filter((b: any) => b && isFinite(b.start_ms) && isFinite(b.end_ms) && b.end_ms > b.start_ms)
              .map((b: any) => ({ start_ms: b.start_ms, end_ms: b.end_ms }))
              .sort((a: VideoBreak, b: VideoBreak) => a.start_ms - b.start_ms)
        : [];

    return {
        spotify_track_id: id,
        source_type: type,
        source_ref: String(ref),
        video_start_ms: start,
        video_end_ms: end,
        breaks,
        track_duration_ms: num(raw.track_duration_ms, end - start),
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
        segStart = b.end_ms;
    }
    return Math.min(segStart + remaining, v.video_end_ms);
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
    document.head.appendChild(tag);
}

function disableYtCaptions(player: any): void {
    try {
        player.unloadModule?.('captions');
        player.unloadModule?.('cc');
    } catch (e) {}
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
            },
        });
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

    lastSync = 0;
    lastOfficialCheck = 0;

    if (meta.source_type === 'mp4_url') {
        const video = document.createElement('video');
        video.muted = true;
        video.loop = false;
        video.autoplay = false;
        video.preload = 'auto';
        video.setAttribute('playsinline', '');
        video.playsInline = true;
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
        video.src = meta.source_ref;
        container.appendChild(video);
        mp4El = video;
    } else {
        loadYouTubeAPI(() => createYtPlayer(container, meta.source_ref));
    }

    setPageActive(true);
}

function teardownSource(): void {
    if (mp4El) {
        try {
            mp4El.pause();
        } catch (e) {}
        mp4El.remove();
        mp4El = null;
    }
    if (ytPlayer) {
        try {
            ytPlayer.destroy();
        } catch (e) {}
        ytPlayer = null;
    }
    ytReady = false;
    mediaPlaying = false;
    const c = document.getElementById(CONTAINER_ID);
    if (c) c.innerHTML = '';
    setPageActive(false);
    currentId = null;
    currentMeta = null;
    activeSource = null;
}

function isMediaReady(): boolean {
    if (activeSource === 'mp4_url') return !!mp4El && mp4El.readyState >= 2;
    if (activeSource === 'youtube') return ytReady && !!ytPlayer;
    return false;
}

function getVideoMs(): number {
    try {
        if (activeSource === 'mp4_url' && mp4El) return mp4El.currentTime * 1000;
        if (activeSource === 'youtube' && ytPlayer?.getCurrentTime) return ytPlayer.getCurrentTime() * 1000;
    } catch (e) {}
    return NaN;
}

function seekVideo(ms: number): void {
    try {
        if (activeSource === 'mp4_url' && mp4El) mp4El.currentTime = ms / 1000;
        else if (activeSource === 'youtube' && ytPlayer?.seekTo) ytPlayer.seekTo(ms / 1000, true);
    } catch (e) {}
}

function setMediaPlaying(play: boolean): void {
    if (play === mediaPlaying) return;
    mediaPlaying = play;
    try {
        if (activeSource === 'mp4_url' && mp4El) {
            if (play) mp4El.play().catch(() => {});
            else mp4El.pause();
        } else if (activeSource === 'youtube' && ytPlayer) {
            if (play) ytPlayer.playVideo?.();
            else ytPlayer.pauseVideo?.();
        }
    } catch (e) {}
}

async function evaluate(): Promise<void> {
    if (!running || evaluating) return;
    evaluating = true;
    try {
        const id = currentTrackId();
        if (!id) {
            teardownSource();
            return;
        }
        if (officialForId === id) {
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

    if (!currentMeta || !activeSource) return;

    if (ts - lastOfficialCheck > OFFICIAL_CHECK_MS) {
        lastOfficialCheck = ts;
        if (spotifyHasOwnVideo()) {
            officialForId = currentId;
            teardownSource();
            return;
        }
    }

    if (!isMediaReady()) return;

    const v = currentMeta;
    let playing = false;
    let songMs = 0;
    try {
        const player = Spicetify.Player as any;
        playing = typeof player.isPlaying === 'function'
            ? !!player.isPlaying()
            : !(player.data?.isPaused ?? player.data?.is_paused ?? true);
        songMs = player.getProgress?.() || 0;
    } catch (e) {}

    const targetVideoMs = songMsToVideoMs(v, songMs);

    if (targetVideoMs >= v.video_end_ms) {
        setMediaPlaying(false);
        return;
    }

    let actualVideoMs = getVideoMs();

    if (isFinite(actualVideoMs)) {
        for (const b of v.breaks) {
            if (actualVideoMs >= b.start_ms && actualVideoMs < b.end_ms) {
                seekVideo(b.end_ms);
                actualVideoMs = b.end_ms;
                break;
            }
        }
    }

    if (!isFinite(actualVideoMs) || Math.abs(actualVideoMs - targetVideoMs) > SEEK_THRESHOLD_MS) {
        seekVideo(targetVideoMs);
    }

    setMediaPlaying(playing);
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
    if (!currentMeta || !activeSource) {
        if (!evaluating) evaluate();
        return;
    }
    const c = document.getElementById(CONTAINER_ID);
    if (!c) {
        buildSource(currentId!, currentMeta);
        return;
    }
    if (c.parentElement !== page) page.appendChild(c);
    setPageActive(true);
}
