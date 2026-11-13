import {
    VideoListEntry,
    VideoListMode,
    allowVideo,
    allowedVideos,
    blockVideo,
    blockedVideos,
    clearAllowedVideos,
    clearBlockedVideos,
    currentTrackEntry,
    disallowVideo,
    onVideoListChange,
    setVideoListMode,
    unblockVideo,
    videoAllowed,
    videoBlocked,
    videoListMode,
} from './videoList';

export interface VideoListPanel {
    root: HTMLElement;
    sync: () => void;
}

const CONFIRM_MS = 3500;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(label: string, variant: '' | 'primary' | 'danger', onClick: () => void): HTMLButtonElement {
    const b = el('button', `st-m-btn${variant ? ` st-m-btn-${variant}` : ''}`, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
}

function row(...children: (HTMLElement | null)[]): HTMLElement {
    const r = el('div', 'st-m-vq-row');
    children.forEach(c => {
        if (c) r.appendChild(c);
    });
    return r;
}

function textBlock(title: string, sub?: string): HTMLElement {
    const box = el('div', 'st-m-vq-text');
    box.appendChild(el('div', 'st-m-vq-status', title));
    if (sub) box.appendChild(el('div', 'st-m-vq-sub', sub));
    return box;
}

function actions(...buttons: HTMLElement[]): HTMLElement {
    const box = el('div', 'st-m-vq-actions');
    buttons.forEach(b => box.appendChild(b));
    return box;
}

function songName(entry: { id: string; title: string; artist: string }): string {
    return entry.title || `Track ${entry.id}`;
}

function clearButton(onConfirm: () => void): HTMLButtonElement {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const b = button('Clear list', '', () => {
        if (!armed) {
            armed = true;
            b.textContent = 'Click again to clear';
            b.classList.add('st-m-btn-danger');
            timer = setTimeout(() => {
                armed = false;
                b.textContent = 'Clear list';
                b.classList.remove('st-m-btn-danger');
            }, CONFIRM_MS);
            return;
        }
        if (timer) clearTimeout(timer);
        onConfirm();
    });
    return b;
}

function renderList(container: HTMLElement, title: string, empty: string, entries: VideoListEntry[], onRemove: (id: string) => void, onClear: () => void): void {
    const head = row(
        textBlock(`${title} (${entries.length})`, entries.length ? undefined : empty),
        entries.length > 1 ? actions(clearButton(onClear)) : null,
    );
    container.appendChild(head);
    if (!entries.length) return;
    const list = el('div', 'st-m-vl-list');
    list.setAttribute('role', 'list');
    entries.forEach(entry => {
        const item = el('div', 'st-m-vl-item');
        item.setAttribute('role', 'listitem');
        const name = el('div', 'st-m-vl-name');
        name.appendChild(el('span', 'st-m-vl-title', songName(entry)));
        if (entry.artist) name.appendChild(el('span', 'st-m-vl-artist', ` · ${entry.artist}`));
        name.title = entry.artist ? `${songName(entry)} · ${entry.artist}` : songName(entry);
        const remove = el('button', 'st-m-vl-remove', 'Remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${songName(entry)}`);
        remove.addEventListener('click', () => onRemove(entry.id));
        item.append(name, remove);
        list.appendChild(item);
    });
    container.appendChild(list);
}

function renderCurrent(container: HTMLElement): void {
    const track = currentTrackEntry();
    if (!track) return;
    const mode = videoListMode();
    const blocked = videoBlocked(track.id);
    const allowed = videoAllowed(track.id);
    const label = track.artist ? `${songName(track)} · ${track.artist}` : songName(track);

    let status: string;
    const buttons: HTMLElement[] = [];
    if (blocked) {
        status = 'Blocked. Its video never plays.';
        buttons.push(button('Unblock', 'primary', () => unblockVideo(track.id)));
    } else if (mode === 'allow' && allowed) {
        status = 'On your allowed list.';
        buttons.push(button('Remove from allowed', '', () => disallowVideo(track.id)));
        buttons.push(button('Block', 'danger', () => blockVideo(track)));
    } else if (mode === 'allow') {
        status = 'Not on your allowed list, so its video stays off.';
        buttons.push(button('Allow this song', 'primary', () => allowVideo(track)));
    } else {
        status = 'Its video plays whenever one exists.';
        buttons.push(button('Block this song', 'danger', () => blockVideo(track)));
    }
    const text = textBlock(`Now playing: ${label}`, status);
    text.title = label;
    container.appendChild(row(text, actions(...buttons)));
}

export function buildVideoListPanel(): VideoListPanel {
    const root = el('div', 'st-m-field st-m-vq st-m-vl');
    const body = el('div', 'st-m-vq-body');
    root.appendChild(body);
    let shownTrack = '';

    const render = () => {
        body.innerHTML = '';
        shownTrack = currentTrackEntry()?.id || '';
        const mode = videoListMode();

        const select = el('select', 'st-m-select');
        const options: { value: VideoListMode; text: string }[] = [
            { value: 'all', text: 'Every song, except blocked ones' },
            { value: 'allow', text: 'Only songs on my allowed list' },
        ];
        options.forEach(o => {
            const opt = el('option', undefined, o.text);
            opt.value = o.value;
            select.appendChild(opt);
        });
        select.value = mode;
        select.setAttribute('aria-label', 'Which songs play videos');
        select.addEventListener('change', () => setVideoListMode(select.value === 'allow' ? 'allow' : 'all'));
        body.appendChild(row(
            textBlock('Which songs play videos', 'You can also add the current song from the video button beside the theme button in Spicy Lyrics.'),
            select,
        ));

        renderCurrent(body);

        const allowed = allowedVideos();
        if (mode === 'allow' || allowed.length) {
            renderList(body, 'Allowed songs', 'Nothing here yet, so no videos play in this mode.', allowed, disallowVideo, clearAllowedVideos);
        }
        renderList(body, 'Blocked songs', 'Nothing blocked.', blockedVideos(), unblockVideo, clearBlockedVideos);
    };

    let unsubscribe: (() => void) | null = null;
    let ticker: ReturnType<typeof setInterval> | null = null;
    let mounted = false;
    const dispose = () => {
        unsubscribe?.();
        unsubscribe = null;
        if (ticker) {
            clearInterval(ticker);
            ticker = null;
        }
    };

    unsubscribe = onVideoListChange(() => {
        if (mounted && !root.isConnected) {
            dispose();
            return;
        }
        render();
    });
    ticker = setInterval(() => {
        if (!root.isConnected) {
            if (mounted) dispose();
            return;
        }
        mounted = true;
        if ((currentTrackEntry()?.id || '') !== shownTrack) render();
    }, 1000);

    render();
    return { root, sync: render };
}
