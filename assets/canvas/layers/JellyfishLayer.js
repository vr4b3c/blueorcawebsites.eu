/**
 * JellyfishLayer - Jellyfish school rendering
 *
 * Spawns small schools of 1-4 jellyfish below the bottom edge.
 * They drift diagonally (left→right, strong upward), ~75 % of the
 * velocity vector is vertical — they rise noticeably faster than they
 * move sideways. Allowed to escape through the top edge.
 * Movement: diagonal glide + jerky vertical pulsing bell.
 */

import { SURFACE_Y } from '../../webgl/WaterSurfaceLayer.js';

export class JellyfishLayer {
    // Hard cap — 1 individual per school, sparse
    static MAX_JELLYFISH = 12;

    static DEFAULT_CONFIG = {
        schoolCount: null,      // null = auto-scale by viewport width
        schoolDensity: 600,     // px of width per jellyfish
        minSchools: 1,
        maxSchools: 10,
        sizeMin: 15,            // base radius px
        sizeMax: 30,
        speedMin: 0.09,         // px/frame horizontal
        speedMax: 0.20,
        riseMin: 0.156,         // px/frame upward — tan(60°) × speedMin = 60° angle
        riseMax: 0.346,         // px/frame upward — tan(60°) × speedMax
        pulsePerMin: 0.0018,    // rad/ms  → ~3.5 s period  (slower, lazier pulse)
        pulsePerMax: 0.0032,    // rad/ms  → ~2 s period
        pulseAmpMin: 12,        // px vertical travel per pulse
        pulseAmpMax: 28,
        allowHighCostEffects: true,
    };

    constructor(options = {}) {
        this.enabled = true;
        this.jellyfish = [];
        this.particles = [];   // bioluminescent tentacle sparks
        this._schoolsSpawned = 0;
        this.manager = null;
        this._qualityMultiplier = 1.0;
        this.imageAspectRatio = 1.4;
        this._tintedVariants = null;

        this.config = { ...JellyfishLayer.DEFAULT_CONFIG, ...options };

        this.image = new Image();
        this.imageLoaded = false;
        this.tintedImage = null; // OffscreenCanvas with cyan tint pre-baked
        this.image.onload = () => {
            this.imageLoaded = true;
            this.imageAspectRatio = (this.image.naturalHeight / this.image.naturalWidth) || 1.4;
            this._buildTintedImage();
        };
        this.image.onerror = () => { console.warn('JellyfishLayer: failed to load medusa.webp'); };
        this.image.src = 'assets/images/fish/medusa.webp';
    }

    init(width, height, manager) {
        this.width = width;
        this.height = height;
        this.manager = manager;
        this._recalcSchoolCount(width, height);
    }

    destroy() {
        this.jellyfish = [];
        this.particles = [];
        this._schoolsSpawned = 0;
        this._tintedVariants = null;
    }

    setQuality(quality) {
        this._qualityMultiplier = quality;
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
        this._recalcSchoolCount(width, height);
    }

    _recalcSchoolCount(width, height) {
        if (this.config.schoolCount !== null) return;
        const density = this.config.schoolDensity;
        this._autoSchoolCount = Math.max(
            this.config.minSchools,
            Math.min(this.config.maxSchools, Math.round(width / density))
        );
    }

