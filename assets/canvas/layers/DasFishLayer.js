/**
 * DasFishLayer
 *
 * A single powerful predator fish (das.png) that wanders the canvas autonomously.
 * Any school fish or curious fish it touches immediately dies.
 * There is always exactly one instance on screen.
 */
export class DasFishLayer {
    static DEFAULT_CONFIG = {
        size: 100,          // half-width used for edge margin
        speed: 0.5,         // px per frame at 60 fps
        turnRate: 0.005,    // max radians turned per frame — very slow
        lureRadius: 30,     // kill radius around the lure orb
    };

    constructor(options = {}) {
        this.enabled = true;
        this.manager = null;

        this.config = { ...DasFishLayer.DEFAULT_CONFIG, ...options };

        this.fish = null;       // single entity object
        this._image = new Image();
        this._imageLoaded = false;
        this._depthCache = null;

        // WordPress glitch state
        this._glitch = {
            cooldown: 1000 + Math.random() * 2000,
            effect:   null,   // 'freeze'|'tear'|'ghost'
            timer:    0,
            speedMul: 1,
            data:     {},
        };

        // Intro cinematic state
        this._intro = true; // true until das has crossed the midpoint once

        this._image.onload = () => {
            this._imageLoaded = true;
            this._depthCache = this._buildDepthCache(this._image);
        };
        this._image.onerror = () => {
            console.warn('[DasFishLayer] Failed to load das.png');
        };
        this._image.src = 'assets/images/fish/das.webp';
    }

    init(width, height, canvasManager) {
        this.width = width;
        this.height = height;
        this.manager = canvasManager;
        // Spawn lazily in render() — width/height may be 0 here if called before resize
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
    }

    destroy() {
        this.fish = null;
    }

    // ─── Spawn ───────────────────────────────────────────────────────────────

