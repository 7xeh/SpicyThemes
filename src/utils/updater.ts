import { storage } from './storage';
import { debug, warn, error as logError, info } from './debug';

declare const __VERSION__: string;

const isLoaderMode = (): boolean => {
    const metadata = (window as any)._spicy_themes_metadata;
    return metadata?.IsLoader === true;
};

const getLoadedVersion = (): string => {
    const metadata = (window as any)._spicy_themes_metadata;
    if (metadata?.LoadedVersion) {
        return metadata.LoadedVersion;
    }
    return typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';
};

const CURRENT_VERSION = getLoadedVersion();
const GITHUB_REPO = '7xeh/SpicyThemes';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

const UPDATE_API_URL = 'https://7xeh.dev/apps/SpicyThemes/api/version.php';

interface VersionInfo {
    major: number;
    minor: number;
    patch: number;
    text: string;
}

interface GitHubRelease {
    tag_name: string;
    name: string;
    html_url: string;
    body: string;
    published_at: string;
    assets: GitHubAsset[];
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    download_count: number;
}

interface UpdateState {
    isUpdating: boolean;
    progress: number;
    status: string;
}

const updateState: UpdateState = {
    isUpdating: false,
    progress: 0,
    status: ''
};

let hasShownUpdateNotice = false;
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MAX_BACKOFF_MS = 2 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const SCHEDULE_JITTER_MS = 2 * 60 * 1000;

let currentCheckIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
let currentBackoffMs = 0;
let checkTimer: number | null = null;
let checkInProgress = false;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function getScheduledDelay(baseMs: number): number {
    const normalizedBase = Math.max(MIN_CHECK_INTERVAL_MS, baseMs);
    const jitter = Math.floor(Math.random() * SCHEDULE_JITTER_MS);
    return normalizedBase + jitter + currentBackoffMs;
}

function scheduleNextCheck(forceDelayMs?: number): void {
    if (checkTimer !== null) {
        window.clearTimeout(checkTimer);
    }
    const delay = typeof forceDelayMs === 'number' ? Math.max(1000, forceDelayMs) : getScheduledDelay(currentCheckIntervalMs);
    checkTimer = window.setTimeout(() => {
        checkForUpdates();
    }, delay);
}

function increaseBackoff(): void {
    currentBackoffMs = currentBackoffMs === 0
        ? 5 * 60 * 1000
        : Math.min(MAX_BACKOFF_MS, currentBackoffMs * 2);
}

function resetBackoff(): void {
    currentBackoffMs = 0;
}

function parseVersion(version: string): VersionInfo | null {
    const cleanVersion = version.replace(/^v/, '');
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        text: cleanVersion
    };
}

function compareVersions(v1: VersionInfo, v2: VersionInfo): number {
    if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
    if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
    if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;
    return 0;
}

export function getCurrentVersion(): VersionInfo {
    return parseVersion(CURRENT_VERSION) || { major: 1, minor: 0, patch: 0, text: CURRENT_VERSION };
}

