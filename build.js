const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const BUILD_HASH_PLACEHOLDER = 'ST_BUILD_HASH_PLACEHOLDER_0000000000000000000000000000';

const ARGS = process.argv.slice(2);
const IS_WATCH = ARGS.includes('--watch');
let packageVersion = '0.0.0';

try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    const manifestPath = path.resolve(__dirname, 'manifest.json');

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    packageVersion = pkg.version;

    if (manifest.version !== pkg.version) {
        console.log(`[Sync] Updating manifest version: ${manifest.version} -> ${pkg.version}`);
        manifest.version = pkg.version;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
} catch (e) {
    console.error('❌ Version sync failed:', e.message);
    process.exit(1);
}

const OUT_DIR = 'dist';
const OUT_DIR_PATH = path.resolve(__dirname, OUT_DIR);
const OUT_FILE = path.join(OUT_DIR_PATH, 'spicy-themes.js');

if (fs.existsSync(OUT_DIR_PATH)) {
    fs.rmSync(OUT_DIR_PATH, { recursive: true, force: true });
}
fs.mkdirSync(OUT_DIR_PATH, { recursive: true });

console.log(`[Init] Mode: ${IS_WATCH ? 'WATCH' : 'BUILD'}`);
console.log(`[Init] Output: ./${OUT_DIR}/`);

const buildOptions = {
    entryPoints: ['src/app.ts'],
    bundle: true,
    outfile: OUT_FILE,
    format: 'iife',
    globalName: 'SpicyThemes',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: IS_WATCH ? 'inline' : false,
    logLevel: 'info',
    define: {
        '__VERSION__': JSON.stringify(packageVersion),
        '__DEV__': JSON.stringify(false),
        '__BUILD_HASH__': JSON.stringify(BUILD_HASH_PLACEHOLDER)
    }
};

const stampBuildHash = () => {
    if (!fs.existsSync(OUT_FILE)) return;
    const code = fs.readFileSync(OUT_FILE, 'utf8');
    if (!code.includes(BUILD_HASH_PLACEHOLDER)) return;
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    fs.writeFileSync(OUT_FILE, code.split(BUILD_HASH_PLACEHOLDER).join(hash));
    console.log(`[Hash] Build hash: ${hash.substring(0, 12)}`);
};

const run = async () => {
    if (!IS_WATCH) {
        console.log('[TS] Checking types...');
        try {
            execSync('npx tsc --noEmit', { stdio: 'inherit' });
        } catch (e) {
            console.error('❌ Type check failed.');
            process.exit(1);
        }
    }

    if (IS_WATCH) {
        const ctx = await esbuild.context({
            ...buildOptions,
            plugins: [{
                name: 'st-build-hash',
                setup(build) {
                    build.onEnd(() => stampBuildHash());
                }
            }]
        });
        await ctx.watch();
        console.log(`[Watch] Watching for changes...`);
    } else {
        await esbuild.build(buildOptions);
        stampBuildHash();
        console.log(`✅ Build complete`);
    }
};

run().catch(() => process.exit(1));