    _spawn() {
        // In intro mode always enter from the right
        const goRight = this._intro ? false : Math.random() < 0.5;
        const midY = this.height * 0.60;
        this.fish = {
            x:    goRight ? -this.config.size : this.width + this.config.size,
            y:    this._intro ? midY : this.height * (0.50 + Math.random() * 0.30),
            vx:   (goRight ? 1 : -1) * this.config.speed,
            size: this.config.size,
            age:  0,
        };

        // Kick off intro school from the right at the same height
        if (this._intro) {
            const fishLayer = this.manager && this.manager.getLayer('fish');
            if (fishLayer && typeof fishLayer.spawnIntroSchool === 'function') {
                fishLayer.spawnIntroSchool(this.width, this.height, midY);
            }
        }
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    _update(deltaTime) {
        const f = this.fish;
        const dt = typeof deltaTime === 'number' ? deltaTime : 16;
        const spd = this.config.speed * (dt / 16);

        f.age += dt;

        this._updateGlitch(dt);

        // End intro after 5 s — plenty of time for the school encounter
        if (this._intro && f.age > 5000) {
            this._intro = false;
        }

        // Horizontal movement — slowed by WordPress loading…
        const effectiveSpd = spd * this._glitch.speedMul;
        f.x += f.vx > 0 ? effectiveSpd : -effectiveSpd;

        // Gentle vertical sine drift — very slow, small amplitude
        f.y += Math.sin(f.age * 0.0004) * 0.18 * (dt / 16);

        // Clamp vertically so it doesn't drift offscreen
        const margin = f.size;
        f.y = Math.max(margin, Math.min(this.height - margin, f.y));

        // Respawn from the other side when fully off-screen
        if (f.vx > 0 && f.x > this.width + f.size * 2) {
            f.x = -f.size;
            f.y = this.height * (0.50 + Math.random() * 0.30);
        } else if (f.vx < 0 && f.x < -f.size * 2) {
            f.x = this.width + f.size;
            f.y = this.height * (0.50 + Math.random() * 0.30);
        }
    }

    // ─── Lure world position ─────────────────────────────────────────────────

    // The lure hangs in front of the fish and slightly above.
    // Forward offset along travel direction + fixed world-up offset.
    _getLurePos(f) {
        const dir = f.vx >= 0 ? 1 : -1;
        return {
            x: f.x + dir * (f.size * 0.76 - 10),
            y: f.y - f.size * 0.02,
            r: this.config.lureRadius,
        };
    }

    // ─── Kill checks ─────────────────────────────────────────────────────────

    _checkKills() {
        const lure = this._getLurePos(this.fish);
        const now  = performance.now();
        const SURVIVE_COOLDOWN = 500; // ms before same fish can be hit again

        // School fish (FishLayer)
        const fishLayer = this.manager && this.manager.getLayer('fish');
        if (fishLayer && fishLayer.sharks) {
            for (const shark of fishLayer.sharks) {
                if (shark.isDying) continue;
                const dx = lure.x - shark.x;
                const dy = lure.y - (shark.baseY || shark.y || 0);
                const threshold = lure.r + shark.size * 0.5;
                if (dx * dx + dy * dy < threshold * threshold) {
                    // Skip if still in survival cooldown
                    if (shark._dasCooldownUntil && now < shark._dasCooldownUntil) continue;
                    if (Math.random() < 0.7) {
                        shark._dasCooldownUntil = now + SURVIVE_COOLDOWN;
                    } else {
                        shark.isDying = true;
                    }
                }
            }
        }

        // CuriousFish
        const curiousLayer = this.manager && this.manager.getLayer('curiousFish');
        if (curiousLayer && curiousLayer.fish && !curiousLayer.fish.isDying) {
            const cf = curiousLayer.fish;
            const cfSize = cf.currentSize || curiousLayer.config?.size || 20;
            const dx = lure.x - cf.x;
            const dy = lure.y - cf.y;
            const threshold = lure.r + cfSize * 0.5;
            if (dx * dx + dy * dy < threshold * threshold) {
                if (cf._dasCooldownUntil && now < cf._dasCooldownUntil) {
                    // still in cooldown — skip
                } else if (Math.random() < 0.7) {
                    cf._dasCooldownUntil = now + SURVIVE_COOLDOWN;
                } else {
                    cf.isDying = true;
                }
            }
        }
    }

    // ─── Glitch ──────────────────────────────────────────────────────────────

    _updateGlitch(dt) {
        const g = this._glitch;
        if (g.effect) {
            g.timer -= dt;
            if (g.effect === 'freeze') g.data.elapsed = (g.data.elapsed || 0) + dt;
            if (g.timer <= 0) {
                g.effect   = null;
                g.speedMul = 1;
                g.data     = {};
                g.cooldown = 1000 + Math.random() * 2000;
            }
        } else {
            g.cooldown -= dt;
            if (g.cooldown <= 0) this._triggerGlitch();
        }
    }

    _triggerGlitch() {
        const g = this._glitch;
        const effects = ['freeze', 'freeze', 'freeze', 'tear', 'tear', 'tearV', 'tearV', 'ghost', 'ghost2'];
        g.effect = effects[Math.floor(Math.random() * effects.length)];
        g.data   = {};
        switch (g.effect) {
            case 'freeze': g.timer = 700 + Math.random() * 500;  g.speedMul = 0.05; g.data.total = g.timer; break;
            case 'tear':   g.timer = 100 + Math.random() * 250;  g.speedMul = 1;    break;
            case 'tearV':  g.timer = 100 + Math.random() * 250;  g.speedMul = 1;    break;
            case 'ghost':  g.timer = 150 + Math.random() * 280;  g.speedMul = 0.4;  break;
            case 'ghost2': g.timer = 150 + Math.random() * 280;  g.speedMul = 0.4;  break;
        }
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    render(ctx, currentTime, deltaTime, width, height) {
        if (!this.enabled) return;

        this.width  = width;
        this.height = height;

        // Spawn on first render — guaranteed real dimensions here
        if (!this.fish && width > 0 && height > 0) this._spawn();
        if (!this.fish) return;

        this._update(deltaTime);
        this._checkKills();

        const f = this.fish;
        if (!this._imageLoaded) {
            // Placeholder while image loads
            ctx.save();
            ctx.fillStyle = 'rgba(200,80,0,0.6)';
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        const g = this._glitch;
        const depthTier = height > 0 ? Math.min(3, Math.max(0, Math.floor((f.y / height) * 4))) : 3;
        const drawSrc = (this._depthCache && this._depthCache[depthTier]) || this._image;
        const imgW = f.size * 2;
        const imgH = imgW * (this._image.height / this._image.width);
        ctx.save();
        ctx.translate(f.x, f.y);
        if (f.vx < 0) ctx.scale(-1, 1);

        switch (g.effect) {
            case 'freeze': {
                // Colour fade: 400ms fade-out, hold, 400ms fade-in
                const FADE = 400;
                const elapsed = g.data.elapsed || 0;
                const total   = g.data.total   || 700;
                let sat;
                if (elapsed < FADE) {
                    sat = 100 - (elapsed / FADE) * 100;
                } else if (elapsed > total - FADE) {
                    sat = ((elapsed - (total - FADE)) / FADE) * 100;
                } else {
                    sat = 0;
                }
                ctx.filter = `saturate(${sat.toFixed(1)}%)`;
                ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
                ctx.filter = 'none';
                break;
            }
            case 'ghost':
                ctx.globalAlpha = 0.35;
                ctx.filter = 'hue-rotate(120deg) saturate(300%)';
                ctx.drawImage(drawSrc, -imgW / 2 + 9, -imgH / 2 - 5, imgW, imgH);
                ctx.filter = 'none';
                ctx.globalAlpha = 1;
                ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
                break;

            case 'ghost2':
                ctx.globalAlpha = 0.35;
                ctx.filter = 'hue-rotate(255deg) saturate(300%)';
                ctx.drawImage(drawSrc, -imgW / 2 - 7, -imgH / 2 + 8, imgW, imgH);
                ctx.filter = 'none';
                ctx.globalAlpha = 1;
                ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
                break;

            case 'tear': {
                const sliceH = imgH / 3;
                for (let i = 0; i < 3; i++) {
                    const ox = (i % 2 === 0 ? 1 : -1) * (3 + Math.floor(Math.random() * 10));
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(-imgW / 2 + ox - 1, -imgH / 2 + i * sliceH, imgW + 2, sliceH);
                    ctx.clip();
                    ctx.drawImage(drawSrc, -imgW / 2 + ox, -imgH / 2, imgW, imgH);
                    ctx.restore();
                }
                break;
            }

            case 'tearV': {
                const sliceW = imgW / 5;
                for (let i = 0; i < 5; i++) {
                    const oy = (i % 2 === 0 ? 1 : -1) * (3 + Math.floor(Math.random() * 10));
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(-imgW / 2 + i * sliceW, -imgH / 2 + oy - 1, sliceW, imgH + 2);
                    ctx.clip();
                    ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2 + oy, imgW, imgH);
                    ctx.restore();
                }
                break;
            }

            default:
                ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
        }

        // WordPress "loading…" spinner during freeze
        if (g.effect === 'freeze') {
            ctx.save();
            ctx.translate(0, imgH * 0.05);
            const angle = (currentTime % 1200) / 1200 * Math.PI * 2;
            for (let d = 0; d < 8; d++) {
                const a = angle + (d / 8) * Math.PI * 2;
                ctx.globalAlpha = 0.2 + (d / 8) * 0.75;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 9, Math.sin(a) * 9, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.restore();

        // ── Kill zone visualisation (debug only) ─────────────────────────────
        if (this.showDebug) {
            const lure = this._getLurePos(f);
            ctx.save();
            ctx.strokeStyle = 'rgba(255,0,0,0.85)';
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.arc(lure.x, lure.y, lure.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,0,0,0.25)';
            ctx.fill();
            ctx.restore();
        }
    }

    // ─── Depth cache (same pattern as FishLayer) ─────────────────────────────

    _buildDepthCache(sourceImage) {
        const TIERS = [
            { sat: 30, bri: 100 },
            { sat: 55, bri: 100 },
            { sat: 78, bri: 100 },
            null,                   // tier 3: original
        ];
        const w = sourceImage.naturalWidth  || sourceImage.width;
        const h = sourceImage.naturalHeight || sourceImage.height;
        if (!w || !h) return TIERS.map(() => sourceImage);

        return TIERS.map(tier => {
            if (!tier) return sourceImage;
            const oc = new OffscreenCanvas(w, h);
            const octx = oc.getContext('2d');
            octx.filter = `saturate(${tier.sat}%) brightness(${tier.bri}%)`;
            octx.drawImage(sourceImage, 0, 0);
            return oc;
        });
    }
}
