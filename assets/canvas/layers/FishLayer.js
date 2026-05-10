/**
 * FishLayer - School fish implementation
 * Renders schools of fish swimming across the screen
 */
import { drawGlow } from '../utils/GlowCache.js';
import { subscribePointerMove } from '../utils/PointerTracker.js';

export class FishLayer {
    static MAX_FISH = 80;                // Hard cap on total fish in the array
    static MAX_PASSIVE_LIFESPAN = 300_000; // ms — passive/independent fish live max 5 min
    static MAX_BLOOD_PARTICLES = 160;
    static MAX_BLOOD_PARTICLES_PER_BURST = 36;
    static MIN_BLOOD_PARTICLES_PER_BURST = 12;

    // Single source of truth for fish layer configuration
    static DEFAULT_CONFIG = {
        schoolCount: null,     // null = auto-scale by viewport (1 school per 600 000 px²)
        schoolDensity: 600000, // px² per school when schoolCount is null
        maxSchoolSize: 10,     // hard cap on fish per school
        size: 1.2,              // Size multiplier (0.5-2x)
        avoidRadius: 100,       // Radius to avoid mouse cursor
        verticalMarginTop: 100, // Minimum distance from top edge (px)
        verticalMarginBottom: 100, // Minimum distance from bottom edge (px)
        showDebug: false        // Debug visualization
    };

