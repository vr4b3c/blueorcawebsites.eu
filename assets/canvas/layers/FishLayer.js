/**
 * FishLayer - School fish implementation
 * Renders schools of fish swimming across the screen
 */
import { drawGlow } from '../utils/GlowCache.js';

export class FishLayer {
    // Single source of truth for fish layer configuration
    static DEFAULT_CONFIG = {
        schoolCount: null,     // null = auto-scale by viewport (1 school per 250 000 px²)
        schoolDensity: 250000, // px² per school when schoolCount is null
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
        this._schoolCentroidsCache = new Map();
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
        
        // Bind mouse event handler
        this.handleMouseMove = this.handleMouseMove.bind(this);
    }
    
    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
    }
    
    init(width, height, canvasManager) {
        this.width = width;
        this.height = height;
        this.sharks = [];
        this._schoolsSpawned = 0;
        this._recalcSchoolCount(width, height);
        
        // Store reference to manager for food access
        this.manager = canvasManager || window.blueOrcaCanvas;
        
        // Add mouse listener
        document.addEventListener('mousemove', this.handleMouseMove);
        console.log('SharkLayer initialized');
    }
    
    /**
     * Cleanup resources and event listeners
     */
    destroy() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        this.sharks = [];
        this._schoolsSpawned = 0;
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
        const density = this.config.schoolDensity || 250000;
        const count = Math.max(2, Math.min(20, Math.round(area / density)));
        this._autoSchoolCount = count;
    }
    
    render(ctx, currentTime, deltaTime, width, height) {
        if (!this.enabled) return;
        
        if (!this._frameCounter) this._frameCounter = 0;
        this._frameCounter++;

        // Resolve effective school count (manual config or auto-scaled)
        const effectiveSchoolCount = this.config.schoolCount !== null
            ? this.config.schoolCount
            : (this._autoSchoolCount || this._recalcSchoolCount(width, height) || this._autoSchoolCount);
        
        // Spawn schools until we have the configured number of schools
        while (this._schoolsSpawned < effectiveSchoolCount) {
            this.spawnSchool(width, height);
            this._schoolsSpawned++;
        }
        
        // Remove all fish if school count decreased
        if (this._schoolsSpawned > effectiveSchoolCount) {
            this.sharks = [];
            this._schoolsSpawned = 0;
        }
        
        // Get targeted fish from curious fish layer
        const curiousFishLayer = this.manager && this.manager.getLayer('curiousFish');
        const targetedFish = curiousFishLayer && curiousFishLayer.targetSchoolFish;

        // Pre-compute per-school centroids using wrap-aware (circular) averaging
        // so schools stay coherent even when fish span the screen wrap boundary.
        this._schoolCentroidsCache.clear();
        const schoolCentroids = this._schoolCentroidsCache;
        for (const f of this.sharks) {
            if (f.isDying || typeof f.schoolId === 'undefined') continue;
            const c = schoolCentroids.get(f.schoolId);
            if (c) {
                // Accumulate wrap-normalised X: offset fish that are on the far side
                let fx = f.x;
                if (Math.abs(fx - c.x / c.count) > width * 0.5) {
                    fx += fx < c.x / c.count ? width : -width;
                }
                c.x += fx; c.y += f.baseY; c.speed += f.speed; c.count++;
            } else {
                schoolCentroids.set(f.schoolId, { x: f.x, y: f.baseY, speed: f.speed, count: 1 });
            }
        }
        for (const [, c] of schoolCentroids) {
            c.x = ((c.x / c.count) % width + width) % width; // wrap back 0..width
            c.y /= c.count; c.speed /= c.count;
        }
        
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
        
        // Predation: throttled to every 6 frames — O(n²) so no need to run every frame
        this._predFrame = ((this._predFrame || 0) + 1) % 6;
        if (this._predFrame === 0) this._doPredation(currentTime);

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
                    shark.boneStartTime = currentTime;
                    this._spawnBloodCloud(shark.boneX, shark.boneY, shark.size, currentTime);
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

            // Dancing partner: MatingScenario controls position — skip all schooling/movement
            if (shark.isDancing) {
                shark.age = (shark.age || 0) + deltaTime;
                const schoolWaveOffset = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
                const verticalPhase    = (shark.age / shark.verticalPeriod) % 1;
                const verticalOffset   = Math.sin(verticalPhase * Math.PI * 2) * shark.verticalAmplitude;
                const currentY         = shark.baseY + schoolWaveOffset + verticalOffset;
                if (shark !== targetedFish) {
                    this.drawShark(ctx, shark.x, currentY, shark.size, shark.direction, verticalPhase, shark.image, 0, 0, shark);
                }
                this.sharks[writeIndex++] = shark;
                continue;
            }

            // Update position (frozen if being attacked)
            // Capture previous X to detect near-zero net movement later
            const prevX = shark.x;
            if (!shark.isBeingAttacked) {
                shark.x += shark.direction * shark.speed;
            }
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
            if (this.manager && this.manager.getLayer && !shark.isBeingAttacked) {
                const curiousFishLayer = this.manager.getLayer('curiousFish');
                if (curiousFishLayer && curiousFishLayer.enabled && curiousFishLayer.fish && !curiousFishLayer.isAttackingSchoolFish) {
                    const cfx = curiousFishLayer.fish.x;
                    const cfy = curiousFishLayer.fish.y;
                    const cfSize = curiousFishLayer.fish.currentSize || curiousFishLayer.config.size;
                    
                    const dx = shark.x - cfx;
                    const dy = currentY - cfy;
                    const distanceSquared = dx * dx + dy * dy; // Avoid sqrt for performance
                    
                    const avoidRadius = this.config.avoidRadius + cfSize;
                    const avoidRadiusSquared = avoidRadius * avoidRadius;
                    
                    if (distanceSquared < avoidRadiusSquared && distanceSquared > 0) {
                        // Only calculate sqrt when needed for normalization
                        const distance = Math.sqrt(distanceSquared);
                        const avoidStrength = (1 - distance / avoidRadius) * 2.5;
                        shark.x += (dx / distance) * avoidStrength;
                        shark.baseY += (dy / distance) * avoidStrength * 0.5;
                    }
                }
            }
            
            // Flocking: centroid cohesion + pairwise separation
            // Skipped for post-mating independent fish — they swim solo.
            const sizeNorm = 40;
            const sizeFactor = Math.max(0.5, shark.size / sizeNorm);

            if (!shark.isIndependent) {
                const baseSeparationRadius = 40 * (1 + (sizeFactor - 1) * 1.5);

                // Centroid pull — spring-like: dead zone 20 px, progressive up to ~200 px
                const centroid = schoolCentroids.get(shark.schoolId);
                if (centroid && centroid.count > 1) {
                    let cdx = centroid.x - shark.x;
                    if (Math.abs(cdx) > width * 0.5) cdx += cdx > 0 ? -width : width;
                    const cdy = centroid.y - shark.baseY;
                    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
                    const pullT = Math.min(Math.max((cdist - 20) / 180, 0), 1.0);
                    const pullStrength = pullT * pullT * 0.10;
                    shark.x += cdx * pullStrength;
                    shark.baseY += cdy * pullStrength * 0.15;
                    if (shark.baseSpeed !== undefined) {
                        shark.speed += (shark.baseSpeed - shark.speed) * 0.02;
                    }
                }

                // Pairwise separation — only same school, max 5 checks
                let separationX = 0;
                let separationY = 0;
                let sepChecks = 0;
                for (const other of this.sharks) {
                    if (other === shark || other.isDying) continue;
                    if (sepChecks++ >= 5) break;
                    if (shark.schoolId !== other.schoolId) continue;
                    const odx = shark.x - other.x;
                    const ody = shark.baseY - other.baseY;
                    const odistSq = odx * odx + ody * ody;
                    if (odistSq < baseSeparationRadius * baseSeparationRadius && odistSq > 0) {
                        const odist = Math.sqrt(odistSq);
                        separationX += odx / odist;
                        separationY += ody / odist;
                    }
                }
                const separationStrength = 0.18 * Math.max(1.0, sizeFactor * 1.2);
                shark.x += separationX * separationStrength;
                shark.baseY += separationY * 0.04;
            }
            
            // Food attraction - Use squared distance
            if (this.manager && this.manager.foodLayer && this.manager.foodLayer.getParticles().length > 0) {
                let nearestFood = null;
                let nearestDistanceSquared = 150 * 150; // Compare squared distances
                
                for (const food of this.manager.foodLayer.getParticles()) {
                    if (food.eaten) continue;
                    
                    const fdx = food.x - shark.x;
                    const fdy = food.y - currentY;
                    const fdistSquared = fdx * fdx + fdy * fdy;
                    
                    const isAhead = (shark.direction > 0 && fdx > 0) || (shark.direction < 0 && fdx < 0);
                    
                    if (isAhead && fdistSquared < nearestDistanceSquared) {
                        nearestDistanceSquared = fdistSquared;
                        nearestFood = food;
                    }
                }
                
                if (nearestFood) {
                    const attractStrength = 0.15;
                    const fdx = nearestFood.x - shark.x;
                    const fdy = nearestFood.y - currentY;
                    const fdist = Math.sqrt(nearestDistanceSquared); // Calculate from squared distance
                    
                    if (fdist > 0) {
                        shark.x += (fdx / fdist) * attractStrength;
                        shark.baseY += (fdy / fdist) * attractStrength * 0.2;
                    }
                    
                    if (nearestDistanceSquared < 15 * 15) { // Compare squared
                        console.log('🐟 School fish eating! Distance:', fdist.toFixed(2), 'Size before:', shark.size.toFixed(1));
                        nearestFood.eaten = true;
                        // Grow when eating
                        shark.size += 0.5;
                        if (shark.size > 80) shark.size = 80; // Max size for school fish
                        console.log('Size after:', shark.size.toFixed(1));
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
                const centroid = schoolCentroids.get(shark.schoolId);
                const targetY = centroid ? centroid.y : shark.baseY;
                shark.baseY = Math.max(safeZoneTop, Math.min(safeZoneBottom,
                    targetY + (Math.random() - 0.5) * 30));
            } else if (shark.direction < 0 && shark.x < -shark.size * 2) {
                shark.x = width + shark.size * 2;
                const safeZoneTop = this.config.verticalMarginTop;
                const safeZoneBottom = height - this.config.verticalMarginBottom;
                // Use centroid Y so the whole school reappears at the same height
                const centroid = schoolCentroids.get(shark.schoolId);
                const targetY = centroid ? centroid.y : shark.baseY;
                shark.baseY = Math.max(safeZoneTop, Math.min(safeZoneBottom,
                    targetY + (Math.random() - 0.5) * 30));
            }
            
            // Draw shark (no panic effect)
            if (shark !== targetedFish) {
                this.drawShark(ctx, shark.x, currentY, shark.size, shark.direction, verticalPhase, shark.image, 0, 0, shark);
                
                // Debug visualization
                if (this.config.showDebug && this.manager && this.manager.getLayer) {
                    const curiousFishLayer = this.manager.getLayer('curiousFish');
                    if (curiousFishLayer && curiousFishLayer.enabled && curiousFishLayer.fish) {
                        ctx.strokeStyle = shark.isBeingAttacked ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 0, 0.3)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        // Draw ellipse instead of circle - fish are elongated
                        ctx.ellipse(shark.x, currentY, shark.size * 1.0, shark.size * 0.4, 0, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
            
            // Keep shark in array
            this.sharks[writeIndex++] = shark;
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

                // Gentle drift — damp quickly, no gravity
                p.x  += p.vx;
                p.y  += p.vy;
                p.vx *= 0.88;
                p.vy *= 0.88;

                // Smooth bell-curve alpha: ramp up first 15%, hold, then fade out
                const t = age / p.life;
                const fadeAlpha = t < 0.15 ? t / 0.15
                                : t < 0.55 ? 1.0
                                : 1.0 - (t - 0.55) / 0.45;

                ctx.globalAlpha = p.alpha * fadeAlpha;
                ctx.fillStyle   = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();

                this.bloodParticles[bpWrite++] = p;
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
            // Draw simple placeholder while loading
            ctx.save();
            ctx.translate(x, y);
            if (direction < 0) ctx.scale(-1, 1);
            ctx.fillStyle = 'rgba(100, 150, 200, 0.5)';
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // Skip draw if this specific image failed to load
        if (!sharkImage || sharkImage._failed) return;

        ctx.save();
        ctx.translate(x, y);

        // During mating dance the partner gets a smooth flipX (cos-driven X-axis rotation).
        // Use it when present; otherwise fall back to binary direction flip.
        if (fishData && fishData.flipX !== undefined) {
            ctx.scale(fishData.flipX, 1);
        } else if (direction < 0) {
            ctx.scale(-1, 1);
        }

        ctx.globalAlpha = 1.0;

        // Pick depth-tinted cached image (0=deep/dark … 3=surface/full colour)
        const imgIndex = this.fishImages.indexOf(sharkImage);
        const tier = (fishData && fishData.depthTier !== undefined) ? fishData.depthTier
            : (this.height > 0 ? Math.min(3, Math.floor((y / this.height) * 4)) : 3);
        const drawSrc = (imgIndex >= 0 && this._imageDepthCache[imgIndex])
            ? this._imageDepthCache[imgIndex][tier]
            : sharkImage;
        
        if (deathRotation > 0) {
            ctx.rotate(deathRotation);
        } else {
            // Very slow underwater drift — ~2.5 s and ~4 s cycles, barely visible
            const t = fishData ? fishData.age : swimPhase * 2000;
            const tilt = Math.sin(t / 2500 * Math.PI * 2) * 0.007
                       + Math.sin(t / 4100 * Math.PI * 2 + 1.3) * 0.004;
            ctx.rotate(tilt);
        }
        
        if (fadeProgress > 0) {
            const grayscale = Math.round(fadeProgress * 100);
            const brightness = Math.round(100 - (fadeProgress * 70));
            ctx.filter = `grayscale(${grayscale}%) brightness(${brightness}%)`;
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
        
        ctx.restore();
    }
    
    spawnSchool(width, height) {
        const direction = Math.random() > 0.5 ? 1 : -1;

        // Cycle through 3 archetypes: 0=shark, 1=normal fish (fish2), 2=curiousfish school
        const archetype = this._schoolsSpawned % 3;
        const fishType = archetype === 0 ? 0 : archetype === 1 ? 1 : 3;
        let baseSize, schoolImage, fishCountBase;

        // shark.png — biggest: 50-120px, small schools
        if (fishType === 0) {
            schoolImage = this.fishImages[0];
            baseSize = 50 + Math.random() * 70;
            fishCountBase = [1, 3]; // [min, max]
        }
        // fish2.png — smallest: 10-30px, large schools
        else if (fishType === 1) {
            schoolImage = this.fishImages[1];
            baseSize = 10 + Math.random() * 20;
            fishCountBase = [10, 15];
        }
        // fish1.png — nejmenší: 5-10px, velká hejna
        else if (fishType === 2) {
            schoolImage = this.fishImages[2];
            baseSize = 4 + Math.random() * 4;
            fishCountBase = [20, 35];
        }
        // curiousfish.png — large: 30-120px
        else {
            schoolImage = this.fishImages[3];
            baseSize = 30 + Math.random() * 90;
            fishCountBase = [4, 6];
        }

        // Final school size — single source of truth for everything below
        const sizeVariation = 0.5 + Math.random();
        const schoolSize = Math.max(fishType === 2 ? 5 : fishType === 0 ? 50 : 30, baseSize * sizeVariation * this.config.size);

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
        const schoolSpeed = 0.35 + speedT * 1.15 + (Math.random() - 0.5) * 0.3;

        // ── Fish count — more fish in deeper/smaller hejna ────────────────────
        const countVariation = 0.7 + Math.random() * 0.6;
        const fishCount = Math.max(1, Math.floor(
            (fishCountBase[0] + Math.random() * (fishCountBase[1] - fishCountBase[0])) * countVariation
        ));

        // ── Y position tied to depth tier ────────────────────────────────────
        // tier 3 (big/surface) → upper quarter; tier 0 (small/deep) → lower quarter.
        // Each tier occupies ~25 % of the safe zone, with ±10 % random scatter.
        const safeZoneTop = this.config.verticalMarginTop;
        const safeZoneBottom = height - this.config.verticalMarginBottom;
        const safeZoneHeight = safeZoneBottom - safeZoneTop;
        const tierFraction = (3 - depthTier) / 3; // 0 for tier3 (top), 1 for tier0 (bottom)
        const tierCentreY = safeZoneTop + safeZoneHeight * (tierFraction * 0.75 + 0.125);
        const schoolY = tierCentreY + (Math.random() - 0.5) * safeZoneHeight * 0.20;

        const schoolCenterX = direction > 0 ? -schoolSize * 2 : width + schoolSize * 2;

        const schoolWavePhase = Math.random() * Math.PI * 2;
        const schoolWaveSpeed = 0.0008 + Math.random() * 0.0006;
        const schoolWaveAmplitude = 8 + Math.random() * 10;
        
        for (let i = 0; i < fishCount; i++) {
            // Calculate individual fish size first — minimum 30px regardless of random multipliers
            const individualSize = Math.max(fishType === 2 ? 5 : fishType === 0 ? 50 : 30, schoolSize * (0.4 + Math.random() * 0.3));
            
            // Spread based on individual fish size - larger fish spawn further from center
            const spreadFactorX = 2.5 + (individualSize / schoolSize);
            const spreadFactorY = 1.5 + (individualSize / schoolSize) * 0.5;
            const offsetX = (Math.random() - 0.5) * individualSize * spreadFactorX;
            const offsetY = (Math.random() - 0.5) * individualSize * spreadFactorY;
            
            const fishSpeed = schoolSpeed * (0.9 + Math.random() * 0.2);
            this.sharks.push({
                x: schoolCenterX + offsetX,
                baseY: schoolY + offsetY,
                size: individualSize,
                speed: fishSpeed,
                baseSpeed: fishSpeed,
                schoolId: this._schoolsSpawned,
                fishType: fishType,
                depthTier: depthTier,
                direction: direction,
                verticalAmplitude: 2 + Math.random() * 4,
                verticalPeriod: 5000 + Math.random() * 5000,
                age: Math.random() * 1000,
                image: schoolImage,
                schoolWavePhase: schoolWavePhase,
                schoolWaveSpeed: schoolWaveSpeed,
                schoolWaveAmplitude: schoolWaveAmplitude,
                tailPeriod: 280 + Math.random() * 220
            });
        }
    }

    /**
     * Spawn a blood cloud of soft round particles that gently expand and fade.
     * @param {number} x
     * @param {number} y
     * @param {number} size           - fish size, scales count and radius
     * @param {number|null} impactAngle - directional bias (null = full circle)
     */
    _spawnBloodBurst(x, y, size, impactAngle = null, spawnTime = 0) {
        const PALETTE = ['#8b0000','#a80000','#c01010','#6a0000','#b02000'];
        const now   = spawnTime;
        const count = Math.max(22, Math.min(55, Math.floor(size * 0.55)));

        for (let i = 0; i < count; i++) {
            let angle;
            if (impactAngle !== null) {
                // Fan within ±80° of impact direction
                angle = impactAngle + (Math.random() - 0.5) * Math.PI * 1.6;
            } else {
                angle = Math.random() * Math.PI * 2;
            }

            // Two tiers: inner dense slow drops + outer fast micro
            const isOuter = Math.random() < 0.38;
            const speed   = isOuter ? 1.8 + Math.random() * 4.5
                                    : 0.4 + Math.random() * 1.8;
            const r       = isOuter ? size * (0.018 + Math.random() * 0.032)
                                    : size * (0.038 + Math.random() * 0.085);
            const life    = isOuter ? 500  + Math.random() * 500
                                    : 900  + Math.random() * 700;

            this.bloodParticles.push({
                x:      x + (Math.random() - 0.5) * size * 0.25,
                y:      y + (Math.random() - 0.5) * size * 0.15,
                vx:     Math.cos(angle) * speed,
                vy:     Math.sin(angle) * speed * 0.55,
                radius: r,
                color:  PALETTE[Math.floor(Math.random() * PALETTE.length)],
                alpha:  0.55 + Math.random() * 0.40,
                birth:  now,
                life,
            });
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
            { sat: 30, bri: 100 },
            { sat: 55, bri: 100 },
            { sat: 78, bri: 100 },
            null  // tier 3: original, no processing
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

    /**
     * Predation pass: sharks (fishType 0) with size > 50 eat nearby smaller fish.
     * Runs once per render frame before the main draw loop.
     */
    _doPredation(currentTime) {
        const EAT_COOLDOWN = 1800;      // ms between individual shark eating events
        const EAT_DIST_FACTOR = 1.4;   // eating radius = predator.size * factor
        const PREY_SIZE_FACTOR = 0.65; // prey must be < this fraction of predator size
        const MIN_PREDATOR_SIZE = 50;  // only meaningfully large sharks hunt

        for (const predator of this.sharks) {
            if (predator.isDying) continue;
            if (predator.fishType !== 0) continue;
            if (predator.size < MIN_PREDATOR_SIZE) continue;
            if (predator.lastEatTime && currentTime - predator.lastEatTime < EAT_COOLDOWN) continue;

            const eatRadiusSq = (predator.size * EAT_DIST_FACTOR) ** 2;

            for (const prey of this.sharks) {
                if (prey === predator) continue;
                if (prey.isDying) continue;
                if (prey.size >= predator.size * PREY_SIZE_FACTOR) continue;
                if (prey.depthTier !== predator.depthTier) continue; // different depth level

                const dx = prey.x - predator.x;
                const dy = prey.baseY - predator.baseY;
                if (dx * dx + dy * dy < eatRadiusSq) {
                    prey.isDying = true;
                    predator.lastEatTime = currentTime;
                    break; // one prey per predator per cooldown window
                }
            }
        }
    }

    destroy() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        this.sharks = [];
    }
}