export async function getLatestVersion(): Promise<{ version: VersionInfo; release: GitHubRelease; downloadUrl: string } | null> {
    let releaseNotes = '';
    let githubRelease: GitHubRelease | null = null;

    try {
        const ghResponse = await fetch(GITHUB_API_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (ghResponse.ok) {
            githubRelease = await ghResponse.json();
            releaseNotes = githubRelease?.body || '';
        }
    } catch (e) {
        debug('Could not fetch GitHub release notes:', e);
    }

    try {
        const response = await fetchWithTimeout(`${UPDATE_API_URL}?action=version&_=${Date.now()}`);
        if (response.ok) {
            const data = await response.json();
            const version = parseVersion(data.version);
            if (version) {
                debug('Got version from self-hosted API:', data.version);
                return {
                    version,
                    release: {
                        tag_name: `v${data.version}`,
                        name: `v${data.version}`,
                        html_url: data.release_notes_url || RELEASES_URL,
                        body: data.changelog || releaseNotes || '',
                        published_at: data.published_at || new Date().toISOString(),
                        assets: [{
                            name: 'spicy-themes.js',
                            browser_download_url: data.download_url,
                            size: 0,
                            download_count: 0
                        }]
                    },
                    downloadUrl: data.download_url
                };
            }
        }
    } catch (error) {
        warn('Self-hosted API unavailable, trying GitHub:', error);
    }

    if (githubRelease) {
        const version = parseVersion(githubRelease.tag_name);
        if (version) {
            const jsAsset = githubRelease.assets?.find(a => a.name.endsWith('.js'));
            return { version, release: githubRelease, downloadUrl: jsAsset?.browser_download_url || '' };
        }
    }

    try {
        const response = await fetchWithTimeout(GITHUB_API_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!response.ok) {
            warn('Failed to fetch latest version:', response.status);
            return null;
        }
        const release: GitHubRelease = await response.json();
        const version = parseVersion(release.tag_name);
        if (!version) {
            warn('Failed to parse version from tag:', release.tag_name);
            return null;
        }
        const jsAsset = release.assets?.find(a => a.name.endsWith('.js'));
        return { version, release, downloadUrl: jsAsset?.browser_download_url || '' };
    } catch (error) {
        logError('Error fetching latest version:', error);
        return null;
    }
}

async function performSilentAutoUpdate(version: VersionInfo, releaseBody?: string): Promise<void> {
    if (updateState.isUpdating) return;
    try {
        updateState.isUpdating = true;
        updateState.progress = 100;
        updateState.status = 'Reloading to apply update';

        storage.set('pending-update-version', version.text);
        storage.set('pending-update-timestamp', Date.now().toString());
        if (releaseBody) {
            storage.set('pending-update-changelog', releaseBody);
        }

        if ((window as any)._spicy_themes_metadata) {
            (window as any)._spicy_themes_metadata = {};
        }

        window.setTimeout(() => {
            window.location.reload();
        }, 350);
    } catch (e) {
        logError('Silent auto-update failed:', e);
        updateState.isUpdating = false;
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function processInlineMarkdown(text: string): string {
    return text
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #1db954; text-decoration: none;" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: #1db954;">$1</code>');
}

function formatReleaseNotes(body: string): string {
    if (!body || body.trim() === '') {
        return '<span style="color: var(--spice-subtext); font-style: italic;">No changelog available for this release.</span>';
    }

    const lines = body.split('\n');
    const output: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
        if (inUl) { output.push('</ul>'); inUl = false; }
        if (inOl) { output.push('</ol>'); inOl = false; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code','Consolas',monospace; font-size: 12px; color: var(--spice-subtext); margin: 8px 0; white-space: pre-wrap; word-break: break-word;"><code>${codeContent.join('\n')}</code></pre>`);
                codeContent = [];
                inCodeBlock = false;
            } else {
                closeLists();
                inCodeBlock = true;
            }
            continue;
        }
        if (inCodeBlock) { codeContent.push(escapeHtml(line)); continue; }
        if (line.trim() === '') { closeLists(); output.push('<div style="height: 8px;"></div>'); continue; }

        const h3 = line.match(/^###\s+(.*)/);
        if (h3) { closeLists(); output.push(`<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--spice-text);">${processInlineMarkdown(h3[1])}</div>`); continue; }
        const h2 = line.match(/^##\s+(.*)/);
        if (h2) { closeLists(); output.push(`<div style="font-weight: 600; font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--spice-text);">${processInlineMarkdown(h2[1])}</div>`); continue; }
        const h1 = line.match(/^#\s+(.*)/);
        if (h1) { closeLists(); output.push(`<div style="font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 10px; color: var(--spice-text);">${processInlineMarkdown(h1[1])}</div>`); continue; }

        if (line.match(/^(---+|===+|\*\*\*+)\s*$/)) {
            closeLists();
            output.push('<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;">');
            continue;
        }
        const bq = line.match(/^>\s?(.*)/);
        if (bq) { closeLists(); output.push(`<div style="border-left: 3px solid #1db954; padding-left: 12px; margin: 6px 0; color: var(--spice-subtext); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`); continue; }

        const ul = line.match(/^\s*[-*+]\s+(.*)/);
        if (ul) {
            if (inOl) { output.push('</ol>'); inOl = false; }
            if (!inUl) { output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">'); inUl = true; }
            output.push(`<li style="display: flex; gap: 8px; margin: 4px 0;"><span style="color: #1db954;">\u2022</span><span>${processInlineMarkdown(ul[1])}</span></li>`);
            continue;
        }
        const ol = line.match(/^\s*(\d+)\.\s+(.*)/);
        if (ol) {
            if (inUl) { output.push('</ul>'); inUl = false; }
            if (!inOl) { output.push('<ol style="margin: 4px 0; padding-left: 20px; color: var(--spice-subtext);">'); inOl = true; }
            output.push(`<li style="margin: 4px 0;">${processInlineMarkdown(ol[2])}</li>`);
            continue;
        }

        closeLists();
        output.push(`<p style="margin: 4px 0; color: var(--spice-subtext);">${processInlineMarkdown(line)}</p>`);
    }

    closeLists();
    if (inCodeBlock) {
        output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: var(--spice-subtext); margin: 8px 0;"><code>${codeContent.join('\n')}</code></pre>`);
    }
    return output.join('');
}

export async function checkForUpdates(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (checkInProgress) return;
    if (!force && now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
        scheduleNextCheck(MIN_CHECK_INTERVAL_MS - (now - lastCheckTime));
        return;
    }
    if (!force && document.hidden) { scheduleNextCheck(); return; }
    if (!force && navigator.onLine === false) { increaseBackoff(); scheduleNextCheck(); return; }

    lastCheckTime = now;
    checkInProgress = true;

    try {
        const latest = await getLatestVersion();
        if (!latest) { increaseBackoff(); return; }

        const current = getCurrentVersion();
        if (compareVersions(latest.version, current) > 0) {
            debug(`Update available: ${current.text} → ${latest.version.text}`);
            if (!hasShownUpdateNotice) {
                hasShownUpdateNotice = true;
                info(`Auto-updating Spicy Themes to ${latest.version.text}`);
            }
            await performSilentAutoUpdate(latest.version, latest.release.body);
            hasShownUpdateNotice = true;
        } else {
            debug('Already on latest version:', current.text);
            resetBackoff();
            hasShownUpdateNotice = false;
        }
    } catch (error) {
        increaseBackoff();
        logError('Error checking for updates:', error);
    } finally {
        checkInProgress = false;
        if (!updateState.isUpdating) {
            scheduleNextCheck();
        }
    }
}

export function startUpdateChecker(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
    currentCheckIntervalMs = Math.max(MIN_CHECK_INTERVAL_MS, intervalMs);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const elapsed = Date.now() - lastCheckTime;
            if (elapsed >= MIN_CHECK_INTERVAL_MS && !checkInProgress && !updateState.isUpdating) {
                checkForUpdates();
            }
        }
    });

    window.addEventListener('online', () => {
        if (!checkInProgress && !updateState.isUpdating) {
            resetBackoff();
            checkForUpdates();
        }
    });

    scheduleNextCheck(5000);
    info('Update checker started');
}

export async function getUpdateInfo(): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseUrl: string | null;
} | null> {
    try {
        const current = getCurrentVersion();
        const latest = await getLatestVersion();
        if (!latest) {
            return { hasUpdate: false, currentVersion: current.text, latestVersion: null, releaseUrl: null };
        }
        return {
            hasUpdate: compareVersions(latest.version, current) > 0,
            currentVersion: current.text,
            latestVersion: latest.version.text,
            releaseUrl: latest.release.html_url
        };
    } catch {
        return null;
    }
}

function showChangelogModal(version: string, changelog: string): void {
    const content = document.createElement('div');
    content.className = 'st-changelog-modal';
    content.innerHTML = `
        <style>
            .st-changelog-modal { padding: 16px; color: var(--spice-text); }
            .st-changelog-modal .changelog-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
            .st-changelog-modal .changelog-badge { background: #1db954; color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; }
            .st-changelog-modal .changelog-subtitle { color: var(--spice-subtext); font-size: 13px; }
            .st-changelog-modal .changelog-content {
                background: var(--spice-card); padding: 16px; border-radius: 8px; margin-bottom: 16px;
                max-height: 400px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1);
                font-size: 13px; line-height: 1.6; color: var(--spice-subtext);
            }
            .st-changelog-modal .changelog-content::-webkit-scrollbar { width: 6px; }
            .st-changelog-modal .changelog-content::-webkit-scrollbar-track { background: transparent; }
            .st-changelog-modal .changelog-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
            .st-changelog-modal .changelog-content a { color: #1db954; text-decoration: none; }
            .st-changelog-modal .changelog-content a:hover { text-decoration: underline; }
            .st-changelog-modal .changelog-content strong { color: var(--spice-text); }
            .st-changelog-modal .changelog-buttons { display: flex; gap: 12px; justify-content: flex-end; }
            .st-changelog-modal .changelog-btn {
                padding: 10px 24px; border-radius: 20px; border: none; cursor: pointer;
                font-size: 14px; font-weight: 600; transition: all 0.2s;
            }
            .st-changelog-modal .changelog-btn.primary { background: #1db954; color: #000; }
            .st-changelog-modal .changelog-btn.primary:hover { background: #1ed760; transform: scale(1.02); }
            .st-changelog-modal .changelog-btn.secondary { background: var(--spice-card); color: var(--spice-text); }
            .st-changelog-modal .changelog-btn.secondary:hover { background: var(--spice-button); }
        </style>
        <div class="changelog-header">
            <span class="changelog-badge">v${version}</span>
            <span class="changelog-subtitle">Here's what's new in this update</span>
        </div>
        <div class="changelog-content">${formatReleaseNotes(changelog)}</div>
        <div class="changelog-buttons">
            <a href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                <button class="changelog-btn secondary" type="button">View on GitHub</button>
            </a>
            <button class="changelog-btn primary" id="st-changelog-dismiss">Got it</button>
        </div>
    `;

    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: '\u{1F389} Spicy Themes Updated!',
            content: content,
            isLarge: true
        });
        setTimeout(() => {
            const dismissBtn = document.getElementById('st-changelog-dismiss');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => Spicetify.PopupModal.hide());
            }
        }, 100);
    }
}

