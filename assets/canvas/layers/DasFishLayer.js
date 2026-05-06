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
        lureRadius: 20,     // kill radius around the lure orb
    };

    constructor(options = {}) {
        this.enabled = true;
        this.manager = null;

        this.config = { ...DasFishLayer.DEFAULT_CONFIG, ...options };

        this.fish = null;       // single entity object
        this._image = new Image();
        this._imageLoaded = false;
        this._depthCache = null;

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
        // Swim horizontally; direction: left or right
        const goRight = Math.random() < 0.5;
        this.fish = {
            x:      goRight ? -this.config.size : this.width + this.config.size,
            y:      this.height * (0.25 + Math.random() * 0.5),
            vx:     (goRight ? 1 : -1) * this.config.speed,
            size:   this.config.size,
            age:    0,
        };
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    _update(deltaTime) {
        const f = this.fish;
        const dt = typeof deltaTime === 'number' ? deltaTime : 16;
        const spd = this.config.speed * (dt / 16);

        f.age += dt;

        // Horizontal movement
        f.x += f.vx > 0 ? spd : -spd;

        // Gentle vertical sine drift — very slow, small amplitude
        f.y += Math.sin(f.age * 0.0004) * 0.18 * (dt / 16);

        // Clamp vertically so it doesn't drift offscreen
        const margin = f.size;
        f.y = Math.max(margin, Math.min(this.height - margin, f.y));

        // Respawn from the other side when fully off-screen
        if (f.vx > 0 && f.x > this.width + f.size * 2) {
            f.x = -f.size;
            f.y = this.height * (0.25 + Math.random() * 0.5);
        } else if (f.vx < 0 && f.x < -f.size * 2) {
            f.x = this.width + f.size;
            f.y = this.height * (0.25 + Math.random() * 0.5);
        }
    }

    // ─── Lure world position ─────────────────────────────────────────────────

    // The lure hangs in front of the fish and slightly above.
    // Forward offset along travel direction + fixed world-up offset.
    _getLurePos(f) {
        const dir = f.vx >= 0 ? 1 : -1;
        return {
            x: f.x + dir * f.size * 0.88,
            y: f.y - f.size * 0.28,
            r: this.config.lureRadius,
        };
    }

    // ─── Kill checks ─────────────────────────────────────────────────────────

    _checkKills() {
        const lure = this._getLurePos(this.fish);

        // School fish (FishLayer)
        const fishLayer = this.manager && this.manager.getLayer('fish');
        if (fishLayer && fishLayer.sharks) {
            for (const shark of fishLayer.sharks) {
                if (shark.isDying) continue;
                const dx = lure.x - shark.x;
                const dy = lure.y - (shark.baseY || shark.y || 0);
                const threshold = lure.r + shark.size * 0.5;
                if (dx * dx + dy * dy < threshold * threshold) {
                    shark.isDying = true;
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
                cf.isDying = true;
            }
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

        ctx.save();
        ctx.translate(f.x, f.y);
        // Flip if swimming left
        if (f.vx < 0) ctx.scale(-1, 1);

        const depthTier = height > 0 ? Math.min(3, Math.max(0, Math.floor((f.y / height) * 4))) : 3;
        const drawSrc = (this._depthCache && this._depthCache[depthTier]) || this._image;

        const imgW = f.size * 2;
        const imgH = imgW * (this._image.height / this._image.width);
        ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
        ctx.restore();
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
