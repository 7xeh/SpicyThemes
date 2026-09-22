export const YTMODULE_ORIGIN = 'https://yt.7xeh.dev';

export const YTMODULE_STATE = {
    unstarted: -1,
    ended: 0,
    playing: 1,
    paused: 2,
    buffering: 3,
    cued: 5,
} as const;

const READY_TIMEOUT_MS = 12000;
const MAX_EXTRAPOLATION_MS = 400;

export interface YtModuleQualities {
    levels: number[];
    locked: number[];
    current: number;
    auto: boolean;
    cap: number;
    limit: number;
    premium: boolean;
}

export interface YtModuleOptions {
    videoId: string;
    start?: number;
    vq?: string | null;
    q?: number;
    autoplay?: boolean;
    controls?: boolean;
    className?: string;
    title?: string;
    onReady?: (player: YtModulePlayer) => void;
    onStateChange?: (state: number, player: YtModulePlayer) => void;
    onError?: (code: string, message: string | undefined, player: YtModulePlayer) => void;
    onCommandError?: (cmd: string, message: string | undefined, player: YtModulePlayer, code?: string) => void;
    onQualities?: (qualities: YtModuleQualities, player: YtModulePlayer) => void;
    onCaptionsChange?: (showing: number, tracks: number, player: YtModulePlayer) => void;
}

type StateName = keyof typeof YTMODULE_STATE;

export function ytModuleParentOrigin(): string {
    try {
        return location.origin || 'null';
    } catch (e) {
        return 'null';
    }
}

export function ytModuleEmbedUrl(videoId: string, opts: YtModuleOptions): string {
    const qs =
        'start=' + Math.max(0, Math.floor(opts.start || 0)) +
        '&autoplay=' + (opts.autoplay ? 1 : 0) +
        '&local=false&listen=false&quality=dash&noaudio=1' +
        '&controls=' + (opts.controls ? 1 : 0) +
        '&captions=0' +
        '&origin=' + encodeURIComponent(ytModuleParentOrigin()) +
        (opts.q && isFinite(opts.q) ? '&q=' + Math.round(opts.q) : '') +
        (opts.vq ? '&vq=' + encodeURIComponent(opts.vq) : '');
    return `${YTMODULE_ORIGIN}/embed/${encodeURIComponent(videoId)}?${qs}`;
}

function heightList(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out: number[] = [];
    raw.forEach(v => {
        const n = typeof v === 'number' ? v : parseInt(String(v), 10);
        if (isFinite(n) && n > 0 && n <= 8640 && !out.includes(n)) out.push(Math.round(n));
    });
    return out.sort((a, b) => b - a);
}

function parseQualities(d: any): YtModuleQualities {
    const levels = heightList(d.levels);
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && isFinite(v) ? v : fallback);
    return {
        levels,
        locked: heightList(d.locked),
        current: num(d.current, 0),
        auto: d.auto === true,
        cap: num(d.cap, 0),
        limit: num(d.limit, 0),
        premium: d.premium === true,
    };
}

export class YtModulePlayer {
    private frame: HTMLIFrameElement;
    private opts: YtModuleOptions;
    private onMessage: (e: MessageEvent) => void;
    private readyTimer: ReturnType<typeof setTimeout> | null;
    private destroyed = false;

    private sec = 0;
    private secAt = 0;
    private dur = 0;
    private state: number = YTMODULE_STATE.unstarted;
    private ready = false;
    private muted = false;
    private capShowing = 0;
    private capTracks = 0;
    private ticketSent: string;
    private ticketWanted: string;
    private ticketSentAt = 0;
    private ticketResends = 0;
    private qualities: YtModuleQualities | null = null;

    constructor(container: HTMLElement, opts: YtModuleOptions) {
        this.opts = opts;
        this.ticketSent = opts.vq || '';
        this.ticketWanted = this.ticketSent;
        if (this.ticketSent) this.ticketSentAt = performance.now();

        const frame = document.createElement('iframe');
        if (opts.className) frame.className = opts.className;
        frame.title = opts.title || 'Synced music video';
        frame.allow = 'accelerometer; encrypted-media; picture-in-picture; autoplay';
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('frameborder', '0');
        frame.src = ytModuleEmbedUrl(opts.videoId, opts);
        container.appendChild(frame);
        this.frame = frame;

        this.secAt = performance.now();

        this.readyTimer = setTimeout(() => {
            this.readyTimer = null;
            if (this.ready || this.destroyed) return;
            this.opts.onError?.('timeout', 'no ready event from the embed', this);
        }, READY_TIMEOUT_MS);

        this.onMessage = (e: MessageEvent) => this.handleMessage(e);
        window.addEventListener('message', this.onMessage);
    }