    constructor(options = {}) {
        this.enabled = true;
        this.sharks = [];
        this.bloodParticles = [];
        this._sharkPool = [];       // Reusable fish objects — avoids GC churn on school spawn/death
        this._bloodPool = [];       // Reusable blood particle objects
        this._schoolCentroidsCache = new Map();
        this._foodLookup = {
            activeFoods: [],
            rows: new Map(),
            grid: null,
            cellSize: 0,
            usedBuckets: []
        };
        this._schoolMembershipDirty = true;
        this.mouseX = null;
        this.mouseY = null;
        this.manager = null; // Reference to manager for food particles
        
        // Load all fish images
        this.fishImages = [];
        const imagePaths = [
            'assets/images/fish/shark.webp',
            'assets/images/fish/fish2.webp', 
            'assets/images/fish/fish1.webp',
            'assets/images/fish/curiousfish.webp'
        ];
        this.imagesLoaded = 0;
        this.imagesFailed = 0; // Track failed images
        this._imageDepthCache = []; // Per-image depth-tinted OffscreenCanvas arrays
        
        imagePaths.forEach((path, index) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.imagesLoaded++;
                // Build depth-tinted cache for this image
                this._imageDepthCache[index] = this._buildDepthCache(img);
                if (this.imagesLoaded === imagePaths.length) {
                    console.log('All fish images loaded');
                }
            };
            img.onerror = () => {
                console.error(`Failed to load fish image: ${path}`);
                this.imagesFailed++;
                img._failed = true;
            };
            this.fishImages.push(img);
        });

        // Bone image for dead fish fallback (used when fish die)
        this.boneImage = new Image();
        this.boneLoaded = false;
        this.boneImage.onload = () => { this.boneLoaded = true; };
        this.boneImage.onerror = () => { console.warn('Failed to load fishbone image'); };
        this.boneImage.src = 'assets/images/fish/fishbone.webp';
        
        // Defensive copy of config to prevent external modifications
        this.config = {
            ...FishLayer.DEFAULT_CONFIG,
            ...options
        };
        
        this._schoolsSpawned = 0;
        this._unsubscribePointerMove = null;
        this.handlePointerMove = this.handlePointerMove.bind(this);
    }
    
    handlePointerMove(x, y) {
        this.mouseX = x;
        this.mouseY = y;
    }
    
    init(width, height, canvasManager) {
        this.width = width;
        this.height = height;
        this.sharks = [];
        this._schoolsSpawned = 0;
        this._nextSchoolId = 0;   // monotonic — never resets to avoid schoolId collisions on quality change
        this._qualityMultiplier = 1.0;
        this._schoolCentroidsCache.clear();
        this._schoolMembershipDirty = true;
        this._recalcSchoolCount(width, height);
        
        // Store reference to manager for food access
        this.manager = canvasManager || window.blueOrcaCanvas;
        
        this._unsubscribePointerMove = subscribePointerMove(this.handlePointerMove);
        console.log('SharkLayer initialized');
    }

    /**
     * Apply a quality multiplier \u2014 called by CanvasManager.applyQualityToLayers.
     * Below 0.6 the effective school count is halved to reduce CPU load.
     * @param {number} quality - 0.3\u20131.0
     */
    setQuality(quality) {
        this._qualityMultiplier = quality;
    }
    
    /**
     * Cleanup resources and event listeners
     */
    destroy() {
        this._unsubscribePointerMove?.();
        this._unsubscribePointerMove = null;
        this.sharks = [];
        this._schoolsSpawned = 0;
        this._schoolCentroidsCache.clear();
        this._schoolMembershipDirty = true;
        console.log('FishLayer destroyed');
    }
    
    onResize(width, height) {
        this.width = width;
        this.height = height;
        this._recalcSchoolCount(width, height);
    }

    /** Compute auto school count from viewport area unless manually overridden */
    _recalcSchoolCount(width, height) {
        if (this.config.schoolCount !== null) return; // manual override
        const area = width * height;
        const density = this.config.schoolDensity || 600000;
        const count = Math.max(1, Math.min(8, Math.round(area / density)));
        this._autoSchoolCount = count;
    }

    _ensureSchoolMembershipCache() {
        if (!this._schoolMembershipDirty) return;

        for (const [, centroid] of this._schoolCentroidsCache) {
            centroid.members.length = 0;
        }

        for (const shark of this.sharks) {
            if (shark.isDying || typeof shark.schoolId === 'undefined') continue;

            let centroid = this._schoolCentroidsCache.get(shark.schoolId);
            if (!centroid) {
                centroid = {
                    x: 0,
                    y: 0,
                    speed: 0,
                    count: 0,
                    members: [],
                };
                this._schoolCentroidsCache.set(shark.schoolId, centroid);
            }

            centroid.members.push(shark);
        }

        for (const [schoolId, centroid] of this._schoolCentroidsCache) {
            if (centroid.members.length === 0) {
                this._schoolCentroidsCache.delete(schoolId);
            }
        }

        this._schoolMembershipDirty = false;
    }

    _updateSchoolCentroids(width) {
        this._ensureSchoolMembershipCache();

        for (const [schoolId, centroid] of this._schoolCentroidsCache) {
            let count = 0;
            let sumX = 0;
            let sumY = 0;
            let sumSpeed = 0;
            let writeIndex = 0;
            let referenceX = 0;

            for (let i = 0; i < centroid.members.length; i++) {
                const fish = centroid.members[i];
                if (!fish || fish.isDying || fish.schoolId !== schoolId) {
                    this._schoolMembershipDirty = true;
                    continue;
                }

                centroid.members[writeIndex++] = fish;

                let fx = fish.x;
                if (count === 0) {
                    referenceX = fx;
                } else if (Math.abs(fx - referenceX) > width * 0.5) {
                    fx += fx < referenceX ? width : -width;
                }

                sumX += fx;
                sumY += fish.baseY;
                sumSpeed += fish.speed;
                count++;
            }

            centroid.members.length = writeIndex;

            if (count === 0) {
                this._schoolCentroidsCache.delete(schoolId);
                continue;
            }

            centroid.count = count;
            centroid.x = ((sumX / count) % width + width) % width;
            centroid.y = sumY / count;
            centroid.speed = sumSpeed / count;
        }

        return this._schoolCentroidsCache;
    }

    _buildFoodLookup(foodParticles) {
        const lookup = this._foodLookup;
        const activeFoods = lookup.activeFoods;
        activeFoods.length = 0;

        const usedBuckets = lookup.usedBuckets;
        for (let i = 0; i < usedBuckets.length; i++) {
            usedBuckets[i].length = 0;
        }
        usedBuckets.length = 0;

        for (let i = 0; i < foodParticles.length; i++) {
            const food = foodParticles[i];
            if (!food.eaten) activeFoods.push(food);
        }

        if (activeFoods.length <= 12) {
            lookup.grid = null;
            lookup.cellSize = 0;
            return lookup;
        }

        const cellSize = 160;
        const rows = lookup.rows;

        for (let i = 0; i < activeFoods.length; i++) {
            const food = activeFoods[i];
            const cellX = Math.floor(food.x / cellSize);
            const cellY = Math.floor(food.y / cellSize);
            let row = rows.get(cellY);
            if (!row) {
                row = new Map();
                rows.set(cellY, row);
            }

            let bucket = row.get(cellX);
            if (!bucket) {
                bucket = [];
                row.set(cellX, bucket);
            }

            if (bucket.length === 0) {
                usedBuckets.push(bucket);
            }

            bucket.push(food);
        }

        lookup.grid = rows;
        lookup.cellSize = cellSize;
        return lookup;
    }

    _findNearestFood(foodLookup, x, y, direction, detectR) {
        let nearestFood = null;
        let nearestDistSq = detectR * detectR;

        const testFood = (food) => {
            const fdx = food.x - x;
            const fdy = food.y - y;
            const fdistSq = fdx * fdx + fdy * fdy;
            const isAhead = (direction > 0 && fdx > -40) || (direction < 0 && fdx < 40);

            if (isAhead && fdistSq < nearestDistSq) {
                nearestDistSq = fdistSq;
                nearestFood = food;
            }
        };

        if (!foodLookup.grid) {
            for (let i = 0; i < foodLookup.activeFoods.length; i++) {
                testFood(foodLookup.activeFoods[i]);
            }

            return { nearestFood, nearestDistSq };
        }

        const cellRadius = Math.ceil(detectR / foodLookup.cellSize);
        const centerCellX = Math.floor(x / foodLookup.cellSize);
        const centerCellY = Math.floor(y / foodLookup.cellSize);

        for (let cellY = centerCellY - cellRadius; cellY <= centerCellY + cellRadius; cellY++) {
            const row = foodLookup.grid.get(cellY);
            if (!row) continue;

            for (let cellX = centerCellX - cellRadius; cellX <= centerCellX + cellRadius; cellX++) {
                const bucket = row.get(cellX);
                if (!bucket) continue;

                for (let i = 0; i < bucket.length; i++) {
                    testFood(bucket[i]);
                }
            }
        }

        return { nearestFood, nearestDistSq };
    }
    
    render(ctx, currentTime, deltaTime, width, height) {
        if (!this.enabled) return;
        
        if (!this._frameCounter) this._frameCounter = 0;
        this._frameCounter++;

        // Resolve effective school count (manual config or auto-scaled)
        let effectiveSchoolCount = this.config.schoolCount !== null
            ? this.config.schoolCount
            : (this._autoSchoolCount || this._recalcSchoolCount(width, height) || this._autoSchoolCount);

        // Proportional school scaling — quality 1.0 → full schools, quality 0.3 → 30% of schools.
        // Replaces the old binary cliff at 0.6 that caused quality to oscillate between
        // full schools and half schools, producing visible flickering on borderline hardware.
        effectiveSchoolCount = Math.max(1, Math.round(effectiveSchoolCount * (this._qualityMultiplier || 1.0)));
        
        // Spawn schools until we have the configured number of schools
        while (this._schoolsSpawned < effectiveSchoolCount) {
            this.spawnSchool(width, height, effectiveSchoolCount);
            this._schoolsSpawned++;
            this._nextSchoolId++;  // always increases so new schools never reuse a living school's ID
        }
        
        // School count decreased — don't nuke the array, just accept fewer schools.
        // Existing fish finish their natural lifecycle (bone animation etc.)
        if (this._schoolsSpawned > effectiveSchoolCount) {
            this._schoolsSpawned = effectiveSchoolCount;
        }

        // Cull oldest passive/independent fish when total count exceeds hard cap
        if (this.sharks.length > FishLayer.MAX_FISH) {
            let culled = 0;
            for (let i = 0; i < this.sharks.length && this.sharks.length - culled > FishLayer.MAX_FISH; i++) {
                const s = this.sharks[i];
                if (s.passive && s.isIndependent && !s.isDying &&
                        (!s.bornAt || currentTime - s.bornAt > 10_000)) {
                    s.isDying = true;
                    culled++;
                }
            }
        }

        const curiousFishLayer = this.manager && this.manager.getLayer
            ? this.manager.getLayer('curiousFish')
            : null;
        const curiousFish = curiousFishLayer && curiousFishLayer.enabled ? curiousFishLayer.fish : null;
        const curiousFishSize = curiousFish
            ? (curiousFish.currentSize || curiousFishLayer.config.size)
            : 0;
        const canAvoidCuriousFish = !!(curiousFish && !curiousFishLayer.isAttackingSchoolFish);
        const targetedFish = curiousFishLayer && curiousFishLayer.targetSchoolFish;
        const dasLayer = this.manager && this.manager.getLayer
            ? this.manager.getLayer('das')
            : null;
        const dasLure = dasLayer && dasLayer.fish ? dasLayer._getLurePos(dasLayer.fish) : null;
        const showCuriousFishDebug = !!(this.config.showDebug && curiousFish);
        const foodParticles = this.manager?.foodLayer?.getParticles?.() || [];
        // Rebuild spatial grid every other frame — halves the O(n) Map construction cost.
        // Fish detect food at 120+px radius; positions stale by one frame (~2px drift) are
        // imperceptible. Force a rebuild when activeFoods was empty (first spawn).
        let foodLookup = null;
        if (foodParticles.length > 0) {
            this._foodSkipFrame = !this._foodSkipFrame;
            if (!this._foodSkipFrame || this._foodLookup.activeFoods.length === 0) {
                this._buildFoodLookup(foodParticles);
            }
            foodLookup = this._foodLookup;
        }
        const hasFoodParticles = !!(foodLookup && foodLookup.activeFoods.length > 0);

        const schoolCentroids = this._updateSchoolCentroids(width);
        
        // Debug visualization - draw vertical margin boundaries
        if (this.config.showDebug) {
            ctx.strokeStyle = 'rgba(255, 100, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            
            // Top boundary
            ctx.beginPath();
            ctx.moveTo(0, this.config.verticalMarginTop);
            ctx.lineTo(width, this.config.verticalMarginTop);
            ctx.stroke();
            
            // Bottom boundary
            ctx.beginPath();
            ctx.moveTo(0, height - this.config.verticalMarginBottom);
            ctx.lineTo(width, height - this.config.verticalMarginBottom);
            ctx.stroke();
            
            ctx.setLineDash([]); // Reset dash
        }
        
        // Use swap-and-pop for efficient removal (O(1) instead of O(n))
        let writeIndex = 0;
        for (let readIndex = 0; readIndex < this.sharks.length; readIndex++) {
            const shark = this.sharks[readIndex];
            
            // Handle dying fish - transform to bone and let bone fall slowly (linear, no rotation)
            if (shark.isDying) {
                // Initialize bone position and start time
                if (shark.boneY === undefined) {
                    // Actual Y at moment of death (match drawn position)
                    const swOff  = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
                    const vPhase = (shark.age / shark.verticalPeriod) % 1;
                    const vOff   = Math.sin(vPhase * Math.PI * 2) * shark.verticalAmplitude;
                    shark.boneX  = shark.x;
                    shark.boneY  = shark.baseY + swOff + vOff;
                    // Inherit velocity at death (speed is px/frame → /16 = px/ms)
                    shark.boneVX = shark.direction * shark.speed / 16;
                    shark.boneVY = shark.schoolWaveAmplitude * shark.schoolWaveSpeed
                                   * Math.cos(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase)
                                 + shark.verticalAmplitude * (2 * Math.PI / shark.verticalPeriod)
                                   * Math.cos(vPhase * Math.PI * 2);
                    // Cap velocity so bones don't rocket off screen
                    const MAX_BONE_V = 0.18; // px/ms
                    const boneSpd = Math.sqrt(shark.boneVX ** 2 + shark.boneVY ** 2);
                    if (boneSpd > MAX_BONE_V) {
                        const scale = MAX_BONE_V / boneSpd;
                        shark.boneVX *= scale;
                        shark.boneVY *= scale;
                    }
                    shark.boneStartTime = currentTime;
                    this._spawnBloodCloud(shark.boneX, shark.boneY, shark.size, currentTime);

                    // Red death ripple — notify CanvasManager
                    if (this.manager && this.manager._ripples) {
                        this.manager._ripples.push({
                            x: shark.boneX, y: shark.boneY,
                            startTime: currentTime,
                            maxR: 55 + shark.size * 0.8,
                            duration: 700,
                            color: '200,60,60',
                        });
                    }
                }

                const FALL_DURATION = 3000;  // ms padání
                const FADE_DURATION = 800;   // ms fadeoutu
                const elapsed = currentTime - shark.boneStartTime;

                // Remove after full fadeout
                if (elapsed > FALL_DURATION + FADE_DURATION) continue;

                // Ballistic physics: inherited velocity + gentle underwater gravity
                const dt2 = typeof deltaTime === 'number' ? deltaTime : 16;
                const GRAVITY = 0.00012; // px/ms²
                shark.boneVY += GRAVITY * dt2;
                shark.boneVX *= 1 - 0.003 * (dt2 / 16); // water resistance
                shark.boneX  += shark.boneVX * dt2;
                shark.boneY  += shark.boneVY * dt2;

                const alpha = elapsed < FALL_DURATION
                    ? 1.0
                    : 1.0 - (elapsed - FALL_DURATION) / FADE_DURATION;

                // Draw bone image
                if (this.boneLoaded && this.boneImage) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    try {
                        const boneW = shark.size * 1.33;
                        const boneH = boneW * (this.boneImage.height / this.boneImage.width) || shark.size;
                        ctx.translate(shark.boneX, shark.boneY);
                        if (shark.direction < 0) ctx.scale(-1, 1);
                        ctx.drawImage(this.boneImage, -boneW / 2, -boneH / 2, boneW, boneH);
                    } catch (e) { /* ignore */ }
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = 'rgba(220,220,220,0.95)';
                    ctx.beginPath();
                    ctx.ellipse(shark.boneX, shark.boneY, shark.size, shark.size * 0.4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                this.sharks[writeIndex++] = shark;
                continue;
            }

            // Natural lifespan: passive post-mating fish fade out after MAX_PASSIVE_LIFESPAN
            if (shark.passive && shark.isIndependent && shark.bornAt !== undefined &&
                    currentTime - shark.bornAt > FishLayer.MAX_PASSIVE_LIFESPAN) {
                shark.isDying = true;
            }

            // Dancing partner: MatingScenario controls position — skip all schooling/movement
            if (shark.isDancing) {
                shark.age = (shark.age || 0) + deltaTime;
                const schoolWaveOffset = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
                const verticalPhase    = (shark.age / shark.verticalPeriod) % 1;
                const verticalOffset   = Math.sin(verticalPhase * Math.PI * 2) * shark.verticalAmplitude;
                const currentY         = shark.baseY + schoolWaveOffset + verticalOffset;
                // Skip draw if CuriousFishLayer will draw it on top instead
                if (!shark._drawOnTop && shark !== targetedFish) {
                    this.drawShark(ctx, shark.x, currentY, shark.size, shark.direction, verticalPhase, shark.image, 0, 0, shark);
                }
                this.sharks[writeIndex++] = shark;
                continue;
            }

            // Cache centroid once per fish (flocking + screen-wrap both use it)
            const centroid = schoolCentroids.get(shark.schoolId);
            const schoolMembers = centroid?.members || null;

            // Update position
            // Capture previous X to detect near-zero net movement later
            const prevX = shark.x;
            shark.x += shark.direction * shark.speed;
            // Apply birth burst velocity (decays to zero over ~60 frames)
            if (shark.burstVX !== undefined) {
                shark.x += shark.burstVX;
                shark.baseY += shark.burstVY;
                shark.burstVX *= 0.92;
                shark.burstVY *= 0.92;
                if (Math.abs(shark.burstVX) < 0.05 && Math.abs(shark.burstVY) < 0.05) {
                    delete shark.burstVX;
                    delete shark.burstVY;
                }
            }
            shark.age += deltaTime;
            
            // Calculate current Y position
            const schoolWaveOffset = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
            const verticalPhase = (shark.age / shark.verticalPeriod) % 1;
            const verticalOffset = Math.sin(verticalPhase * Math.PI * 2) * shark.verticalAmplitude;
            const currentY = shark.baseY + schoolWaveOffset + verticalOffset;

            // Clamp baseY to safe zone to prevent vertical drift accumulation
            {
                const safeTop = this.config.verticalMarginTop + shark.size;
                const safeBot = height - this.config.verticalMarginBottom - shark.size;
                if (shark.baseY < safeTop) shark.baseY += (safeTop - shark.baseY) * 0.05;
                else if (shark.baseY > safeBot) shark.baseY += (safeBot - shark.baseY) * 0.05;
            }
            
            // Curious fish avoidance (disabled during combat) - Use squared distance
            if (canAvoidCuriousFish && !shark.isBeingAttacked) {
                    const dx = shark.x - curiousFish.x;
                    const dy = currentY - curiousFish.y;
                    const distanceSquared = dx * dx + dy * dy; // Avoid sqrt for performance
                    
                    const avoidRadius = this.config.avoidRadius + curiousFishSize;
                    const avoidRadiusSquared = avoidRadius * avoidRadius;
                    
                    if (distanceSquared < avoidRadiusSquared && distanceSquared > 0) {
                        // Only calculate sqrt when needed for normalization
                        const distance = Math.sqrt(distanceSquared);
                        const avoidStrength = (1 - distance / avoidRadius) * 2.5;
                        shark.x += (dx / distance) * avoidStrength;
                        shark.baseY += (dy / distance) * avoidStrength * 0.5;
                    }
            }

            // Mouse cursor avoidance — fish scatter gently when cursor is close.
            // Strength is capped to the fish's own speed so slow fish can never be
            // reversed (which would send them far from the school and trigger a massive
            // centroid snap-back — the "10× faster" bug).
            if (this.mouseX !== null && this.mouseY !== null) {
                const mdx = shark.x - this.mouseX;
                const mdy = currentY - this.mouseY;
                const mDistSq = mdx * mdx + mdy * mdy;
                const MOUSE_AVOID_R = 175;
                if (mDistSq < MOUSE_AVOID_R * MOUSE_AVOID_R && mDistSq > 0) {
                    const mDist = Math.sqrt(mDistSq);
                    const rawStrength = (1 - mDist / MOUSE_AVOID_R) * 1.4;
                    const strength = Math.min(rawStrength, shark.speed * 0.9);
                    shark.x += (mdx / mDist) * strength;
                    shark.baseY += (mdy / mDist) * strength * 0.45;
                }
            }
            
            // Flocking: centroid cohesion + pairwise separation
            // Skipped for post-mating independent fish — they swim solo.
            const sizeNorm = 40;
            const sizeFactor = Math.max(0.5, shark.size / sizeNorm);

            if (!shark.isIndependent) {
                const baseSeparationRadius = 40 * (1 + (sizeFactor - 1) * 1.5);
                const baseSeparationRadiusSq = baseSeparationRadius * baseSeparationRadius;

                // Centroid pull — spring-like: dead zone 20 px, progressive up to ~200 px.
                // When the centroid is BEHIND the fish (fish has advanced past centroid during
                // screen-edge wrapping), the backward pull is 5× weaker so fish don't violently
                // reverse direction and appear "crazy fast" while the school is transitioning.
                if (centroid && centroid.count > 1) {
                    let cdx = centroid.x - shark.x;
                    if (Math.abs(cdx) > width * 0.5) cdx += cdx > 0 ? -width : width;
                    const cdy = centroid.y - shark.baseY;
                    const cdistSq = cdx * cdx + cdy * cdy;
                    // Skip sqrt when inside the 20-px dead zone (pullT would be 0 anyway)
                    if (cdistSq > 20 * 20) {
                        const cdist = Math.sqrt(cdistSq);
                        const pullT = Math.min((cdist - 20) / 180, 1.0);
                        const pullStrength = pullT * pullT * 0.10;
                        // attenuate x-pull when centroid is behind the fish's travel direction
                        const xPullMul = cdx * shark.direction >= 0 ? 1.0 : 0.20;
                        shark.x += cdx * pullStrength * xPullMul;
                        shark.baseY += cdy * pullStrength * 0.15;
                    }
                }

                // Restore swim speed toward baseSpeed — applied unconditionally so isolated
                // fish (no centroid) and post-food-burst fish also normalise.
                if (shark.baseSpeed !== undefined) {
                    shark.speed += (shark.baseSpeed - shark.speed) * 0.02;
                }

                // Pairwise separation — only same school, max 5 checks
                let separationX = 0;
                let separationY = 0;
                let sepChecks = 0;
                for (const other of schoolMembers || this.sharks) {
                    if (other === shark || other.isDying) continue;
                    if (sepChecks++ >= 5) break;
                    const odx = shark.x - other.x;
                    const ody = shark.baseY - other.baseY;
                    const odistSq = odx * odx + ody * ody;
                    if (odistSq < baseSeparationRadiusSq && odistSq > 0) {
                        const odist = Math.sqrt(odistSq);
                        separationX += odx / odist;
                        separationY += ody / odist;
                    }
                }
                const separationStrength = 0.18 * Math.max(1.0, sizeFactor * 1.2);
                shark.x += separationX * separationStrength;
                shark.baseY += separationY * 0.04;
            }
            
            // Food attraction — only food ahead in travel direction, no direction reversal
            if (hasFoodParticles) {
                // fish1 (type 2), fish2 (type 1) and curiousfish school (type 3) have wider detection and stronger pull
                const isHungry  = shark.fishType === 1 || shark.fishType === 2 || shark.fishType === 3;
                const detectR   = isHungry ? 380 : 220;
                let nearestFood = null;
                let nearestDistSq = detectR * detectR;
                const cachedFood = shark.targetFood;

                if (cachedFood && !cachedFood.eaten) {
                    const cachedDx = cachedFood.x - shark.x;
                    const cachedDy = cachedFood.y - currentY;
                    const cachedDistSq = cachedDx * cachedDx + cachedDy * cachedDy;
                    const cachedAhead = (shark.direction > 0 && cachedDx > -40) || (shark.direction < 0 && cachedDx < 40);
                    if (cachedAhead && cachedDistSq < nearestDistSq) {
                        nearestFood = cachedFood;
                        nearestDistSq = cachedDistSq;
                    }
                }

                if (!nearestFood) {
                    const nearest = this._findNearestFood(foodLookup, shark.x, currentY, shark.direction, detectR);
                    nearestFood = nearest.nearestFood;
                    nearestDistSq = nearest.nearestDistSq;
                }

                shark.targetFood = nearestFood;

                if (nearestFood) {
                    const fdx = nearestFood.x - shark.x;
                    const fdy = nearestFood.y - currentY;
                    const fdist = Math.sqrt(nearestDistSq);

                    // Y steering — stronger pull for fish1/fish2
                    const yPull = isHungry ? 0.75 : 0.3;
                    if (fdist > 0) {
                        shark.baseY += (fdy / fdist) * yPull;
                    }

                    // Speed burst when close
                    const burstRange  = isHungry ? 140 : 80;
                    const burstAccel  = isHungry ? 0.07 : 0.03;
                    const burstMaxMul = isHungry ? 2.8 : 2.0;
                    if (fdist < burstRange) {
                        shark.speed = Math.min(shark.baseSpeed * burstMaxMul, shark.speed + burstAccel);
                    } else {
                        shark.speed = Math.max(shark.baseSpeed, shark.speed - 0.02);
                    }

                    // Eat
                    if (nearestDistSq < 14 * 14) {
                        nearestFood.eaten = true;
                        shark.targetFood = null;
                        shark.size = Math.min(80, shark.size + 0.5);
                        shark.speed = shark.baseSpeed;
                    }
                } else {
                    shark.targetFood = null;
                    shark.speed = Math.max(shark.baseSpeed, shark.speed - 0.02);
                }
            } else {
                shark.targetFood = null;
            }

            // Das lure attraction — same gentle pull as food, but toward kill zone
            if (dasLure) {
                const ldx = dasLure.x - shark.x;
                const ldy = dasLure.y - currentY;
                const ldistSq = ldx * ldx + ldy * ldy;
                const LURE_RANGE = 220 * 220;
                const isAhead = (shark.direction > 0 && ldx > -40) || (shark.direction < 0 && ldx < 40);
                if (isAhead && ldistSq < LURE_RANGE) {
                    const ldist = Math.sqrt(ldistSq);
                    if (ldist > 0) {
                        shark.baseY += (ldy / ldist) * 0.3;
                    }
                    if (ldist < 80) {
                        shark.speed = Math.min(shark.baseSpeed * 2.0, shark.speed + 0.03);
                    }
                }
            }
            
            // If the net horizontal movement this frame is extremely small (possible
            // stalemate when two schools press against each other), nudge the fish
            // slightly along its travel direction to break the tie.
            const netMove = shark.x - prevX;
            const minMovement = 0.12;
            if (Math.abs(netMove) < minMovement) {
                shark.x += shark.direction * minMovement;
            }

            // Wrap around screen — keep schoolId so cohesion works across the boundary
            if (shark.direction > 0 && shark.x > width + shark.size * 2) {
                shark.x = -shark.size * 2;
                const safeZoneTop = this.config.verticalMarginTop;
                const safeZoneBottom = height - this.config.verticalMarginBottom;
                // Use centroid Y so the whole school reappears at the same height
                const targetY = centroid ? centroid.y : shark.baseY;
                shark.baseY = Math.max(safeZoneTop, Math.min(safeZoneBottom,
                    targetY + (Math.random() - 0.5) * 30));
            } else if (shark.direction < 0 && shark.x < -shark.size * 2) {
                shark.x = width + shark.size * 2;
                const safeZoneTop = this.config.verticalMarginTop;
                const safeZoneBottom = height - this.config.verticalMarginBottom;
                // Use centroid Y so the whole school reappears at the same height
                const targetY = centroid ? centroid.y : shark.baseY;
                shark.baseY = Math.max(safeZoneTop, Math.min(safeZoneBottom,
                    targetY + (Math.random() - 0.5) * 30));
            }
            
            // Draw shark (no panic effect)
            if (shark !== targetedFish) {
                this.drawShark(ctx, shark.x, currentY, shark.size, shark.direction, verticalPhase, shark.image, 0, 0, shark);
                
                // Debug visualization
                if (showCuriousFishDebug) {
                    ctx.strokeStyle = shark.isBeingAttacked ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 0, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    // Draw ellipse instead of circle - fish are elongated
                    ctx.ellipse(shark.x, currentY, shark.size * 1.0, shark.size * 0.4, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            
            // Keep shark in array
            this.sharks[writeIndex++] = shark;
        }
        
        // Return dropped fish objects to pool before truncating — avoids GC churn
        if (writeIndex < this.sharks.length) {
            this._schoolMembershipDirty = true;
        }
        for (let i = writeIndex; i < this.sharks.length; i++) {
            this._sharkPool.push(this.sharks[i]);
        }
        // Truncate array efficiently
        this.sharks.length = writeIndex;

        // ── Blood particle system ──────────────────────────────────────────────
        if (this.bloodParticles.length > 0) {
            const now = currentTime;
            let bpWrite = 0;
            ctx.save();
            for (let i = 0; i < this.bloodParticles.length; i++) {
                const p = this.bloodParticles[i];
                const age = now - p.birth;
                if (age >= p.life) continue;

                // Very gentle drift — slow water-like damping
                p.x  += p.vx;
                p.y  += p.vy;
                p.vx *= 0.97;
                p.vy *= 0.97;

                // Short fade-in (5%), long hold, fade out last 40%
                const t = age / p.life;
                const fadeAlpha = t < 0.05 ? t / 0.05
                                : t < 0.60 ? 1.0
                                : 1.0 - (t - 0.60) / 0.40;

                ctx.globalAlpha = p.alpha * fadeAlpha;
                ctx.fillStyle   = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();

                this.bloodParticles[bpWrite++] = p;
            }
            for (let i = bpWrite; i < this.bloodParticles.length; i++) {
                this._bloodPool.push(this.bloodParticles[i]);
            }
            this.bloodParticles.length = bpWrite;
            ctx.globalAlpha = 1.0;
            ctx.restore();
        }
        
        // Draw targeted fish last if exists (no panic effect)
        if (targetedFish && !targetedFish.isDying) {
            const schoolWaveOffset = Math.sin(targetedFish.age * targetedFish.schoolWaveSpeed + targetedFish.schoolWavePhase) * targetedFish.schoolWaveAmplitude;
            const verticalPhase = (targetedFish.age / targetedFish.verticalPeriod) % 1;
            const verticalOffset = Math.sin(verticalPhase * Math.PI * 2) * targetedFish.verticalAmplitude;
            const currentY = targetedFish.baseY + schoolWaveOffset + verticalOffset;
            
            this.drawShark(ctx, targetedFish.x, currentY, targetedFish.size, targetedFish.direction, verticalPhase, targetedFish.image, 0, 0, targetedFish);
            
            // Debug visualization
            if (this.config.showDebug) {
                ctx.strokeStyle = targetedFish.isBeingAttacked ? 'rgba(255, 0, 0, 0.7)' : 'rgba(255, 255, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                // Draw ellipse instead of circle - fish are elongated
                ctx.ellipse(targetedFish.x, currentY, targetedFish.size * 1.0, targetedFish.size * 0.4, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
    
    drawShark(ctx, x, y, size, direction, swimPhase, sharkImage, deathRotation = 0, fadeProgress = 0, fishData = null) {
        // Fallback rendering if images not loaded
        if (this.imagesLoaded + this.imagesFailed < this.fishImages.length) {
            // Draw simple placeholder while loading — setTransform avoids save/restore overhead
            const psx = direction < 0 ? -1 : 1;
            ctx.setTransform(psx, 0, 0, 1, x, y);
            ctx.fillStyle = 'rgba(100, 150, 200, 0.5)';
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            return;
        }

        // Skip draw if this specific image failed to load
        if (!sharkImage || sharkImage._failed) return;

        // Compute horizontal scale: mating dance uses continuous flipX, others use binary direction
        const sx = (fishData && fishData.flipX !== undefined) ? fishData.flipX : (direction < 0 ? -1 : 1);

        // Compute rotation angle (fold translate+scale+rotate into one setTransform call)
        let angle;
        if (deathRotation > 0) {
            angle = deathRotation;
        } else {
            // Very slow underwater drift — ~2.5 s and ~4 s cycles, barely visible
            const t = fishData ? fishData.age : swimPhase * 2000;
            angle = Math.sin(t / 2500 * Math.PI * 2) * 0.007
                  + Math.sin(t / 4100 * Math.PI * 2 + 1.3) * 0.004;
        }

        // setTransform(a,b,c,d,e,f) = translate(x,y) * scale(sx,1) * rotate(angle)
        // → a=sx·cos, b=sin, c=−sx·sin, d=cos, e=x, f=y
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.setTransform(sx * cos, sin, -sx * sin, cos, x, y);
        ctx.globalAlpha = 1.0;

        // Pick depth-tinted cached image (0=deep/dark … 3=surface/full colour)
        // _imageIndex is set at spawn time for O(1) lookup; fall back to indexOf for
        // fish objects created externally (e.g. before this optimisation was added).
        const imgIndex = (fishData && fishData._imageIndex !== undefined)
            ? fishData._imageIndex
            : this.fishImages.indexOf(sharkImage);
        const tier = (fishData && fishData.depthTier !== undefined) ? fishData.depthTier
            : (this.height > 0 ? Math.max(0, Math.min(3, Math.floor((y / this.height) * 4))) : 3);
        const drawSrc = (imgIndex >= 0 && this._imageDepthCache[imgIndex])
            ? this._imageDepthCache[imgIndex][tier]
            : sharkImage;

        let usedFilter = false;
        if (fadeProgress > 0) {
            const grayscale = Math.round(fadeProgress * 100);
            const brightness = Math.round(100 - (fadeProgress * 70));
            ctx.filter = `grayscale(${grayscale}%) brightness(${brightness}%)`;
            usedFilter = true;
        }

        // Red hit-flash on impact (set by AttackBehavior via _hitFlashTime)
        const hitAge = fishData?._hitFlashTime ? Date.now() - fishData._hitFlashTime : Infinity;
        const isHitFlash = hitAge < 220;

        const imgWidth  = size * 2;
        const imgHeight = size * (sharkImage.height / sharkImage.width) * 2;
        ctx.drawImage(drawSrc, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);

        if (isHitFlash) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.55 * (1 - hitAge / 220);
            ctx.fillStyle   = '#ff1500';
            ctx.fillRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
        }

        // Reset only what was changed — cheaper than ctx.restore() restoring full state
        if (usedFilter) ctx.filter = 'none';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    spawnSchool(width, height, totalSchools = 8) {
        const direction = Math.random() > 0.5 ? 1 : -1;

        // Cycle through 6 archetypes — fish2 appears 2×, shark 2×, micro 1×, curious 1×
        const archetype = this._schoolsSpawned % 6;
        const fishType = archetype === 0 ? 0   // shark
                       : archetype === 1 ? 1   // fish2
                       : archetype === 2 ? 2   // fish1 (micro)
                       : archetype === 3 ? 3   // curiousfish
                       : archetype === 4 ? 1   // fish2
                       : 0;                    // shark (solo)
        let baseSize, schoolImage, fishCountBase;

        // shark.png — biggest: 50-120px, osamělí predátoři
        if (fishType === 0) {
            schoolImage = this.fishImages[0];
            baseSize = 50 + Math.random() * 70;
            fishCountBase = [1, 1]; // pevně 1 (osamělí)
        }
        // fish2.png — střední: 10-30px, střední hejna
        else if (fishType === 1) {
            schoolImage = this.fishImages[1];
            baseSize = 10 + Math.random() * 20;
            fishCountBase = [4, 8]; // střední hejna
        }
        // fish1.png — nejmenší: 10-16px, středně velká hejna
        else if (fishType === 2) {
            schoolImage = this.fishImages[2];
            baseSize = 10 + Math.random() * 6;
            fishCountBase = [7, 12]; // omezené počty
        }
        // curiousfish.png — hráčovo/kuriozní hejno: malé 2-4 jedinci
        else {
            schoolImage = this.fishImages[3];
            // Make curiousfish smaller by default: 30 - 60 px
            baseSize = 30 + Math.random() * 30;
            fishCountBase = [2, 4]; // malé hejno
        }

        // Final school size — single source of truth for everything below
        const sizeVariation = 0.5 + Math.random();
        const schoolSize = Math.max(fishType === 2 ? 12 : fishType === 0 ? 50 : 30, baseSize * sizeVariation * this.config.size);

        // ── Depth tier ────────────────────────────────────────────────────────
        // Larger fish = shallower (tier 3 = surface), smaller = deeper (tier 0).
        const depthTier = schoolSize > 70 ? 3
                        : schoolSize > 50 ? 2
                        : schoolSize > 35 ? 1
                        : 0;

        // ── Speed derived from size ───────────────────────────────────────────
        // Surface fish (big) are fast, deep fish (small) are slow.
        // Normalise schoolSize 30..120 → speedT 0..1
        const speedT = Math.min(1, Math.max(0, (schoolSize - 30) / 90));
        const speedMult = fishType === 2 ? 2.0 : 1.0; // micro fish (fish1) swim 2× faster
        const schoolSpeed = (0.35 + speedT * 1.15 + (Math.random() - 0.5) * 0.3) * speedMult;

        // ── Fish count — more fish in deeper/smaller hejna ────────────────────
        const countVariation = 0.7 + Math.random() * 0.6;
        const fishCount = Math.min(this.config.maxSchoolSize, Math.max(1, Math.floor(
            (fishCountBase[0] + Math.random() * (fishCountBase[1] - fishCountBase[0])) * countVariation
        )));

        // ── Y position: slot-based distribution across the full safe zone ─────
        // Divide the safe zone into totalSchools equal slots and assign this school
        // to its slot deterministically — prevents clustering of same-tier schools.
        // A soft tier bias (bigger=shallower) nudges within the slot.
        const safeZoneTop = this.config.verticalMarginTop;
        const safeZoneBottom = height - this.config.verticalMarginBottom;
        const safeZoneHeight = safeZoneBottom - safeZoneTop;
        const slotCount = Math.max(totalSchools, 4);
        const slotIndex = this._schoolsSpawned % slotCount;
        const slotHeight = safeZoneHeight / slotCount;
        const slotCentreY = safeZoneTop + slotHeight * (slotIndex + 0.5);
        // Soft tier bias: tier3 (big) drifts up, tier0 (small) drifts down
        const tierBias = (depthTier - 1.5) / 1.5; // tier3≈+1 (up), tier0≈−1 (down)
        let schoolY = slotCentreY - tierBias * slotHeight * 0.3
                    + (Math.random() - 0.5) * slotHeight * 0.55;
        schoolY = Math.max(safeZoneTop + 20, Math.min(safeZoneBottom - 20, schoolY));

        // Das Y-avoidance — only for the smallest/densest school (fishType === 2, fish1.png)
        if (fishType === 2) {
            const dasLayer = this.manager && this.manager.getLayer('das');
            if (dasLayer && dasLayer.fish) {
                const dasY = dasLayer.fish.y;
                const avoidBand = 90;
                if (Math.abs(schoolY - dasY) < avoidBand) {
                    const shift = dasY - schoolY > 0 ? -avoidBand * 1.5 : avoidBand * 1.5;
                    schoolY = Math.max(safeZoneTop + 20, Math.min(safeZoneBottom - 20, schoolY + shift));
                }
            }
        }

        const schoolCenterX = direction > 0 ? -schoolSize * 2 : width + schoolSize * 2;

        const schoolWavePhase = Math.random() * Math.PI * 2;
        const schoolWaveSpeed = 0.0008 + Math.random() * 0.0006;
        const schoolWaveAmplitude = 8 + Math.random() * 10;
        
        for (let i = 0; i < fishCount; i++) {
            // Calculate individual fish size first — minimum 30px regardless of random multipliers
            const individualSize = Math.max(fishType === 2 ? 12 : fishType === 0 ? 50 : 30, schoolSize * (0.4 + Math.random() * 0.3));
            
            // Spread based on individual fish size - larger fish spawn further from center
            const spreadFactorX = 2.5 + (individualSize / schoolSize);
            const spreadFactorY = 1.5 + (individualSize / schoolSize) * 0.5;
            const offsetX = (Math.random() - 0.5) * individualSize * spreadFactorX;
            const offsetY = (Math.random() - 0.5) * individualSize * spreadFactorY;
            
            const fishSpeed = schoolSpeed * (0.9 + Math.random() * 0.2);
            const shark = this._sharkPool.pop() || {};
            shark.x = schoolCenterX + offsetX;
            shark.baseY = schoolY + offsetY;
            shark.size = individualSize;
            shark.speed = fishSpeed;
            shark.baseSpeed = fishSpeed;
            shark.schoolId = this._nextSchoolId;  // use monotonic counter, not _schoolsSpawned
            shark.fishType = fishType;
            shark.depthTier = depthTier;
            shark.direction = direction;
            shark.verticalAmplitude = 2 + Math.random() * 4;
            shark.verticalPeriod = 5000 + Math.random() * 5000;
            shark.age = Math.random() * 1000;
            shark.image = schoolImage;
            shark._imageIndex = fishType;
            shark.schoolWavePhase = schoolWavePhase;
            shark.schoolWaveSpeed = schoolWaveSpeed;
            shark.schoolWaveAmplitude = schoolWaveAmplitude;
            shark.tailPeriod = 280 + Math.random() * 220;
            // Clear any stale state from a previous life
            shark.isDying = undefined;
            shark.boneY = undefined;
            shark.boneStartTime = undefined;
            shark.isDancing = undefined;
            shark._hitFlashTime = undefined;
            shark.passive = undefined;
            shark.isIndependent = undefined;
            this.sharks.push(shark);
        }

        this._schoolMembershipDirty = true;
    }

    /**
     * Spawn a large school from the right side heading left — used for the intro cinematic.
     * @param {number} width
     * @param {number} height
     * @param {number} targetY  - vertical centre for the school (default: canvas mid)
     */
    spawnIntroSchool(width, height, targetY) {
        const direction = 1; // left → right
        const schoolImage = this.fishImages[1]; // fish2.webp — small, dense
        const fishCount = Math.min(this.config.maxSchoolSize, 35 + Math.floor(Math.random() * 20));
        const baseSize  = 16;
        const schoolSpeed = 1.4;
        const centreY = targetY ?? height * 0.60;
        const schoolId = -1; // special intro ID — does NOT touch _schoolsSpawned
        const schoolWavePhase = Math.random() * Math.PI * 2;
        const schoolWaveSpeed = 0.0009;
        const schoolWaveAmplitude = 12;

        for (let i = 0; i < fishCount; i++) {
            const sz = baseSize * (0.7 + Math.random() * 0.6);
            const ox = (Math.random() - 0.5) * sz * 7;
            const oy = (Math.random() - 0.5) * sz * 3;
            const fish = this._sharkPool.pop() || {};
            fish.x               = -sz * 3 + ox;
            fish.baseY           = centreY + oy;
            fish.size            = sz;
            fish.speed           = schoolSpeed * (0.9 + Math.random() * 0.2);
            fish.baseSpeed       = schoolSpeed;
            fish.schoolId        = schoolId;
            fish.fishType        = 1;
            fish.depthTier       = 1;
            fish.direction       = direction;
            fish.verticalAmplitude = 3 + Math.random() * 3;
            fish.verticalPeriod  = 4000 + Math.random() * 3000;
            fish.age             = Math.random() * 500;
            fish.image           = schoolImage;
            fish._imageIndex     = 1;
            fish.schoolWavePhase = schoolWavePhase;
            fish.schoolWaveSpeed = schoolWaveSpeed;
            fish.schoolWaveAmplitude = schoolWaveAmplitude;
            fish.tailPeriod      = 260 + Math.random() * 180;
            fish.isDying         = undefined;
            fish.boneY           = undefined;
            fish.boneStartTime   = undefined;
            fish.isDancing       = undefined;
            fish._hitFlashTime   = undefined;
            fish.passive         = undefined;
            fish.isIndependent   = undefined;
            this.sharks.push(fish);
        }

        this._schoolMembershipDirty = true;
    }

    /**
     * Spawn a blood cloud of soft round particles that gently expand and fade.
     * @param {number} x
     * @param {number} y
     * @param {number} size           - fish size, scales count and radius
     * @param {number|null} impactAngle - directional bias (null = full circle)
     */
    _spawnBloodBurst(x, y, size, impactAngle = null, spawnTime = 0) {
        const PALETTE = ['#8b0000','#a80000','#c01010','#6a0000','#b02000','#cc0000'];
        const now = spawnTime;
        const quality = this._qualityMultiplier || 1.0;
        const maxConcurrent = Math.max(48, Math.round(FishLayer.MAX_BLOOD_PARTICLES * quality));
        const availableSlots = Math.max(0, maxConcurrent - this.bloodParticles.length);
        if (availableSlots === 0) return;

        const desiredCount = Math.min(
            Math.max(FishLayer.MIN_BLOOD_PARTICLES_PER_BURST, Math.floor(size * 0.5)),
            Math.max(FishLayer.MIN_BLOOD_PARTICLES_PER_BURST, Math.round(FishLayer.MAX_BLOOD_PARTICLES_PER_BURST * quality))
        );
        const count = Math.min(desiredCount, availableSlots);

        for (let i = 0; i < count; i++) {
            const angle = impactAngle !== null
                ? impactAngle + (Math.random() - 0.5) * Math.PI * 1.6
                : Math.random() * Math.PI * 2;

            // Slow, drifting particles — small initial speed, large radius
            const speed  = 0.15 + Math.random() * 0.55;
            const r      = size * (0.04 + Math.random() * 0.10);
            const life   = 3500 + Math.random() * 1500; // 3.5 – 5 s

            const bp = this._bloodPool.pop() || {};
            bp.x      = x + (Math.random() - 0.5) * size * 0.3;
            bp.y      = y + (Math.random() - 0.5) * size * 0.2;
            bp.vx     = Math.cos(angle) * speed;
            bp.vy     = Math.sin(angle) * speed * 0.6;
            bp.radius = r;
            bp.color  = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            bp.alpha  = 0.45 + Math.random() * 0.40;
            bp.birth  = now;
            bp.life   = life;
            this.bloodParticles.push(bp);
        }
    }

    /** Alias used by the dying-fish path (purely radial, no impact angle). */
    _spawnBloodCloud(x, y, size, spawnTime = 0) {
        this._spawnBloodBurst(x, y, size, null, spawnTime);
    }

    /**
     * Pre-render 4 depth-tinted variants of a source image into OffscreenCanvases.
     * Tier 0 = deepest (desaturated+dark), Tier 3 = surface (original).
     * Cost: called once per image on load, ~1 ms.
     */
    _buildDepthCache(sourceImage) {
        const TIERS = [
            { sat: 92,  bri: 82 },   // tier 0: deep — full colour, just darker
            { sat: 96,  bri: 89 },   // tier 1
            { sat: 99,  bri: 95 },   // tier 2
            null                      // tier 3: original, no processing
        ];
        const w = sourceImage.naturalWidth || sourceImage.width;
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

