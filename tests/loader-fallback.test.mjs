import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const LOADER_SOURCE = readFileSync(new URL('../loader/ST-loader.js', import.meta.url), 'utf8');
const VERSION = '9.9.9';
const PRIMARY_API = 'https://7xeh.dev/apps/spicythemes/api/version.php';
const GITHUB_API = 'https://api.github.com/repos/7xeh/SpicyThemes/releases/latest';
const RELEASE_URL = `https://github.com/7xeh/SpicyThemes/releases/download/v${VERSION}/spicy-themes.js`;
const DEFAULT_PROXY_URL = `https://cors-proxy.spicetify.app/${RELEASE_URL}`;
const BUNDLE = 'window.__bundleRan = true;';
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const stripCacheBust = (url) => url.replace(/[?&]_=\d+$/, '');

const fakeElement = (tag) => {
    const el = {
        tagName: tag,
        textContent: '',
        className: '',
        style: {},
        dataset: {},
        children: [],
        isConnected: false,
        classList: { add() {}, remove() {} },
        setAttribute() {},
        addEventListener() {},
        append(...nodes) { el.children.push(...nodes); },
        appendChild(node) { el.children.push(node); return node; },
        querySelector: () => fakeElement('svg'),
        getBoundingClientRect: () => ({}),
        focus() {},
        remove() { el.isConnected = false; },
    };
    let inner = '';
    Object.defineProperty(el, 'innerHTML', { get: () => inner, set: (v) => { inner = v; } });
    return el;
};

const runLoader = async ({ routes, storage = {}, subtle = webcrypto.subtle }) => {
    const fetched = [];
    const injected = [];
    const head = fakeElement('head');
    const body = fakeElement('body');
    head.appendChild = (node) => {
        if (node.tagName === 'script') injected.push(node.textContent);
        return node;
    };
    let errorShown = false;
    body.append = () => { errorShown = true; };

    const store = { ...storage };
    const context = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
        },
        document: {
            head,
            body,
            createElement: fakeElement,
            getElementById: () => null,
            addEventListener() {},
            removeEventListener() {},
        },
        Spicetify: { Platform: {}, Player: {} },
        crypto: { subtle },
        TextEncoder,
        URL,
        Date,
        Math,
        Promise,
        setTimeout: (fn, ms) => (ms < 10000 ? setTimeout(fn, 0) : 0),
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        fetch: async (url) => {
            fetched.push(url);
            const route = routes[stripCacheBust(url)];
            if (!route) throw new TypeError('Failed to fetch');
            return route();
        },
    };
    context.window = Object.assign(context, { addEventListener() {}, removeEventListener() {} });

    vm.runInNewContext(LOADER_SOURCE, context);

    const deadline = Date.now() + 3000;
    while (!injected.length && !errorShown && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5));
    }
    return { fetched: fetched.map(stripCacheBust), injected, errorShown };
};

const json = (data) => async () => ({ ok: true, status: 200, json: async () => data });
const text = (body) => async () => ({ ok: true, status: 200, text: async () => body });
const corsFailure = async () => { throw new TypeError('Failed to fetch'); };

const release = (assets) => json({ tag_name: `v${VERSION}`, assets });
const bundleAsset = (overrides = {}) => ({
    name: 'spicy-themes.js',
    digest: `sha256:${sha256(BUNDLE)}`,
    browser_download_url: RELEASE_URL,
    ...overrides,
});

test('falls back to the CORS proxy when the primary host is down and the release redirect lacks CORS', async () => {
    const result = await runLoader({
        routes: {
            [GITHUB_API]: release([bundleAsset()]),
            [RELEASE_URL]: corsFailure,
            [DEFAULT_PROXY_URL]: text(BUNDLE),
        },
    });
    assert.deepEqual(result.injected, [BUNDLE]);
    assert.deepEqual(result.fetched, [PRIMARY_API + '?action=version', GITHUB_API, RELEASE_URL, DEFAULT_PROXY_URL]);
});

