(async function() {
    const API_HOST = "7xeh.dev";
    const EXTENSION_BASE_URL = "https://7xeh.dev/apps/spicythemes/releases";
    const VERSION_API_URL = `https://${API_HOST}/apps/spicythemes/api/version.php`;
    const GITHUB_REPO = '7xeh/SpicyThemes';
    const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const STORAGE_PREFIX = 'spicy-themes:';
    const DEBUG_MODE = localStorage.getItem(STORAGE_PREFIX + 'debug-mode') === 'true';

    const log = {
        debug: (...args) => DEBUG_MODE && console.log('[ST-Loader]', ...args),
        info: (...args) => console.log('[ST-Loader]', ...args),
        warn: (...args) => console.warn('[ST-Loader]', ...args),
        error: (...args) => console.error('[ST-Loader]', ...args)
    };

    const storageGet = (key) => localStorage.getItem(STORAGE_PREFIX + key);
    const storageSet = (key, val) => localStorage.setItem(STORAGE_PREFIX + key, val);
    const appendCacheBust = (url) => `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;

    const normalizeVersion = (value) => String(value || '').trim().replace(/^v/i, '');

    const computeSHA256 = async (text) => {
        try {
            const data = new TextEncoder().encode(text);
            const buffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(buffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (e) {
            log.warn('SHA-256 computation unavailable:', e);
            return null;
        }
    };

    const waitForSpicetify = () => {
        return new Promise((resolve, reject) => {
            const check = () => {
                if (
                    typeof Spicetify !== 'undefined' &&
                    Spicetify.Platform &&
                    Spicetify.Player
                ) {
                    log.debug('Spicetify is ready');
                    resolve();
                    return true;
                }
                return false;
            };

            if (check()) return;

            const interval = setInterval(() => {
                if (check()) clearInterval(interval);
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                reject(new Error('Spicetify not found or not ready after 30 seconds'));
            }, 30000);
        });
    };

    const getVersionInfoFromPrimaryApi = async () => {
        const response = await fetch(appendCacheBust(`${VERSION_API_URL}?action=version`));
        if (!response.ok) throw new Error(`Primary API status ${response.status}`);
        const data = await response.json();
        const version = normalizeVersion(data.version);
        if (!version) throw new Error('Primary API did not return a valid version');

        return {
            version,
            hash: String(data.hash || data.sha256 || data.checksum || '').toLowerCase() || null,
            downloadUrl: data.download_url || ''
        };
    };

    const getVersionInfoFromGitHub = async () => {
        const response = await fetch(appendCacheBust(GITHUB_LATEST_RELEASE_API), {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!response.ok) throw new Error(`GitHub API status ${response.status}`);

        const release = await response.json();
        const version = normalizeVersion(release.tag_name);
        if (!version) throw new Error('GitHub API did not return a valid release tag');

        const jsAsset = Array.isArray(release.assets)
            ? release.assets.find(asset => typeof asset?.name === 'string' && asset.name.endsWith('.js'))
            : null;
        const hash = jsAsset?.digest ? String(jsAsset.digest).replace(/^sha256:/i, '').toLowerCase() : null;

        return {
            version,
            hash,
            downloadUrl: jsAsset?.browser_download_url || ''
        };
    };

    const getVersionInfo = async () => {
        try {
            return await getVersionInfoFromPrimaryApi();
        } catch (primaryError) {
            log.warn('Primary version API unavailable, falling back to GitHub:', primaryError);
            return await getVersionInfoFromGitHub();
        }
    };

    const loadExtension = async (version, preferredDownloadUrl = '', expectedHash = null) => {
        const candidates = [
            preferredDownloadUrl,
            `${EXTENSION_BASE_URL}/versions/v${version}/spicy-themes.js`,
            `${EXTENSION_BASE_URL}/latest/spicy-themes.js`,
        ].filter(Boolean);

        let response = null;
        let resolvedUrl = '';
        let lastFetchError = null;

        for (const baseUrl of [...new Set(candidates)]) {
            const url = appendCacheBust(baseUrl);
            try {
                const currentResponse = await fetch(url);
                if (!currentResponse.ok) {
                    throw new Error(`HTTP ${currentResponse.status}`);
                }

                response = currentResponse;
                resolvedUrl = baseUrl;
                break;
            } catch (e) {
                lastFetchError = e;
                log.debug(`Failed loader source ${baseUrl}:`, e);
            }
        }

        if (!response) {
            throw new Error(`Failed to load extension from all sources: ${lastFetchError?.message || 'Unknown error'}`);
        }

        log.debug('Extension loaded from source:', resolvedUrl);

        const code = await response.text();
        const contentHash = await computeSHA256(code);

        if (expectedHash && contentHash && expectedHash !== contentHash) {
            throw new Error(`Integrity check failed: expected ${expectedHash.substring(0, 12)}, got ${contentHash.substring(0, 12)}`);
        }

        const previousHash = storageGet('content-hash');
        const previousVersion = storageGet('loaded-version');
        const isHotfix = !!(contentHash && previousVersion === version && previousHash && previousHash !== contentHash);

        if (contentHash) storageSet('content-hash', contentHash);
        storageSet('loaded-version', version);

        window._spicy_themes_metadata = {
            LoadedVersion: version,
            LoadedAt: Date.now(),
            IsLoader: true,
            ContentHash: contentHash,
            IsHotfix: isHotfix,
            utils: {
                log
            }
        };

        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
        script.remove();

        const hashTag = contentHash ? ` [${contentHash.substring(0, 12)}]` : '';
        if (isHotfix) {
            log.info(`Hotfix loaded for v${version}${hashTag}`);
        } else {
            log.info(`Loaded v${version}${hashTag}`);
        }
    };

    const LOADER_STYLE_ID = 'st-ld-styles';
    const LOADER_CSS = `
.st-ld-overlay {
    --st-ld-accent: oklch(0.76 0.16 24);
    --st-ld-accent-ink: oklch(0.22 0.07 24);
    --st-ld-field: oklch(0.215 0.012 24);
    --st-ld-deep: oklch(0.18 0.009 24);
    --st-ld-ink: oklch(0.965 0.012 24);
    --st-ld-muted: oklch(0.78 0.008 24);
    --st-ld-faint: oklch(0.62 0.008 24);
    --st-ld-line: color-mix(in oklab, oklch(0.965 0.012 24) 11%, transparent);
    position: fixed;
    inset: 0;
    z-index: 2147482000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0);
    font-family: var(--encore-body-font-stack, var(--fallback-fonts, system-ui, sans-serif));
    -webkit-font-smoothing: antialiased;
    color: var(--st-ld-ink);
    transition: background-color 0.24s ease, backdrop-filter 0.24s ease;
}
.st-ld-overlay.st-ld-open { background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(6px); }
.st-ld-overlay.st-ld-closing { pointer-events: none; background: rgba(0, 0, 0, 0); backdrop-filter: blur(0); }
.st-ld-panel {
    position: relative;
    width: min(28rem, 100%);
    box-sizing: border-box;
    overflow: hidden;
    padding: 26px 26px 22px;
    border-radius: 18px;
    border: 1px solid var(--st-ld-line);
    background: linear-gradient(180deg, var(--st-ld-field), var(--st-ld-deep));
    box-shadow: inset 0 1px 0 color-mix(in oklab, var(--st-ld-ink) 10%, transparent), 0 24px 60px -24px rgba(0, 0, 0, 0.7);
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.2s ease, transform 0.4s cubic-bezier(0.2, 0.9, 0.1, 1);
}
.st-ld-open .st-ld-panel { opacity: 1; transform: none; }
.st-ld-closing .st-ld-panel { opacity: 0; transform: translateY(4px) scale(0.985); transition-duration: 0.16s; }
.st-ld-eyebrow { font-size: 12px; font-weight: 600; color: var(--st-ld-muted); margin: 0 0 8px; }
.st-ld-title { margin: 0 0 10px; font-size: 22px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.15; }
.st-ld-text { margin: 0 0 12px; font-size: 14px; line-height: 1.55; color: var(--st-ld-muted); }
.st-ld-text a { color: var(--st-ld-ink); font-weight: 600; text-underline-offset: 3px; }
.st-ld-detail {
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: 11px;
    border: 1px solid var(--st-ld-line);
    background: color-mix(in oklab, var(--st-ld-deep) 70%, black);
    font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 12px;
    color: var(--st-ld-muted);
    overflow-wrap: anywhere;
}
.st-ld-status { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--st-ld-faint); font-variant-numeric: tabular-nums; }
.st-ld-status[hidden] { display: none; }
.st-ld-ring { width: 18px; height: 18px; transform: rotate(-90deg); flex: 0 0 auto; }
.st-ld-ring circle { fill: none; stroke-width: 2.4; }
.st-ld-ring-track { stroke: var(--st-ld-line); }
.st-ld-ring-fill { stroke: var(--st-ld-accent); stroke-linecap: round; transition: stroke-dashoffset 0.95s linear; }
.st-ld-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.st-ld-btn {
    appearance: none;
    min-height: 40px;
    padding: 0 18px;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.12s ease;
}
.st-ld-btn:active { transform: scale(0.97); }
.st-ld-btn:disabled { opacity: 0.6; cursor: default; }
.st-ld-btn:focus-visible { outline: 2px solid var(--st-ld-accent); outline-offset: 2px; }
.st-ld-primary { background: var(--st-ld-accent); color: var(--st-ld-accent-ink); }
.st-ld-quiet { background: transparent; color: var(--st-ld-muted); }
.st-ld-quiet:hover { background: var(--st-ld-line); color: var(--st-ld-ink); }
.st-ld-toast {
    position: fixed;
    left: 16px;
    bottom: 110px;
    z-index: 2147482500;
    padding: 12px 16px;
    border-radius: 14px;
    border: 1px solid var(--st-ld-line);
    background: linear-gradient(170deg, oklch(0.29 0.05 152), oklch(0.235 0.045 152));
    color: oklch(0.965 0.012 152);
    font-family: var(--encore-body-font-stack, system-ui, sans-serif);
    font-size: 13.5px;
    font-weight: 650;
    box-shadow: 0 16px 36px -14px rgba(0, 0, 0, 0.75);
    transition: opacity 0.3s ease, transform 0.3s ease;
}
@media (prefers-reduced-motion: reduce) {
    .st-ld-overlay, .st-ld-panel, .st-ld-ring-fill { transition-duration: 0.01ms !important; }
    .st-ld-panel { transform: none !important; clip-path: none !important; }
}`;

    const ensureLoaderStyles = () => {
        if (document.getElementById(LOADER_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = LOADER_STYLE_ID;
        style.textContent = LOADER_CSS;
        document.head.appendChild(style);
    };

    const h = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        Object.entries(props).forEach(([key, value]) => {
            if (value === undefined || value === false) return;
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else node.setAttribute(key, value === true ? '' : String(value));
        });
        children.forEach(child => child && node.append(child));
        return node;
    };

    const formatWait = (ms) => {
        const total = Math.max(0, Math.ceil(ms / 1000));
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    };

    const showRecovered = () => {
        ensureLoaderStyles();
        const toast = h('div', { class: 'st-ld-toast', role: 'status', text: 'Spicy Themes is back' });
        document.body.append(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-12px)';
            setTimeout(() => toast.remove(), 320);
        }, 3200);
    };

    let activeError = null;

    const showError = (message, retry = null) => {
        activeError?.close(true);
        const mount = () => {
            if (!document.body) {
                setTimeout(mount, 100);
                return;
            }
            ensureLoaderStyles();

            let retryDelay = 30000;
            let nextAt = 0;
            let timer = 0;
            let ticker = 0;
            let busy = false;
            let closed = false;

            const detail = h('p', { class: 'st-ld-detail', text: String(message || 'Unknown error') });
            const ringFill = h('span');
            ringFill.innerHTML = '<svg class="st-ld-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="st-ld-ring-track" cx="10" cy="10" r="7.5"/><circle class="st-ld-ring-fill" cx="10" cy="10" r="7.5" stroke-dasharray="47.12" stroke-dashoffset="0"/></svg>';
            const statusText = h('span');
            const status = h('div', { class: 'st-ld-status', 'aria-live': 'polite', hidden: !retry }, ringFill, statusText);
            const help = h('p', { class: 'st-ld-text' });
            help.append('Still stuck? Ask on ');
            help.append(h('a', { href: 'https://github.com/7xeh/SpicyThemes/issues', target: '_blank', rel: 'noopener noreferrer', text: 'GitHub Issues' }));
            help.append('.');

            const tryBtn = h('button', { class: 'st-ld-btn st-ld-primary', type: 'button', text: 'Try again' });
            const closeBtn = h('button', { class: 'st-ld-btn st-ld-quiet', type: 'button', text: retry ? 'Keep trying in background' : 'Close' });
            const panel = h('section', { class: 'st-ld-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'st-ld-title' },
                h('p', { class: 'st-ld-eyebrow', text: 'Spicy Themes' }),
                h('h2', { class: 'st-ld-title', id: 'st-ld-title', text: "Spicy Themes couldn't load" }),
                h('p', { class: 'st-ld-text', text: retry
                    ? "Your lyrics still work, they just won't be styled until this loads. Check your connection, a VPN or an ad blocker."
                    : 'Fully quit Spotify and open it again. That usually fixes this.' }),
                detail,
                status,
                help,
                h('div', { class: 'st-ld-actions' }, closeBtn, retry ? tryBtn : null),
            );
            const overlay = h('div', { class: 'st-ld-overlay' }, panel);

            const fill = ringFill.querySelector('.st-ld-ring-fill');
            const paint = () => {
                if (busy) {
                    statusText.textContent = 'Trying now…';
                    fill.setAttribute('stroke-dashoffset', '0');
                    return;
                }
                const left = nextAt - Date.now();
                statusText.textContent = `Trying again in ${formatWait(left)}`;
                fill.setAttribute('stroke-dashoffset', String(47.12 * (1 - Math.max(0, Math.min(1, left / retryDelay)))));
            };

            const schedule = () => {
                if (!retry || closed === 'done') return;
                clearTimeout(timer);
                nextAt = Date.now() + retryDelay;
                timer = setTimeout(attempt, retryDelay);
                paint();
            };

            const attempt = async () => {
                if (!retry || busy) return;
                busy = true;
                tryBtn.disabled = true;
                tryBtn.textContent = 'Connecting…';
                paint();
                clearTimeout(timer);
                const result = await retry();
                busy = false;
                tryBtn.disabled = false;
                tryBtn.textContent = 'Try again';
                if (result && result.ok) {
                    finish();
                    showRecovered();
                    return;
                }
                if (result && result.message) detail.textContent = result.message;
                retryDelay = Math.min(5 * 60 * 1000, Math.round(retryDelay * 1.6));
                schedule();
            };

            const onKey = (event) => {
                if (event.key !== 'Escape' || closed) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                hide();
            };

            const removeOverlay = (immediate) => {
                document.removeEventListener('keydown', onKey, true);
                if (immediate) {
                    overlay.remove();
                    return;
                }
                overlay.classList.remove('st-ld-open');
                overlay.classList.add('st-ld-closing');
                setTimeout(() => overlay.remove(), 220);
            };

            const hide = () => {
                if (closed) return;
                closed = 'hidden';
                removeOverlay(false);
            };

            const finish = (immediate = false) => {
                closed = 'done';
                clearTimeout(timer);
                clearInterval(ticker);
                window.removeEventListener('online', attempt);
                if (activeError === handle) activeError = null;
                if (overlay.isConnected) removeOverlay(immediate);
            };

            const handle = { close: finish };
            activeError = handle;

            tryBtn.addEventListener('click', attempt);
            closeBtn.addEventListener('click', () => (retry ? hide() : finish()));
            overlay.addEventListener('pointerdown', (event) => {
                overlay.dataset.pressed = event.target === overlay ? '1' : '';
            });
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay && overlay.dataset.pressed === '1') retry ? hide() : finish();
            });
            document.addEventListener('keydown', onKey, true);
            if (retry) {
                window.addEventListener('online', attempt);
                ticker = setInterval(paint, 1000);
                schedule();
            }

            document.body.append(overlay);
            overlay.getBoundingClientRect();
            overlay.classList.add('st-ld-open');
            (retry ? tryBtn : closeBtn).focus({ preventScroll: true });
        };
        mount();
    };

    const loadOnce = async () => {
        try {
            const info = await getVersionInfo();
            await loadExtension(info.version, info.downloadUrl || '', info.hash);
            return { ok: true };
        } catch (err) {
            log.warn('Retry failed:', err);
            return { ok: false, message: err?.message || 'Unknown error' };
        }
    };

    const load = async (retries = 3) => {
        try {
            await waitForSpicetify();
        } catch (err) {
            log.error('Required dependency unavailable:', err);
            showError('Spicetify is not available.');
            return;
        }

        log.info('Loading SpicyThemes...');

        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                const info = await getVersionInfo();
                await loadExtension(info.version, info.downloadUrl || '', info.hash);
                return;
            } catch (err) {
                lastError = err;
                log.warn(`Load attempt ${i + 1} failed:`, err);

                if (i < retries - 1) {
                    const delay = 2000 * Math.pow(1.5, i);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        log.error('Failed to load after all retries:', lastError);
        showError(lastError?.message || 'Unknown error', loadOnce);
    };

    load();
})();