    render(ctx, currentTime, deltaTime, width, height) {
        if (!this.enabled) return;

        const effectiveSchoolCount = this.config.schoolCount !== null
            ? this.config.schoolCount
            : (this._autoSchoolCount || 2);

        // Spawn schools until quota is met
        while (this._schoolsSpawned < effectiveSchoolCount) {
            this._spawnSchool(width, height, this._schoolsSpawned);
            this._schoolsSpawned++;
        }

        // Hard-cap guard
        if (this.jellyfish.length > JellyfishLayer.MAX_JELLYFISH) {
            this.jellyfish.length = JellyfishLayer.MAX_JELLYFISH;
        }

        let writeIndex = 0;
        for (let i = 0; i < this.jellyfish.length; i++) {
            const jf = this.jellyfish[i];

            // Advance time — drift right + rise strongly upward (~75 % vector)
            // Normalize by deltaTime/16 so speed stays consistent at any frame rate
            jf.age   += deltaTime;
            jf.x     += jf.speed     * (deltaTime / 16);
            jf.baseY -= jf.riseSpeed * (deltaTime / 16);

            // ----- Jellyfish pulse vertical offset -----
            // Pure sine — no secondary easing avoids compound jerk artifacts.
            const phase   = jf.age * jf.pulseFreq;
            const raw     = (Math.sin(phase - Math.PI * 0.5) + 1) * 0.5; // 0..1 smooth
            const yOffset = -raw * jf.pulseAmplitude;

            const currentY = jf.baseY + yOffset;

            // Surface bounce: reflect off the waterline instead of escaping through the top
            const ceiling = SURFACE_Y + jf.size * 2;
            if (jf.baseY <= ceiling) {
                jf.baseY = ceiling;
                if (jf.riseSpeed > 0) jf.riseSpeed = -jf.origRiseSpeed * 0.7; // flip to sinking
            }
            // Once sunk deep enough, restore natural rise so the cycle repeats
            if (jf.riseSpeed < 0 && jf.baseY >= height * 0.5) {
                jf.riseSpeed = jf.origRiseSpeed;
            }

            // Exited right side → respawn below bottom edge
            if (jf.x > width + jf.size * 2.5) {
                this._resetBelowBottom(jf, width, height);
            }

            // Spawn bioluminescent tentacle particles (capped for performance)
            if (this.particles.length < 50 && Math.random() < 0.002 * deltaTime) {
                const aspect = this.imageLoaded ? (this.image.height / this.image.width || 1.4) : 1.4;
                this.particles.push({
                    x:        jf.x + (Math.random() - 0.5) * jf.size * 1.1,
                    y:        currentY + jf.size * (0.6 + Math.random() * 0.9 * aspect),
                    vx:       (Math.random() - 0.5) * 0.012,
                    vy:       -(0.018 + Math.random() * 0.025),
                    age:      0,
                    maxAge:   700 + Math.random() * 900,
                    size:     0.7 + Math.random() * 1.6,
                    baseAlpha: 0.35 + Math.random() * 0.45,
                });
            }

            this._draw(ctx, jf, currentY);

            this.jellyfish[writeIndex++] = jf;
        }
        this.jellyfish.length = writeIndex;

        // ── Tentacle particle system ──────────────────────────────────────────
        if (this.particles.length > 0) {
            ctx.save();
            let pw = 0;
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                p.age += deltaTime;
                if (p.age >= p.maxAge) continue;

                p.x += p.vx * (deltaTime / 16);
                p.y += p.vy * (deltaTime / 16);

                const t = p.age / p.maxAge;
                const fadeAlpha = t < 0.12 ? t / 0.12 : 1.0 - (t - 0.12) / 0.88;

                ctx.globalAlpha = p.baseAlpha * fadeAlpha;
                ctx.fillStyle   = 'rgba(180, 240, 255, 1.0)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();

                this.particles[pw++] = p;
            }
            this.particles.length = pw;
            ctx.globalAlpha = 1.0;
            ctx.restore();
        }
    }

    // -----------------------------------------------------------------
    // Pre-bake the static colour transforms (sepia + saturate + hue-rotate) into an
    // OffscreenCanvas so that per-frame we only need a cheap single brightness() filter.
    _buildTintedImage() {
        if (!this.config.allowHighCostEffects) return;

        const oc   = new OffscreenCanvas(this.image.naturalWidth, this.image.naturalHeight);
        const octx = oc.getContext('2d');
        if (!octx) return;
        octx.filter = 'sepia(1) saturate(3) hue-rotate(170deg)';
        octx.drawImage(this.image, 0, 0);
        this.tintedImage = oc;

        const brightnessSteps = [1.10, 1.18, 1.26, 1.35];
        this._tintedVariants = brightnessSteps.map((brightness) => {
            const variant = new OffscreenCanvas(this.image.naturalWidth, this.image.naturalHeight);
            const variantCtx = variant.getContext('2d');
            if (!variantCtx) return oc;
            variantCtx.filter = `brightness(${brightness})`;
            variantCtx.drawImage(oc, 0, 0);
            return variant;
        });
    }

    // -----------------------------------------------------------------
    _draw(ctx, jf, y) {
        const phase    = jf.age * jf.pulseFreq;
        // sineVal 0..1 — position in stroke (0 = extended/bottom, 1 = contracted/top)
        const sineVal  = (Math.sin(phase - Math.PI * 0.5) + 1) * 0.5;
        // velVal 0..1 — peaks at max contraction speed (cos of same phase)
        const velVal   = Math.max(0, Math.sin(phase));  // == d/dt(sineVal), peaks at mid-stroke

        const aspect = this.imageAspectRatio;
        const w = jf.size * 2;
        const h = w * aspect;
        const useHighCostEffects = this.config.allowHighCostEffects && this._qualityMultiplier >= 0.6;

        // Subtle bell deformation — reduced from 0.22/0.48
        const scaleX = 1 - velVal * 0.09;
        const scaleY = 1 + velVal * 0.18;
        ctx.setTransform(scaleX, 0, 0, scaleY, jf.x, y);
        ctx.globalAlpha = jf.alpha * (0.85 + sineVal * 0.15);

        if (this.tintedImage) {
            const drawSource = useHighCostEffects && this._tintedVariants?.length
                ? this._tintedVariants[Math.min(this._tintedVariants.length - 1, Math.floor(sineVal * this._tintedVariants.length))]
                : this.tintedImage;
            ctx.drawImage(drawSource, -w / 2, -h / 2, w, h);
        } else if (this.imageLoaded) {
            if (useHighCostEffects) {
                ctx.filter = `sepia(1) saturate(3) hue-rotate(170deg) brightness(${1.1 + sineVal * 0.25})`;
            }
            ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
            if (useHighCostEffects) {
                ctx.filter = 'none';
            }
        } else {
            ctx.fillStyle = `rgba(100, 215, 255, ${0.5 + sineVal * 0.2})`;
            ctx.beginPath();
            ctx.arc(0, 0, jf.size, 0, Math.PI * 2);
            ctx.fill();
        }

        if (useHighCostEffects && !this.tintedImage) {
            ctx.filter = 'none';
        }
        ctx.globalAlpha = 1.0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // -----------------------------------------------------------------
    _spawnSchool(width, height, schoolIndex) {
        const cfg = this.config;
        const schoolSize = 1; // always solo

        const baseSize  = cfg.sizeMin + Math.random() * (cfg.sizeMax  - cfg.sizeMin);
        const speed     = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
        const riseSpeed = cfg.riseMin  + Math.random() * (cfg.riseMax  - cfg.riseMin);
        const pulseFreq = cfg.pulsePerMin + Math.random() * (cfg.pulsePerMax - cfg.pulsePerMin);
        const pulseAmp  = cfg.pulseAmpMin + Math.random() * (cfg.pulseAmpMax - cfg.pulseAmpMin);

        // Spawn across the full bottom edge, evenly distributed with a little jitter
        const startXBase = (schoolIndex / Math.max(1, this._autoSchoolCount - 1 || 0.5)) * width
            * (0.85 + Math.random() * 0.15)  // slight jitter so they're not perfectly gridded
            + (Math.random() - 0.5) * width * 0.12;
        const schoolY    = height + baseSize + Math.random() * (height * 0.15);

        for (let i = 0; i < schoolSize; i++) {
            // Loose echelon cluster — offset each individual diagonally back-left
            const offsetX = -(i * (baseSize * 1.8 + Math.random() * 20));
            const offsetY =  Math.random() * baseSize * 1.5; // always below, not above
            const indivSize = baseSize * (0.75 + Math.random() * 0.5);

            // Phase offset so jellyfish in the same school pulse out of sync
            const phaseAge = (Math.random() * Math.PI * 2) / pulseFreq;

            this.jellyfish.push({
                x:              startXBase + (Math.random() - 0.5) * baseSize * 2,
                baseY:          schoolY + offsetY,
                size:           indivSize,
                speed:          speed * (0.88 + Math.random() * 0.24),
                riseSpeed:      riseSpeed * (0.88 + Math.random() * 0.24),
                origRiseSpeed:  riseSpeed * (0.88 + Math.random() * 0.24),
                pulseFreq:      pulseFreq * (0.9 + Math.random() * 0.2),
                pulseAmplitude: pulseAmp * (0.8 + Math.random() * 0.4),
                age:            phaseAge,
                alpha:          0.55 + Math.random() * 0.30,
            });
        }
    }

    // Respawn a jellyfish below the bottom edge (random X) after completing its journey.
    _resetBelowBottom(jf, width, height) {
        jf.x     = Math.random() * width;
        jf.baseY = height + jf.size + Math.random() * (height * 0.15);
    }
}
