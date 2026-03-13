(async function() {
    const API_HOST = "7xeh.dev";
    const EXTENSION_BASE_URL = "https://7xeh.dev/apps/SpicyThemes/releases";
    const STORAGE_PREFIX = 'spicy-themes:';
    const DEBUG_MODE = localStorage.getItem(STORAGE_PREFIX + 'debug-mode') === 'true';

    const HOTFIX_CHECK_INTERVAL_MS = 30 * 60 * 1000;
    const HOTFIX_FULL_CHECK_INTERVAL_MS = 2 * 60 * 1000;
    const HOTFIX_INITIAL_DELAY_MS = 5 * 60 * 1000;
    const HOTFIX_JITTER_MS = 60 * 1000;

    const log = {
        debug: (...args) => DEBUG_MODE && console.log('[ST-Loader]', ...args),
        info: (...args) => console.log('[ST-Loader]', ...args),
        warn: (...args) => console.warn('[ST-Loader]', ...args),
        error: (...args) => console.error('[ST-Loader]', ...args)
    };

    const storageGet = (key) => localStorage.getItem(STORAGE_PREFIX + key);
    const storageSet = (key, val) => localStorage.setItem(STORAGE_PREFIX + key, val);

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

    const getVersionInfo = async () => {
        const response = await fetch(`https://${API_HOST}/apps/SpicyThemes/api/version.php?action=version&_=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to fetch version info');
        const data = await response.json();
        return {
            version: data.version,
            hash: data.hash || data.sha256 || data.checksum || null
        };
    };

    const loadExtension = async (version) => {
        const url = `${EXTENSION_BASE_URL}/versions/v${version}/spicy-themes.js?_=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load extension: ${response.status}`);

        const code = await response.text();
        const contentHash = await computeSHA256(code);

        const previousHash = storageGet('content-hash');
        const previousVersion = storageGet('loaded-version');
        const isHotfix = !!(contentHash && previousVersion === version && previousHash && previousHash !== contentHash);

        if (contentHash) storageSet('content-hash', contentHash);
        storageSet('loaded-version', version);

        if (isHotfix) {
            storageSet('hotfix-detected', 'true');
        }

        window._spicy_themes_metadata = {
            LoadedVersion: version,
            LoadedAt: Date.now(),
            IsLoader: true,
            ContentHash: contentHash,
            IsHotfix: isHotfix
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

    let hotfixTimer = null;
    let lastFullCheckTime = 0;

    const scheduleHotfixCheck = (delayMs) => {
        if (hotfixTimer) clearTimeout(hotfixTimer);
        const jitter = Math.floor(Math.random() * HOTFIX_JITTER_MS);
        hotfixTimer = setTimeout(runHotfixCheck, delayMs + jitter);
    };

    const runHotfixCheck = async () => {
        if (document.hidden) {
            scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
            return;
        }

        try {
            const info = await getVersionInfo();
            const currentVersion = storageGet('loaded-version');
            const currentHash = storageGet('content-hash');

            if (!currentVersion || !currentHash) {
                scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
                return;
            }

            if (info.version !== currentVersion) {
                log.debug(`Version change detected: ${currentVersion} → ${info.version}, deferring to updater`);
                scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
                return;
            }

            if (info.hash) {
                if (info.hash === currentHash) {
                    log.debug('No hotfix (API hash match)');
                    scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
                    return;
                }

                log.info(`Hotfix detected via API for v${info.version}! Reloading...`);
                storageSet('hotfix-detected', 'true');
                window.location.reload();
                return;
            }

            const now = Date.now();
            if (now - lastFullCheckTime < HOTFIX_FULL_CHECK_INTERVAL_MS) {
                log.debug('Skipping full hotfix check (too recent)');
                scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
                return;
            }

            lastFullCheckTime = now;
            log.debug(`Running full hotfix check for v${info.version}...`);

            const url = `${EXTENSION_BASE_URL}/versions/v${info.version}/spicy-themes.js?_=${now}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
                return;
            }

            const code = await resp.text();
            const newHash = await computeSHA256(code);

            if (newHash && newHash !== currentHash) {
                log.info(`Hotfix detected for v${info.version}! [${currentHash.substring(0, 8)} → ${newHash.substring(0, 8)}] Reloading...`);
                storageSet('content-hash', newHash);
                storageSet('hotfix-detected', 'true');
                window.location.reload();
                return;
            }

            log.debug('No hotfix (content hash match)');
        } catch (e) {
            log.debug('Hotfix check failed:', e);
        }

        scheduleHotfixCheck(HOTFIX_CHECK_INTERVAL_MS);
    };

    const startHotfixChecker = () => {
        scheduleHotfixCheck(HOTFIX_INITIAL_DELAY_MS);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                scheduleHotfixCheck(5000);
            }
        });

        log.debug('Hotfix checker initialized');
    };

    const showError = (message) => {
        const safeMessage = String(message || 'Unknown error')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const waitForModal = setInterval(() => {
            if (typeof Spicetify !== 'undefined' && Spicetify.PopupModal) {
                clearInterval(waitForModal);
                Spicetify.PopupModal.display({
                    title: "Spicy Themes - Error",
                    content: (() => {
                        const div = document.createElement('div');
                        div.innerHTML = `
                            <div style="text-align: center; padding: 16px 0;">
                                <h3 style="margin: 0 0 12px; font-size: 1.2rem; font-weight: 600;">
                                    Failed to load extension
                                </h3>
                                <p style="margin: 0 0 16px; opacity: 0.7;">
                                    ${safeMessage}
                                </p>
                                <p style="margin: 0 0 8px;">
                                    Please check your network connection and try restarting Spotify.
                                </p>
                                <p style="margin: 16px 0 0; font-size: 0.9rem; opacity: 0.7;">
                                    Need help? Visit
                                    <a href="https://github.com/7xeh/SpicyThemes/issues" style="text-decoration: underline;">GitHub Issues</a>
                                </p>
                            </div>
                        `;
                        return div;
                    })(),
                    isLarge: false
                });
            }
        }, 100);

        setTimeout(() => clearInterval(waitForModal), 10000);
    };

    const load = async (retries = 3) => {
        try {
            await waitForSpicetify();
        } catch (err) {
            log.error('Required dependency unavailable:', err);
            showError('Spicetify is not available. Please fully restart Spotify and try again.');
            return;
        }

        log.info('Loading SpicyThemes...');

        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                const info = await getVersionInfo();
                await loadExtension(info.version);
                startHotfixChecker();
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
        showError(lastError?.message || 'Unknown error');
    };

    load();
})();
