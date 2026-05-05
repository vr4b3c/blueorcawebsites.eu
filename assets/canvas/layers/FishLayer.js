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
        this.mouseX = null;
        this.mouseY = null;
        this.manager = null; // Reference to manager for food particles
        
        // Load all fish images
        this.fishImages = [];
        const imagePaths = [
            'assets/images/fish/shark.png',
            'assets/images/fish/fish2.png', 
            'assets/images/fish/fish1.png',
            'assets/images/fish/curiousfish.png'
        ];
        this.imagesLoaded = 0;
        this.imagesFailed = 0; // Track failed images
        
        imagePaths.forEach((path, index) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.imagesLoaded++;
                if (this.imagesLoaded === imagePaths.length) {
                    console.log('All fish images loaded');
                }
            };
            img.onerror = () => {
                console.error(`Failed to load ${path}`);
                this.imagesFailed++;
                // Create fallback placeholder image
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 50;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#4a90e2';
                ctx.beginPath();
                ctx.ellipse(50, 25, 45, 20, 0, 0, Math.PI * 2);
                ctx.fill();
                img.src = canvas.toDataURL();
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
        const schoolCentroids = new Map();
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
        
        // Use swap-and-pop for efficient removal (O(1) instead of O(n))
        let writeIndex = 0;
        for (let readIndex = 0; readIndex < this.sharks.length; readIndex++) {
            const shark = this.sharks[readIndex];
            
            // Handle dying fish - transform to bone and let bone fall slowly (linear, no rotation)
            if (shark.isDying) {
                // Initialize bone position (deltaTime-based falling, no real-time clock needed)
                if (shark.boneY === undefined) shark.boneY = shark.baseY;

                // Linear fall: pixels per ms (slow)
                const boneFallSpeed = 0.03; // px per ms (~30 px/s)
                if (typeof deltaTime === 'number') {
                    shark.boneY += boneFallSpeed * deltaTime;
                } else {
                    // fallback if deltaTime not provided
                    shark.boneY += boneFallSpeed * 16;
                }

                // Draw bone image at world coordinates, flipped to match original swim direction
                if (this.boneLoaded && this.boneImage) {
                    ctx.save();
                    ctx.globalAlpha = 1.0;
                    try {
                        const boneW = shark.size * 2;
                        const boneH = boneW * (this.boneImage.height / this.boneImage.width) || shark.size;
                        // Draw centered at (shark.x, shark.boneY) with horizontal flip when direction<0
                        ctx.translate(shark.x, shark.boneY);
                        if (shark.direction < 0) ctx.scale(-1, 1);
                        ctx.drawImage(this.boneImage, -boneW / 2, -boneH / 2, boneW, boneH);
                    } catch (e) {
                        // ignore draw error
                    }
                    ctx.restore();
                } else {
                    // Fallback placeholder sinking ellipse
                    ctx.save();
                    ctx.fillStyle = 'rgba(220,220,220,0.95)';
                    ctx.beginPath();
                    ctx.ellipse(shark.x, shark.boneY, shark.size, shark.size * 0.4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Remove when bone leaves viewport
                if (shark.boneY > height + 20) {
                    continue; // don't write back
                }

                // Keep shark entry until bone falls off
                this.sharks[writeIndex++] = shark;
                continue;
            }
            
            // Update position (frozen if being attacked)
            // Capture previous X to detect near-zero net movement later
            const prevX = shark.x;
            if (!shark.isBeingAttacked) {
                shark.x += shark.direction * shark.speed;
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
            const sizeNorm = 40;
            const sizeFactor = Math.max(0.5, shark.size / sizeNorm);
            const baseSeparationRadius = 40 * (1 + (sizeFactor - 1) * 1.5);

            // Centroid pull — spring-like: dead zone 20 px, progressive up to ~200 px
            const centroid = schoolCentroids.get(shark.schoolId);
            if (centroid && centroid.count > 1) {
                // Wrap-aware delta: pick the shorter path
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

            // Pairwise separation — only same school, max 10 checks
            // Applied only to x; baseY separation is minimal to avoid vertical pumping
            let separationX = 0;
            let separationY = 0;
            let sepChecks = 0;
            for (const other of this.sharks) {
                if (other === shark || other.isDying) continue;
                if (sepChecks++ >= 10) break;
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
            shark.baseY += separationY * 0.04; // nearly no vertical push
            
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
        
        ctx.save();
        ctx.translate(x, y);

        if (direction < 0) {
            ctx.scale(-1, 1);
        }

        // Apply per-fish glow overrides (pink for mated pair only)
        if (fishData && fishData.hasPinkGlow) {
            drawGlow(ctx, size, 'pink');
        }

        ctx.globalAlpha = 1.0;
        
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
        
        const imgWidth = size * 2;
        const imgHeight = size * (sharkImage.height / sharkImage.width) * 2;
        ctx.drawImage(sharkImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        
        ctx.restore();
    }
    
    spawnSchool(width, height) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        
        // Cycle through 3 archetypes: 0=shark, 1=normal fish (fish2), 2=curiousfish school
        // Pattern repeats: shark → normal → curious → shark → ...
        const archetype = this._schoolsSpawned % 3;
        const fishType = archetype === 0 ? 0 : archetype === 1 ? 1 : 3;
        let baseSize, schoolImage, fishCount, schoolSpeed;
        
        // shark.png - biggest fish: 30-120px, schools of 1-3
        if (fishType === 0) {
            schoolImage = this.fishImages[0];
            baseSize = 30 + Math.random() * 90;
            fishCount = 1 + Math.floor(Math.random() * 3);
            schoolSpeed = 0.55 + Math.random() * 0.45;
        }
        // fish2.png - smallest fish: 10-30px, schools of 10-15
        else if (fishType === 1) {
            schoolImage = this.fishImages[1];
            baseSize = 10 + Math.random() * 20;
            fishCount = 10 + Math.floor(Math.random() * 6);
            schoolSpeed = 1.5 + Math.random() * 1.0;
        }
        // fish1.png - medium fish: 20-40px, schools of 7-10
        else if (fishType === 2) {
            schoolImage = this.fishImages[2];
            baseSize = 20 + Math.random() * 20;
            fishCount = 7 + Math.floor(Math.random() * 4);
            schoolSpeed = 1.0 + Math.random() * 0.8;
        }
        // curiousfish.png - large fish: 30-120px, schools of 4-6
        else if (fishType === 3) {
            schoolImage = this.fishImages[3];
            baseSize = 30 + Math.random() * 90;
            fishCount = 4 + Math.floor(Math.random() * 3);
            schoolSpeed = 0.7 + Math.random() * 0.6;
        }
        
        const sizeVariation = 0.5 + Math.random();
        const speedVariation = 0.5 + Math.random();
        const countVariation = 0.7 + Math.random() * 0.6;
        
        baseSize *= sizeVariation;
        schoolSpeed *= speedVariation;
        fishCount = Math.max(1, Math.floor(fishCount * countVariation));
        
        const schoolSize = baseSize * this.config.size;
        
        // Respect vertical margins - fish spawn within safe zone
        const safeZoneTop = this.config.verticalMarginTop;
        const safeZoneBottom = height - this.config.verticalMarginBottom;
        const safeZoneHeight = safeZoneBottom - safeZoneTop;
        
        const schoolDepth = Math.random(); // 0-1
        const schoolY = safeZoneTop + (schoolDepth * safeZoneHeight);
        
        const schoolCenterX = direction > 0 ? -schoolSize * 2 : width + schoolSize * 2;
        
        const schoolWavePhase = Math.random() * Math.PI * 2;
        const schoolWaveSpeed = 0.0008 + Math.random() * 0.0006;
        const schoolWaveAmplitude = 8 + Math.random() * 10;
        
        for (let i = 0; i < fishCount; i++) {
            // Calculate individual fish size first
            const individualSize = schoolSize * (0.4 + Math.random() * 0.3);
            
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
    
    destroy() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        this.sharks = [];
    }
}