    private handleMessage(e: MessageEvent): void {
        if (this.destroyed) return;
        if (e.origin !== YTMODULE_ORIGIN) return;
        if (!e.source || e.source !== this.frame.contentWindow) return;
        const d = e.data as any;
        if (!d || d.vdb !== 1) return;

        if (d.event === 'ready') {
            this.clearReadyTimer();
            this.ready = true;
            this.dur = typeof d.duration === 'number' && isFinite(d.duration) ? d.duration : 0;
            this.capShowing = typeof d.showing === 'number' ? d.showing : 0;
            this.capTracks = typeof d.tracks === 'number' ? d.tracks : 0;
            this.flushTicket();
            this.opts.onReady?.(this);
        } else if (d.event === 'time') {
            if (typeof d.sec === 'number' && isFinite(d.sec)) {
                this.sec = d.sec;
                this.secAt = performance.now();
            }
        } else if (d.event === 'state') {
            const name = d.state as StateName;
            const next = YTMODULE_STATE[name] ?? YTMODULE_STATE.unstarted;
            const wasPlaying = this.state === YTMODULE_STATE.playing;
            this.state = next;
            this.secAt = performance.now();
            if (next === YTMODULE_STATE.playing && !wasPlaying) this.poll();
            this.opts.onStateChange?.(next, this);
        } else if (d.event === 'captions') {
            this.capShowing = typeof d.showing === 'number' ? d.showing : 0;
            this.capTracks = typeof d.tracks === 'number' ? d.tracks : 0;
            this.opts.onCaptionsChange?.(this.capShowing, this.capTracks, this);
        } else if (d.event === 'qualities') {
            const parsed = parseQualities(d);
            this.qualities = parsed;
            this.opts.onQualities?.(parsed, this);
        } else if (d.event === 'cmderror') {
            this.opts.onCommandError?.(
                String(d.cmd || 'unknown'),
                typeof d.message === 'string' ? d.message : undefined,
                this,
                typeof d.code === 'string' ? d.code : undefined,
            );
        } else if (d.event === 'error') {
            this.clearReadyTimer();
            this.opts.onError?.(String(d.code || 'unknown'), d.message, this);
        }
    }

    private clearReadyTimer(): void {
        if (this.readyTimer !== null) {
            clearTimeout(this.readyTimer);
            this.readyTimer = null;
        }
    }

    private send(cmd: string, extra?: Record<string, unknown>): void {
        if (this.destroyed) return;
        try {
            const win = this.frame.contentWindow;
            if (!win) return;
            win.postMessage({ vdb: 1, cmd, ...(extra || {}) }, YTMODULE_ORIGIN);
        } catch (e) {}
    }

    private flushTicket(): void {
        if (!this.ready || this.ticketWanted === this.ticketSent) return;
        this.ticketSent = this.ticketWanted;
        this.ticketSentAt = performance.now();
        this.ticketResends = 0;
        this.send('ticket', { vq: this.ticketWanted });
    }

    resendTicket(minGapMs: number, maxResends: number): boolean {
        if (!this.ready || !this.ticketWanted) return false;
        if (this.ticketResends >= maxResends) return false;
        const now = performance.now();
        if (now - this.ticketSentAt < minGapMs) return false;
        this.ticketResends++;
        this.ticketSentAt = now;
        this.ticketSent = this.ticketWanted;
        this.send('ticket', { vq: this.ticketWanted });
        return true;
    }

    ticketResendsExhausted(maxResends: number): boolean {
        return this.ticketResends >= maxResends;
    }

    msUntilTicketResend(minGapMs: number): number {
        return Math.max(0, minGapMs - (performance.now() - this.ticketSentAt));
    }

    isReady(): boolean {
        return this.ready;
    }

    setTicket(vq: string | null): void {
        this.ticketWanted = vq || '';
        this.flushTicket();
    }

    getQualities(): YtModuleQualities | null {
        return this.qualities;
    }

    requestQualities(): void {
        if (this.ready) this.send('qualities');
    }

    setQuality(height: number | 'auto'): void {
        if (!this.ready) return;
        if (height !== 'auto' && (!isFinite(height) || height <= 0)) return;
        this.send('quality', { height });
    }

    getCurrentTime(): number {
        if (this.state !== YTMODULE_STATE.playing) return this.sec;
        const elapsed = Math.min(performance.now() - this.secAt, MAX_EXTRAPOLATION_MS);
        return this.sec + Math.max(elapsed, 0) / 1000;
    }

    getCaptionsShowing(): number {
        return this.capShowing;
    }

    getCaptionsTracks(): number {
        return this.capTracks;
    }

    setCaptions(on: boolean): void {
        this.send('captions', { on: !!on });
    }

    getSampleTime(): number {
        return this.sec;
    }

    getDuration(): number {
        return this.dur;
    }

    getPlayerState(): number {
        return this.state;
    }

    poll(): void {
        this.send('poll');
    }

    seekTo(sec: number): void {
        if (!isFinite(sec)) return;
        this.sec = Math.max(sec, 0);
        this.secAt = performance.now();
        this.send('seek', { sec: this.sec });
    }

    playVideo(): void {
        this.send('play');
    }

    pauseVideo(): void {
        this.send('pause');
    }

    mute(): void {
        this.muted = true;
        this.send('mute', { on: true });
    }

    unMute(): void {
        this.muted = false;
        this.send('mute', { on: false });
    }

    isMuted(): boolean {
        return this.muted;
    }

    setVolume(v: number): void {
        const clamped = Math.min(Math.max(v, 0), 100);
        this.send('volume', { v: clamped / 100 });
    }

    setPlaybackRate(v: number): void {
        this.send('rate', { v });
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.clearReadyTimer();
        window.removeEventListener('message', this.onMessage);
        try {
            this.frame.src = 'about:blank';
        } catch (e) {}
        this.frame.remove();
    }
}
