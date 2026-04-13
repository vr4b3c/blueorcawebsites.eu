const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const sites = [
    { url: 'https://florian-partneri.cz/', name: 'florian-partneri' },
    { url: 'https://www.milenium.cz/', name: 'milenium' },
    { url: 'http://dev2.leadea.cz/', name: 'dev2-leadea' },
];

function fetchHtml(url) {
    const lib = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchHtml(new URL(res.headers.location, url).href).then(resolve, reject);
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
    });
    const outDir = path.join(__dirname, 'images');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    for (const site of sites) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Screenshotting ${site.url} ...`);

        // Fetch HTML to strip AOS attributes that hide content
        console.log('  Fetching HTML...');
        let html;
        try {
            html = await fetchHtml(site.url);
        } catch (e) {
            console.log(`  SKIPPED: could not fetch ${site.url}: ${e.message}`);
            await page.close();
            continue;
        }

        // Strip data-aos attributes and AOS CSS/JS includes
        html = html.replace(/\s+data-aos[-\w]*="[^"]*"/gi, '');
        html = html.replace(/<link[^>]*aos[^>]*>/gi, '');
        html = html.replace(/<script[^>]*aos[^>]*><\/script>/gi, '');

        // Inject <base> tag for relative resources
        const baseTag = `<base href="${site.url}">`;
        html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);

        // Override AOS CSS residuals + disable animations
        const overrideCss = `<style>
            [data-aos], .aos-init { opacity: 1 !important; transform: none !important; transition: none !important; }
            section.section { opacity: 1 !important; transform: none !important; }
        </style>`;
        html = html.replace('</head>', `${overrideCss}</head>`);

        console.log('  Rendering...');
        await page.setContent(html, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        // Force lazy images
        await page.evaluate(() => {
            document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                img.loading = 'eager';
                if (img.dataset.src) img.src = img.dataset.src;
            });
        });

        // Scroll down to trigger lazy content
        await page.evaluate(async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            for (let y = 0; y < document.body.scrollHeight; y += 500) {
                window.scrollTo(0, y);
                await delay(200);
            }
            window.scrollTo(0, document.body.scrollHeight);
            await delay(1000);
            window.scrollTo(0, 0);
        });
        await new Promise(r => setTimeout(r, 3000));

        const height = await page.evaluate(() => document.body.scrollHeight);
        console.log(`  Page height: ${height}px`);

        const buffer = await page.screenshot({
            fullPage: true,
            type: 'webp',
            quality: 90,
        });
        const filePath = path.join(outDir, `${site.name}-full.webp`);
        fs.writeFileSync(filePath, buffer);
        console.log(`  -> ${filePath}`);

        await page.close();
    }

    await browser.close();
    console.log('Done!');
})();