async function fetchChangelogForVersion(version: string): Promise<string> {
    try {
        const tagUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`;
        const response = await fetchWithTimeout(tagUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.ok) {
            const release: GitHubRelease = await response.json();
            if (release.body) return release.body;
        }
    } catch (e) {
        debug('Could not fetch changelog for version', version, ':', e);
    }

    try {
        const response = await fetchWithTimeout(GITHUB_API_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.ok) {
            const release: GitHubRelease = await response.json();
            if (release.body) return release.body;
        }
    } catch (e) {
        debug('Could not fetch latest release changelog:', e);
    }

    return '';
}

export async function showPostUpdateChangelog(): Promise<void> {
    const currentVersion = CURRENT_VERSION;
    let targetVersion: string | null = null;
    let changelog: string | null = null;

    const hotfixDetected = storage.get('hotfix-detected');
    if (hotfixDetected) {
        storage.remove('hotfix-detected');
        await new Promise(r => setTimeout(r, 2000));
        const metadata = (window as any)._spicy_themes_metadata;
        const hashShort = metadata?.ContentHash ? metadata.ContentHash.substring(0, 8) : '';
        const hashLabel = hashShort ? ` [${hashShort}]` : '';
        if (Spicetify.showNotification) {
            Spicetify.showNotification(`Spicy Themes v${currentVersion} hotfix applied!${hashLabel}`);
        }
        info(`Hotfix applied for v${currentVersion}${hashLabel}`);
    }

    const pendingVersion = storage.get('pending-update-version');
    if (pendingVersion) {
        const pendingTimestamp = storage.get('pending-update-timestamp');
        storage.remove('pending-update-version');
        storage.remove('pending-update-timestamp');

        if (pendingTimestamp) {
            const elapsed = Date.now() - parseInt(pendingTimestamp, 10);
            if (elapsed > 60 * 60 * 1000) {
                storage.remove('pending-update-changelog');
                storage.set('last-known-version', currentVersion);
                return;
            }
        }

        changelog = storage.get('pending-update-changelog');
        storage.remove('pending-update-changelog');
        targetVersion = pendingVersion;
    } else {
        const lastKnownVersion = storage.get('last-known-version');
        if (lastKnownVersion && lastKnownVersion !== currentVersion) {
            const lastParsed = parseVersion(lastKnownVersion);
            const currentParsed = parseVersion(currentVersion);
            if (lastParsed && currentParsed && compareVersions(currentParsed, lastParsed) > 0) {
                targetVersion = currentVersion;
                debug(`Version change detected: ${lastKnownVersion} → ${currentVersion}`);
            }
        } else if (!lastKnownVersion) {
            storage.set('last-known-version', currentVersion);
            return;
        }
    }

    storage.set('last-known-version', currentVersion);
    if (!targetVersion) return;

    if (!changelog) {
        changelog = await fetchChangelogForVersion(targetVersion);
    }

    await new Promise(r => setTimeout(r, 2000));
    showChangelogModal(targetVersion, changelog || '');
}

export async function showCurrentChangelog(): Promise<void> {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    showChangelogModal(CURRENT_VERSION, changelog);
}

export const VERSION = CURRENT_VERSION;
export const REPO_URL = RELEASES_URL;