test('selects the exact bundle asset instead of the first JavaScript asset', async () => {
    const decoyUrl = `https://github.com/7xeh/SpicyThemes/releases/download/v${VERSION}/ST-loader.js`;
    const result = await runLoader({
        routes: {
            [GITHUB_API]: release([
                { name: 'ST-loader.js', digest: `sha256:${sha256('decoy')}`, browser_download_url: decoyUrl },
                bundleAsset(),
            ]),
            [decoyUrl]: text('decoy'),
            [RELEASE_URL]: text(BUNDLE),
        },
    });
    assert.deepEqual(result.injected, [BUNDLE]);
    assert.ok(!result.fetched.includes(decoyUrl));
});

test('uses the direct release download when it succeeds', async () => {
    const result = await runLoader({
        routes: {
            [GITHUB_API]: release([bundleAsset()]),
            [RELEASE_URL]: text(BUNDLE),
            [DEFAULT_PROXY_URL]: text(BUNDLE),
        },
    });
    assert.deepEqual(result.injected, [BUNDLE]);
    assert.ok(!result.fetched.includes(DEFAULT_PROXY_URL));
});

test('honours a custom Spicetify CORS proxy template', async () => {
    const customUrl = `https://proxy.example.com/fetch/${RELEASE_URL}`;
    const result = await runLoader({
        storage: { 'spicetify:corsProxyTemplate': 'https://proxy.example.com/fetch/{url}' },
        routes: {
            [GITHUB_API]: release([bundleAsset()]),
            [RELEASE_URL]: corsFailure,
            [customUrl]: text(BUNDLE),
        },
    });
    assert.deepEqual(result.injected, [BUNDLE]);
    assert.ok(result.fetched.includes(customUrl));
});

for (const [label, template] of [
    ['missing placeholder', 'https://proxy.example.com/'],
    ['insecure scheme', 'http://proxy.example.com/{url}'],
    ['unparseable', 'not a url {url}'],
]) {
    test(`skips the proxy for an invalid template (${label})`, async () => {
        const result = await runLoader({
            storage: { 'spicetify:corsProxyTemplate': template },
            routes: {
                [GITHUB_API]: release([bundleAsset()]),
                [RELEASE_URL]: corsFailure,
                [template.replace('{url}', RELEASE_URL)]: text(BUNDLE),
            },
        });
        assert.deepEqual(result.injected, []);
        assert.ok(result.errorShown);
    });
}

test('refuses the proxy when the release has no digest', async () => {
    const result = await runLoader({
        routes: {
            [GITHUB_API]: release([bundleAsset({ digest: undefined })]),
            [RELEASE_URL]: corsFailure,
            [DEFAULT_PROXY_URL]: text(BUNDLE),
        },
    });
    assert.deepEqual(result.injected, []);
    assert.ok(!result.fetched.includes(DEFAULT_PROXY_URL));
});

test('rejects tampered bytes from the proxy', async () => {
    const result = await runLoader({
        routes: {
            [GITHUB_API]: release([bundleAsset()]),
            [RELEASE_URL]: corsFailure,
            [DEFAULT_PROXY_URL]: text(BUNDLE + 'alert(1);'),
        },
    });
    assert.deepEqual(result.injected, []);
    assert.ok(result.fetched.includes(DEFAULT_PROXY_URL));
    assert.ok(result.errorShown);
});

test('rejects proxied bytes when SHA-256 is unavailable', async () => {
    const result = await runLoader({
        subtle: { digest: async () => { throw new Error('no subtle crypto'); } },
        routes: {
            [GITHUB_API]: release([bundleAsset()]),
            [RELEASE_URL]: corsFailure,
            [DEFAULT_PROXY_URL]: text(BUNDLE),
        },
    });
    assert.deepEqual(result.injected, []);
    assert.ok(result.fetched.includes(DEFAULT_PROXY_URL));
    assert.ok(result.errorShown);
});
