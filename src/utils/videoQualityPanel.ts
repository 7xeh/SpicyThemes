import {
    FREE_MAX_HEIGHT,
    PREMIUM_INFO_URL,
    QUALITY_CHOICES,
    QualityPref,
    avatarUrl,
    cancelLink,
    dismissUnlinkNotice,
    formatHeight,
    getLinkState,
    getQualityPref,
    getTicketState,
    hasLinkedDevice,
    onTubeChange,
    openExternal,
    refreshTicketManually,
    startLink,
    unlinkDevice,
} from './tubeAccess';
import {
    chooseVideoQuality,
    getVideoQualityStatus,
    onVideoQualityChange,
    requestLiveQualities,
} from './musicVideo';

export interface VideoQualityPanel {
    root: HTMLElement;
    sync: () => void;
}

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

function spinner(): HTMLElement {
    const s = el('span', 'st-m-vq-spinner');
    s.setAttribute('aria-hidden', 'true');
    return s;
}

function countdown(expiresAt: number): string {
    const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function lockedLevels(): number[] {
    const q = getVideoQualityStatus().qualities;
    return q ? q.locked.filter(h => h > FREE_MAX_HEIGHT) : [];
}

function renderFreeUpsell(container: HTMLElement, linked: boolean): void {
    container.appendChild(row(
        textBlock(
            linked ? `Quality: Auto (up to ${FREE_MAX_HEIGHT}p)` : `Free, up to ${FREE_MAX_HEIGHT}p`,
            linked
                ? 'Premium unlocks HD up to 4K and quality choice.'
                : `Quality: Auto (up to ${FREE_MAX_HEIGHT}p). Premium unlocks HD up to 4K and quality choice.`,
        ),
        linked
            ? actions(button('Get Premium', '', () => openExternal(PREMIUM_INFO_URL)))
            : actions(button('Link Discord for Premium', 'primary', () => startLink().catch(() => {}))),
    ));

    const locked = lockedLevels();
    if (locked.length) {
        const chips = el('div', 'st-m-vq-chips');
        locked.forEach(h => {
            const chip = el('span', 'st-m-chip st-m-vq-chip locked', `🔒 ${formatHeight(h)}`);
            chip.title = 'Premium only';
            chips.appendChild(chip);
        });
        container.appendChild(row(textBlock('Available with Premium'), chips));
    }
}

function renderLinking(container: HTMLElement): void {
    const link = getLinkState();

    if (link.phase === 'starting') {
        const status = el('div', 'st-m-vq-status');
        status.append(spinner(), document.createTextNode(' Getting a link code…'));
        container.appendChild(row(status, actions(button('Cancel', '', () => cancelLink()))));
        return;
    }

    if (link.phase === 'error' || link.phase === 'expired') {
        const message = link.phase === 'expired'
            ? 'That code expired before it was used.'
            : link.error || 'Linking failed.';
        container.appendChild(row(
            el('div', 'st-m-vq-error', message),
            actions(
                button(link.phase === 'expired' ? 'Get a new code' : 'Try again', 'primary', () => startLink().catch(() => {})),
                button('Cancel', '', () => cancelLink()),
            ),
        ));
        return;
    }

    const box = el('div', 'st-m-vq-link');
    box.appendChild(el('div', 'st-m-vq-sub', 'Open the link page, sign in with Discord and press “Link this Spotify”. Your code is:'));
    const code = el('div', 'st-m-vq-code', link.userCode || '');
    code.setAttribute('aria-label', `Link code ${link.userCode || ''}`);
    box.appendChild(code);

    const waiting = el('div', 'st-m-vq-sub st-m-vq-waiting');
    waiting.append(spinner(), document.createTextNode(` Waiting for you to confirm… code expires in ${countdown(link.expiresAt)}`));
    box.appendChild(waiting);

    box.appendChild(actions(
        button('Open link page', 'primary', () => {
            if (link.verifyUrlComplete) openExternal(link.verifyUrlComplete);
        }),
        button('Cancel', '', () => cancelLink()),
    ));
    container.appendChild(box);
}

function renderAccount(container: HTMLElement): void {
    const t = getTicketState();
    const user = t.user;

    const who = el('div', 'st-m-vq-account');
    const initial = () => el('span', 'st-m-vq-avatar', (user?.username || '?').slice(0, 1).toUpperCase());
    const src = avatarUrl(user);
    if (src) {
        const img = el('img', 'st-m-vq-avatar');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => img.replaceWith(initial()), { once: true });
        img.src = src;
        who.appendChild(img);
    } else {
        who.appendChild(initial());
    }
    const name = el('div', 'st-m-vq-text');
    name.appendChild(el('div', 'st-m-vq-status', user?.username || 'Linked Discord account'));
    const badgeLine = el('div', 'st-m-vq-sub');
    if (!t.checked && t.refreshing) {
        badgeLine.append(spinner(), document.createTextNode(' Checking…'));
    } else {
        const badge = el('span', `st-m-vq-badge ${t.premium ? 'st-m-vq-badge-premium' : 'st-m-vq-badge-free'}`, t.premium ? 'Premium' : 'Free');
        badgeLine.appendChild(badge);
        badgeLine.appendChild(document.createTextNode(t.premium ? ` Up to ${formatHeight(Math.min(t.maxHeight, 2160))}` : ` Up to ${FREE_MAX_HEIGHT}p`));
    }
    name.appendChild(badgeLine);
    who.appendChild(name);

    const refresh = button(t.refreshing ? 'Checking…' : 'Refresh', '', () => refreshTicketManually().catch(() => {}));
    refresh.disabled = t.refreshing;
    refresh.title = 'Check your Premium status again';
    container.appendChild(row(who, actions(refresh, button('Unlink', 'danger', () => unlinkDevice().catch(() => {})))));

    if (t.error) {
        const message = t.error === 'rate_limited'
            ? 'Too many status checks. Retrying shortly.'
            : 'Couldn’t reach the quality service. Your current quality stays until the ticket runs out, then retries.';
        container.appendChild(row(el('div', 'st-m-vq-error', message)));
    }
}

