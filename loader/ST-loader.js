(async function() {
    const STORAGE_PREFIX = 'spicy-themes:';
    const VERSION_API = 'https://7xeh.dev/apps/SpicyThemes/api/version.php';
    const DEBUG_MODE = localStorage.getItem(STORAGE_PREFIX + 'debug-mode') === 'true';

    const log = {
        debug: (...args) => DEBUG_MODE && console.log('[ST-Loader]', ...args),
        info: (...args) => console.log('[ST-Loader]', ...args),
        warn: (...args) => console.warn('[ST-Loader]', ...args),
        error: (...args) => console.error('[ST-Loader]', ...args)
    };

    function waitForSpicetify() {
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
                reject(new Error('Spicetify not ready after 30s'));
            }, 30000);
        });
    }

    async function fetchVersionInfo() {
        const res = await fetch(VERSION_API + '?action=version', { cache: 'no-store' });
        if (!res.ok) throw new Error('Version API error: ' + res.status);
        return res.json();
    }

    async function downloadExtension(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Download error: ' + res.status);
        return res.text();
    }

    async function computeHash(text) {
        const data = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function getCache() {
        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + 'loader-cache');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function setCache(code, version, hash) {
        try {
            localStorage.setItem(STORAGE_PREFIX + 'loader-cache', JSON.stringify({ code, version, hash }));
        } catch (e) {
            log.warn('Failed to cache extension:', e.message);
        }
    }

    function execute(code) {
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
        script.remove();
    }

    function shortHash(hash) {
        return hash ? hash.substring(0, 12) : 'no-hash';
    }

    try {
        await waitForSpicetify();
        log.info('Loading SpicyThemes...');

        const cached = getCache();
        let versionInfo;

        try {
            versionInfo = await fetchVersionInfo();
            log.debug('Latest version:', versionInfo.version);
        } catch (e) {
            log.warn('Could not check for updates:', e.message);
        }

        const needsUpdate = versionInfo && (!cached || cached.version !== versionInfo.version);

        if (needsUpdate) {
            log.debug('Downloading v' + versionInfo.version + '...');
            const code = await downloadExtension(versionInfo.download_url);

            if (versionInfo.hash) {
                const actualHash = await computeHash(code);
                if (actualHash !== versionInfo.hash) {
                    log.error('Hash mismatch! Expected:', versionInfo.hash, 'Got:', actualHash);
                    if (cached) {
                        log.warn('Falling back to cached v' + cached.version);
                        execute(cached.code);
                        log.info('Loaded v' + cached.version + ' [' + shortHash(cached.hash) + '] (cached fallback)');
                        return;
                    }
                    throw new Error('Hash verification failed and no cached version available');
                }
            }

            setCache(code, versionInfo.version, versionInfo.hash);
            execute(code);
            log.info('Loaded v' + versionInfo.version + ' [' + shortHash(versionInfo.hash) + ']');
        } else if (cached) {
            execute(cached.code);
            log.info('Loaded v' + cached.version + ' [' + shortHash(cached.hash) + '] (cached)');
        } else {
            throw new Error('No extension code available and could not download');
        }
    } catch (err) {
        log.error('Failed to initialize:', err);
    }
})();
