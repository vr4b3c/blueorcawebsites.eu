import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync, watchFile } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { PurgeCSS } from 'purgecss';

const watchMode = process.argv.includes('--watch');
const root = process.cwd();
const distCss = path.join(root, 'assets/css/dist/styles.min.css');
const tmpCss = path.join(root, 'assets/css/dist/styles.tmp.css');
const watchedRoots = ['assets/js', 'assets/webgl', 'assets/canvas', 'assets/core', 'core'];
let running = false;
let queued = false;
let timer = null;

const jsBuilds = [
    {
        entryPoints: ['assets/js/animations.js'],
        outfile: 'assets/js/dist/animations.js'
    },
    {
        entryPoints: ['assets/js/main.js'],
        outfile: 'assets/js/dist/app.js'
    }
];

const purgeSafelist = {
    standard: [
        'active',
        'filter-hidden',
        'is-active',
        'is-open',
        'is-visible',
        'drawer-open',
        'has-webgl',
        'no-transition',
        'ref-detail-rotating',
        'ref-detail-prep'
    ],
    deep: [
        /^active$/,
        /^is-/,
        /^has-/,
        /^filter-hidden$/,
        /^drawer-open$/,
        /^no-transition$/,
        /^ref-/,
        /^faq-/,
        /^mobile-/,
        /^nav-/,
        /^cta-/,
        /^cenik-/,
        /^inquiry-/,
        /^info-panel-/,
        /^contact-/,
        /^footer-form-notice/,
        /^u-/,
        /^text-/,
        /^glass-panel$/,
        /^btn-/
    ],
    greedy: [
        /\[data-/,
        /::/,
        /^body\./
    ]
};

async function buildJs() {
    await Promise.all(jsBuilds.map((options) => esbuild.build({
        ...options,
        bundle: true,
        format: 'iife',
        minify: true,
        logLevel: 'silent'
    })));
}

async function buildCss() {
    await mkdir(path.dirname(distCss), { recursive: true });
    await esbuild.build({
        entryPoints: ['assets/css/styles.css'],
        minify: true,
        outfile: tmpCss,
        logLevel: 'silent'
    });

    const purged = await new PurgeCSS().purge({
        content: [
            'index.html',
            'assets/js/script.js',
            'assets/js/main.js',
            'assets/js/animations.js',
            'assets/webgl/**/*.js',
            'assets/canvas/**/*.js',
            'core/**/*.js'
        ],
        css: [tmpCss],
        safelist: purgeSafelist,
        keyframes: true,
        variables: true
    });

    const fallbackCss = await readFile(tmpCss, 'utf8');
    await writeFile(distCss, purged[0]?.css || fallbackCss);
    await rm(tmpCss, { force: true });
}

async function buildAll() {
    if (running) {
        queued = true;
        return;
    }

    running = true;
    try {
        await buildJs();
        await buildCss();
        console.log(`[build-assets] Production assets updated at ${new Date().toLocaleTimeString('cs-CZ')}`);
    } catch (error) {
        console.error('[build-assets] Build failed');
        console.error(error);
        if (!watchMode) process.exitCode = 1;
    } finally {
        running = false;
        if (queued) {
            queued = false;
            scheduleBuild();
        }
    }
}

function scheduleBuild() {
    clearTimeout(timer);
    timer = setTimeout(buildAll, 120);
}

function collectFiles(dir, extensions = new Set(['.js'])) {
    if (!existsSync(dir)) return [];
    const files = [];

    for (const entry of readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            if (entry === 'dist') continue;
            files.push(...collectFiles(fullPath, extensions));
        } else if (extensions.has(path.extname(entry))) {
            files.push(fullPath);
        }
    }

    return files;
}

function watchSources() {
    const files = [
        path.join(root, 'index.html'),
        path.join(root, 'assets/css/styles.css'),
        ...watchedRoots.flatMap((dir) => collectFiles(path.join(root, dir)))
    ];

    files.forEach((file) => {
        watchFile(file, { interval: 500 }, scheduleBuild);
    });

    console.log(`[build-assets] Watching ${files.length} files with production minify + CSS purge`);
}

await buildAll();

if (watchMode) {
    watchSources();
}