function renderPremiumControls(container: HTMLElement): void {
    const pref = getQualityPref();

    const select = el('select', 'st-m-select');
    const options: { value: string; text: string }[] = [
        { value: 'auto', text: 'Auto' },
        ...QUALITY_CHOICES.map(h => ({ value: String(h), text: formatHeight(h) })),
    ];
    if (pref !== 'auto' && !QUALITY_CHOICES.includes(pref)) options.push({ value: String(pref), text: formatHeight(pref) });
    options.forEach(o => {
        const opt = el('option', undefined, o.text);
        opt.value = o.value;
        select.appendChild(opt);
    });
    select.value = pref === 'auto' ? 'auto' : String(pref);
    select.addEventListener('change', () => {
        const next: QualityPref = select.value === 'auto' ? 'auto' : parseInt(select.value, 10);
        chooseVideoQuality(next);
    });
    container.appendChild(row(
        textBlock('Default quality', 'Higher quality uses more CPU. On Auto the backdrop video stays at 480p and goes up to your limit in fullscreen.'),
        select,
    ));

    const status = getVideoQualityStatus();
    if (status.engine !== 'ytmodule' || !status.qualities) return;

    if (!status.premiumReady) {
        const wait = el('div', 'st-m-vq-sub');
        wait.append(spinner(), document.createTextNode(' Switching this video to Premium quality…'));
        container.appendChild(row(textBlock('Current video'), wait));
        return;
    }

    {
        const q = status.qualities;
        const chips = el('div', 'st-m-vq-chips');
        chips.setAttribute('role', 'radiogroup');
        chips.setAttribute('aria-label', 'Quality for the current video');

        const addChip = (label: string, value: QualityPref, active: boolean) => {
            const chip = el('button', `st-m-chip st-m-vq-chip${active ? ' active' : ''}`, `${active ? '✓ ' : ''}${label}`);
            chip.type = 'button';
            chip.setAttribute('role', 'radio');
            chip.setAttribute('aria-checked', String(active));
            chip.addEventListener('click', () => chooseVideoQuality(value));
            chips.appendChild(chip);
        };
        addChip('Auto', 'auto', q.auto);
        q.levels.forEach(h => addChip(formatHeight(h), h, !q.auto && q.current === h));

        const target = status.switching;
        const playing = target !== null
            ? `Switching to ${target === 'auto' ? 'Auto' : formatHeight(target)}…`
            : q.current > 0 ? `Playing at ${formatHeight(q.current)}${q.auto ? ' (Auto)' : ''}.` : 'Choose a quality for this video.';
        container.appendChild(row(textBlock('Current video', `${playing} Higher quality uses more CPU.`), chips));
    }
}

export function buildVideoQualityPanel(): VideoQualityPanel {
    const root = el('div', 'st-m-field st-m-vq');
    const body = el('div', 'st-m-vq-body');
    root.appendChild(body);

    const render = () => {
        body.innerHTML = '';
        const link = getLinkState();
        const linked = hasLinkedDevice();
        const t = getTicketState();

        if (link.phase !== 'idle') {
            renderLinking(body);
            return;
        }
        if (!linked) {
            if (link.unlinkUnconfirmed) {
                body.appendChild(row(
                    el('div', 'st-m-vq-error', 'Unlinked on this device, but the server couldn’t be reached. Remove this device from your list on the link page so it can’t be used again.'),
                    actions(
                        button('Open link page', '', () => openExternal(PREMIUM_INFO_URL)),
                        button('Dismiss', '', () => dismissUnlinkNotice()),
                    ),
                ));
            }
            renderFreeUpsell(body, false);
            return;
        }
        renderAccount(body);
        if (t.premium) renderPremiumControls(body);
        else if (t.checked) renderFreeUpsell(body, true);
    };

    const disposers: (() => void)[] = [];
    let ticker: ReturnType<typeof setInterval> | null = null;
    const dispose = () => {
        disposers.splice(0).forEach(fn => fn());
        if (ticker) {
            clearInterval(ticker);
            ticker = null;
        }
    };
    const update = () => {
        if (!root.isConnected && root.dataset.vqMounted === '1') {
            dispose();
            return;
        }
        render();
    };

    disposers.push(onTubeChange(update));
    disposers.push(onVideoQualityChange(update));
    ticker = setInterval(() => {
        if (!root.isConnected) {
            if (root.dataset.vqMounted === '1') dispose();
            return;
        }
        root.dataset.vqMounted = '1';
        if (getLinkState().phase === 'waiting') {
            const w = body.querySelector('.st-m-vq-waiting');
            if (w && w.lastChild) w.lastChild.textContent = ` Waiting for you to confirm… code expires in ${countdown(getLinkState().expiresAt)}`;
        }
    }, 1000);

    render();
    requestLiveQualities();

    return { root, sync: render };
}
