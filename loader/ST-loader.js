(async function() {
    const STORAGE_PREFIX = 'spicy-themes:';
    const DEBUG_MODE = localStorage.getItem(STORAGE_PREFIX + 'debug-mode') === 'true';

    const log = {
        debug: (...args) => DEBUG_MODE && console.log('[ST-Loader]', ...args),
        info: (...args) => console.log('[ST-Loader]', ...args),
        warn: (...args) => console.warn('[ST-Loader]', ...args),
        error: (...args) => console.error('[ST-Loader]', ...args)
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
                if (check()) {
                    clearInterval(interval);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                const error = new Error('Spicetify not found or not ready after 30 seconds');
                log.error('Spicetify timeout - aborting extension load', error);
                reject(error);
            }, 30000);
        });
    };

    try {
        await waitForSpicetify();
        log.info('Loading SpicyThemes...');

        log.info('SpicyThemes loader ready');
    } catch (err) {
        log.error('Failed to initialize:', err);
    }
})();
