import { 
    initiateMatingDance,
    updateMatingDance,
    completeMatingDance,
    spawnBabyFish as spawnBabyFishFromModule
} from '../curious-fish/scenarios/MatingScenario.js';
import {
    updateSwimAway,
    updateReverse,
    updateRetreat,
    updateIdleAttack,
    updateSchoolFishAttack
} from '../curious-fish/behaviors/AttackBehavior.js';
import {
    updateForcedTarget,
    findFoodTarget,
    calculateMovement,
    clampPosition,
    updateRotationAndAnimation as updateRotationAndAnimationModule,
    setTargetPoint as setTargetPointModule
} from '../curious-fish/behaviors/MovementBehavior.js';
import {
    drawFish as drawFishRenderer
} from '../curious-fish/render/CuriousFishRenderer.js';

/**
 * Fish behavior constants - Size multipliers for various behaviors
 * These define the spatial relationships and interaction distances
 */
const FISH_SIZE_FACTORS = {
    // Detection and interaction ranges
    MOUTH_DISTANCE: 0.9,        // Distance from center to mouth (90% of size)
    MOUTH_RADIUS: 0.3,          // Radius of mouth area (30% of size)
    FOV_ORIGIN_DISTANCE: 0.3,   // Field of view origin offset
    FOLLOW_DISTANCE: 0.5,       // Base follow distance multiplier
    
    // Attack and collision thresholds
    COLLISION_THRESHOLD: 0.5,   // Distance to consider collision (50% of size)
    NEAR_MOUSE_THRESHOLD: 0.8,  // Distance to consider near mouse cursor
    
    // Minimum distance thresholds
    MIN_CENTER_DISTANCE: 1.2,   // Minimum distance factor from center to food
};

/**
 * Icon spawn configuration - Centralized to avoid recreation on each call
 */
const ICON_SPAWN_CONFIG = {
    default: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.15 },
    heart: { distanceFactor: 0.45, sizeFactor: 0.1, yOffset: -25, maxAge: 800, velocityRange: 0.2 },
    lightning: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1000, velocityRange: 0.15 },
    food: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1000, velocityRange: 0.15 },
    star: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.15 },
    bubble: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.15 },
    zzz: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.1 },
    question: { distanceFactor: 0.3, sizeFactor: 0.12, yOffset: -30, maxAge: 1000, velocityRange: 0.15 },
    exclamation: { distanceFactor: 0.3, sizeFactor: 0.14, yOffset: -30, maxAge: 900, velocityRange: 0.2 }
};

/**
 * CuriousFishLayer - Interactive fish that follows the player's cursor.
 * Can eat food, attack any school fish, and mate with same-species fish.
 *
 * @class
 */
export class CuriousFishLayer {
    // Single source of truth for curious fish configuration
    static DEFAULT_CONFIG = {
        speed: 5.0,
        maxSpeed: 6.0,
        size: 20,
        maxFishSize: 150,
        followDistance: 50,
        rotationSpeed: 0.12,
        heartSpawnRate: 500,
        imageSrc: 'assets/images/fish/curiousfish.webp',
        showDebug: false,
        swimAwaySpeed: 3,
        enableBob: true
    };

    /**
     * Create a CuriousFishLayer
     * @param {Object} options - Configuration options
     * @param {number} [options.speed=5.0] - Fish movement speed
     * @param {number} [options.size=30] - Initial fish size
     * @param {number} [options.maxFishSize=150] - Maximum fish size
     */
    constructor(options = {}) {
        this.enabled = false;
        this.fish = null;
        this.mouseX = null;
        this.mouseY = null;
        this.hearts = [];
        this.isStaring = false;
        this.heartSpawnTimer = 0;
        this.manager = null;
        
        // Idle detection and attack behavior
        this.lastMouseMoveTime = performance.now();
        
        this.newFish = null;
        
        // School fish attack behavior
        this.targetSchoolFish = null;
        this.isAttackingSchoolFish = false;
        this.lastAttackTime = 0;
        this.attackCooldown = 2000; // 2 seconds cooldown between attacks
        
        this.fishImage = new Image();
        this.imageLoaded = false;
        
        // Game state
        this.gameState = 'idle'; // idle, spawning, playing
        
        // Dance/mating state - using extracted module
        this.danceState = null; // Will hold state object from MatingScenario module
        this.dancePartner = null;
        
        // Defensive copy of config to prevent external modifications
        this.config = {
            ...CuriousFishLayer.DEFAULT_CONFIG,
            ...options
        };
        
        // Load image once with config path
        this.fishImage.onload = () => {
            this.imageLoaded = true;
            this._fishDepthCache = this._buildDepthCache(this.fishImage);
            console.log('Curious fish image loaded');
        };
        
        this.fishImage.onerror = () => {
            console.error('Failed to load curious fish image:', this.config.imageSrc);
            this.imageLoaded = false;
        };
        
        this.fishImage.src = this.config.imageSrc;
        
        this.allFish = [];
        // Bone (skeleton) image for death fallback
        this.boneImage = new Image();
        this.boneLoaded = false;
        this.boneImage.onload = () => {
            this.boneLoaded = true;
            console.log('Fishbone image loaded');
        };
        this.boneImage.onerror = () => {
            console.warn('Failed to load fishbone image at assets/images/fish/fishbone.webp');
        };
        this.boneImage.src = 'assets/images/fish/fishbone.webp';

        this.skeletons = [];
        this._fishDepthCache = null;
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
    }
    
    init(width, height, canvasManager) {
        this.width = width;
        this.height = height;
        this.manager = canvasManager;
        
        // Initialize fish at bottom-center and let it swim up
        this.spawnFish();
        
        // Expose for console debugging:
        //   window.curiousFishLayer.setTargetPoint(x, y, { immediate: true })
        //   or use helper setCuriousTarget(x,y,{ immediate:true })
        if (typeof window !== 'undefined') {
            window.curiousFishLayer = this;
            window.setCuriousTarget = (x, y, opts) => { try { this.setTargetPoint(x, y, opts || {}); } catch (e) { console.error(e); } };
        }
        
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('touchmove', this.handleTouchMove, { passive: true });
        console.log('CuriousFishLayer initialized');
    }
    
    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.lastMouseMoveTime = Date.now();
    }

    handleTouchMove(e) {
        if (e.touches.length === 0) return;
        this.mouseX = e.touches[0].clientX;
        this.mouseY = e.touches[0].clientY;
        this.lastMouseMoveTime = Date.now();
    }
    
    onResize(width, height) {
        this.width = width;
        this.height = height;
    }
    
    
    render(ctx, currentTime, deltaTime, width, height) {
        if (!this.enabled || !this.fish) return;

        // Skeleton must render even when fish image is unavailable
        if (this.fish.isDying) {
            if (!this.fish.skeletonSpawned) {
                this.fish.skeletonSpawned = true;
                this.skeletons.push({
                    x: this.fish.x,
                    y: this.fish.y,
                    vx: (this.fish.velocityX || 0) / 16, // px/ms
                    vy: (this.fish.velocityY || 0) / 16,
                    flipScale: this.fish.flipScale,
                    size: this.fish.currentSize,
                    startTime: Date.now(),
                    lastUpdate: Date.now()
                });
                // Blood cloud at the point of death
                const fishLayer = this.manager && this.manager.getLayer('fish');
                if (fishLayer && fishLayer._spawnBloodBurst) {
                    fishLayer._spawnBloodBurst(this.fish.x, this.fish.y, this.fish.currentSize, null);
                }
            }
            this.drawSkeletons(ctx, height);
            return;
        }
        if (this.skeletons.length > 0) {
            this.drawSkeletons(ctx, height);
        }

        if (!this.imageLoaded) return;

        if (this.danceState) {
            this.updateDance(deltaTime, width, height);
            
            // Update animation
            this.fish.age += deltaTime;
            this.fish.swimPhase = (this.fish.age / 500) % 1;
            
            // Draw fish and partner
            this.drawFish(ctx);
            
            // Draw big heart if in phase 2 (kiss phase) and danceState still exists
            if (this.danceState && this.danceState.phase === 2 && this.danceState.bigHeart) {
                ctx.save();
                ctx.globalAlpha = this.danceState.bigHeart.opacity;
                ctx.fillStyle = '#ff69b4'; // Hot pink
                ctx.font = `${this.danceState.bigHeart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add glow effect
                ctx.shadowColor = '#ff69b4';
                ctx.shadowBlur = 30;
                
                ctx.fillText('❤️', this.danceState.bigHeart.x, this.danceState.bigHeart.y);
                ctx.restore();
            }
            
            this.updateHearts(deltaTime);
            this.drawHearts(ctx);
            return;
        }
        
        // isDying and skeleton rendering is now handled above the imageLoaded guard
        
        const currentTimestamp = Date.now();
        let timeSinceMouseMove = currentTimestamp - this.lastMouseMoveTime;
        
        // Forced target override: pokud je nastaven this._forcedTarget, ignoruj běžné cíle
        if (this._forcedTarget && !this.fish.isDying) {
            const forcedResult = updateForcedTarget(this.fish, this._forcedTarget);
            
            if (forcedResult.isComplete) {
                delete this._forcedTarget;
                this.fish.velocityX = 0;
                this.fish.velocityY = 0;
            } else {
                this.fish.velocityX = forcedResult.velocityX;
                this.fish.velocityY = forcedResult.velocityY;
                this.fish.targetFlipScale = forcedResult.targetFlipScale;
                this.fish.targetRotation = forcedResult.targetRotation;
                
                // pohyb a vykreslení (přeruší běžnou logiku renderu)
                this.updateRotationAndAnimation(deltaTime);
                this.fish.x += this.fish.velocityX;
                this.fish.y += this.fish.velocityY;
                this.drawFish(ctx);
                this.updateHearts(deltaTime);
                this.drawHearts(ctx);
                return;
            }
        }
        
        // Handle school fish attack - direct charge!
        if (this.isAttackingSchoolFish && this.targetSchoolFish) {
            const fishLayer = this.manager && this.manager.getLayer('fish');
            
            const attackResult = updateSchoolFishAttack(
                this.fish,
                this.targetSchoolFish,
                fishLayer,
                (target, newTargetSize) => {
                    this.fish.targetSize = newTargetSize;
                },
                () => {
                    // Defeat: trigger skeleton sequence — spawnFish() is called
                    // by drawSkeletons() once the bone falls off screen
                    this.fish.isDying = true;
                },
                () => this.spawnHeart(),
                (bx, by, angle) => {
                    if (fishLayer && fishLayer._spawnBloodBurst) {
                        fishLayer._spawnBloodBurst(bx, by, (this.fish.currentSize + (this.targetSchoolFish?.size || 30)) * 0.5, angle);
                    }
                },
                this.config.maxFishSize,
                currentTime
            );
            
            // Apply target mutations
            if (attackResult.targetMutations && this.targetSchoolFish) {
                Object.assign(this.targetSchoolFish, attackResult.targetMutations);
            }
            
            if (attackResult.attackComplete) {
                this.isAttackingSchoolFish = false;
                this.targetSchoolFish = null;
            } else if (attackResult.shouldDie) {
                // Fish respawned by defeat callback above
                this.isAttackingSchoolFish = false;
                this.targetSchoolFish = null;
            } else if (attackResult.velocityX !== undefined) {
                this.fish.velocityX = attackResult.velocityX;
                this.fish.velocityY = attackResult.velocityY;
                this.fish.targetFlipScale = attackResult.targetFlipScale;
                this.fish.targetRotation = attackResult.targetRotation;
                this.fish.x += this.fish.velocityX;
                this.fish.y += this.fish.velocityY;
                this.updateRotationAndAnimation(deltaTime);
                this.fish.glowColor = 'rgba(255,50,50,0.6)';
                this.drawFish(ctx);
                this.updateHearts(deltaTime);
                this.drawHearts(ctx);
                return;
            }
        }
        
        // Check for food
        let targetX = this.mouseX;
        let targetY = this.mouseY + 10;
        let targetIsFood = false;
        
        if (this.manager && this.manager.foodLayer && this.manager.foodLayer.getParticles().length > 0) {
            const foodResult = findFoodTarget(
                this.fish,
                this.manager.foodLayer.getParticles(),
                width,
                height,
                this.config.followDistance,
                (this.config && this.config.fovMultiplier !== undefined) ? this.config.fovMultiplier : 1.0,
                FISH_SIZE_FACTORS
            );
            
            // Apply mutations
            this.fish.targetedFood = foodResult.mutations.targetedFood;
            for (const { food, updates } of foodResult.mutations.foodUpdates) {
                Object.assign(food, updates);
            }
            
            // Process eaten food
            for (const eatenFood of foodResult.eatenFood) {
                this.fish.targetSize = Math.min(this.fish.targetSize * 1.015, this.config.maxFishSize);
                this.spawnHeart();
            }
            
            // Set target to chase food
            const foodToChase = foodResult.targetFood;
            if (foodToChase && !foodToChase.eaten) {
                targetX = foodToChase.x;
                targetY = foodToChase.y;
                targetIsFood = true;
            }
        }
        
        // Move fish towards target
        const movementResult = calculateMovement(
            this.fish,
            targetX,
            targetY,
            this.mouseX,
            this.mouseY,
            targetIsFood,
            this.config.maxSpeed,
            this.config.maxFishSize,
            this.config.followDistance,
            deltaTime,
            FISH_SIZE_FACTORS
        );
        
        this.fish.velocityX = movementResult.velocityX;
        this.fish.velocityY = movementResult.velocityY;
        if (movementResult.targetRotation !== undefined) {
            this.fish.targetRotation = movementResult.targetRotation;
        }
        if (movementResult.targetFlipScale !== undefined) {
            this.fish.targetFlipScale = movementResult.targetFlipScale;
        }
        if (movementResult.isFleeing !== undefined) {
            this.fish.isFleeing = movementResult.isFleeing;
        }
        if (movementResult.fleeTimer !== undefined) {
            this.fish.fleeTimer = movementResult.fleeTimer;
        }
        this.isStaring = movementResult.isStaring || false;
        
        this.updateRotationAndAnimation(deltaTime);
        this.fish.x += this.fish.velocityX;
        this.fish.y += this.fish.velocityY;
        
        const clampedPos = clampPosition(
            this.fish,
            width,
            height,
            this.config.size,
            false
        );
        this.fish.x = clampedPos.x;
        this.fish.y = clampedPos.y;
        
        // Animate size growth
        if (this.fish.currentSize !== this.fish.targetSize) {
            const sizeDiff = this.fish.targetSize - this.fish.currentSize;
            this.fish.currentSize += sizeDiff * 0.025;
            if (Math.abs(sizeDiff) < 0.1) {
                this.fish.currentSize = this.fish.targetSize;
            }
        }
        
        this.fish.age += deltaTime;
        this.fish.swimPhase = (this.fish.age / 800) % 1;
        
        // Update glow dynamically
        this.fish.glowColor = 'rgba(100,200,255,0.4)';
        
        if (!this.isAttackingSchoolFish) {
            this.drawFish(ctx);
        }
        
        this.updateHearts(deltaTime);
        this.drawHearts(ctx);
        this.drawTargetingCrosshair(ctx);
    }
    
    updateRotationAndAnimation(deltaTime) {
        const result = updateRotationAndAnimationModule(
            this.fish,
            deltaTime,
            this.config.rotationSpeed,
            this.config.maxFishSize
        );
        
        this.fish.rotation = result.rotation;
        this.fish.flipScale = result.flipScale;
        this.fish.age = result.age;
        this.fish.swimPhase = result.swimPhase;
    }
    
    /**
     * Set a movement/target point for the curious fish.
     * Called by spawnFish and external managers. opts.immediate -> apply direct velocity.
     */
    setTargetPoint(x, y, opts = {}) {
        if (!this.fish) return;
        
        const result = setTargetPointModule(
            this.fish,
            x,
            y,
            opts,
            this.config.maxSpeed
        );
        
        if (!result) return;
        
        this.fish.velocityX = result.velocityX;
        this.fish.velocityY = result.velocityY;
        this.fish.targetRotation = result.targetRotation;
        this.fish.targetFlipScale = result.targetFlipScale;
        
        if (result.forcedTarget) {
            this._forcedTarget = result.forcedTarget;
            // Clear other active actions
            this.isAttackingSchoolFish = false;
            this.fish.targetedFood = null;
        }
        
        // Enable layer if not enabled
        if (!this.enabled) {
            this.enabled = true;
            if (opts.hold || opts.immediate) {
                console.log('CuriousFishLayer enabled by setTargetPoint');
            }
        }
    }
    

    
    /**
     * Spawn an icon/symbol near the fish
     * @param {string} type - Icon type (heart, lightning, food, star, bubble, zzz, question, exclamation)
     */
    spawnIcon(type) {
        const config = ICON_SPAWN_CONFIG[type] || ICON_SPAWN_CONFIG.default;
        
        const distance = this.fish.currentSize * config.distanceFactor;
        const iconX = this.fish.x + Math.cos(this.fish.rotation) * distance * this.fish.flipScale;
        const iconY = this.fish.y + Math.sin(this.fish.rotation) * distance + config.yOffset;
        const baseSize = this.fish.currentSize * config.sizeFactor;
        
        this.hearts.push({
            x: iconX,
            y: iconY,
            velocityX: (Math.random() - 0.5) * config.velocityRange,
            velocityY: -0.35 - Math.random() * 0.2,
            age: 0,
            maxAge: config.maxAge,
            size: baseSize + Math.random() * baseSize * 0.4,
            type: type
        });
    }
    
    // Legacy spawn functions - deprecated in favor of consolidated spawnIcon()
    /**
     * @deprecated Use spawnIcon('heart') instead
     */
    spawnHeart() { this.spawnIcon('heart'); }
    
    /**
     * @deprecated Use spawnIcon('lightning') instead
     */
    spawnLightning() { this.spawnIcon('lightning'); }
    
    /**
     * @deprecated Use spawnIcon('food') instead
     */
    spawnFoodIcon() { this.spawnIcon('food'); }
    
    /**
     * @deprecated Use spawnIcon('star') instead
     */
    spawnStar() { this.spawnIcon('star'); }
    
    /**
     * @deprecated Use spawnIcon('bubble') instead
     */
    spawnBubble() { this.spawnIcon('bubble'); }
    
    /**
     * @deprecated Use spawnIcon('zzz') instead
     */
    spawnZzz() { this.spawnIcon('zzz'); }
    
    /**
     * @deprecated Use spawnIcon('question') instead
     */
    spawnQuestionMark() { this.spawnIcon('question'); }
    
    /**
     * @deprecated Use spawnIcon('exclamation') instead
     */
    spawnExclamationMark() { this.spawnIcon('exclamation'); }
    
    updateHearts(deltaTime) {
        let w = 0;
        for (let i = 0; i < this.hearts.length; i++) {
            const heart = this.hearts[i];
            heart.age += deltaTime;
            heart.x += heart.velocityX;
            heart.y += heart.velocityY;
            if (heart.age < heart.maxAge) {
                this.hearts[w++] = heart;
            }
        }
        this.hearts.length = w;
    }
    
    drawTargetingCrosshair(ctx) {
        if (!this.fish) return;
        const canvas = document.querySelector('canvas');
        if (!canvas || this.mouseX === null || this.mouseY === null) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = this.mouseX - rect.left;
        const mouseY = this.mouseY - rect.top;
        const fishLayer = this.manager && this.manager.getLayer('fish');
        if (!fishLayer || !fishLayer.sharks) return;
        let hoveredFish = null;
        
        for (const shark of fishLayer.sharks) {
            if (shark.isDying) continue;
            const sharkY = shark.baseY || shark.y;
            const dx = mouseX - shark.x;
            const dy = mouseY - sharkY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < shark.size) {
                hoveredFish = shark;
                break;
            }
        }
        if (!hoveredFish) return;
        
        // Pink for same-species (mating), red for others (attack)
        const isSameSpecies = hoveredFish.image?.src?.includes('curiousfish.png');
        const cursorColor = isSameSpecies ? '#ff69b4' : '#ff0000';
        
        ctx.save();
        ctx.strokeStyle = cursorColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const diameter = 1.5 * fontSize;
        const innerRadius = diameter * 0.3;
        const outerRadius = diameter * 0.5;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, outerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mouseX - outerRadius - 5, mouseY);
        ctx.lineTo(mouseX - innerRadius, mouseY);
        ctx.moveTo(mouseX + innerRadius, mouseY);
        ctx.lineTo(mouseX + outerRadius + 5, mouseY);
        ctx.moveTo(mouseX, mouseY - outerRadius - 5);
        ctx.lineTo(mouseX, mouseY - innerRadius);
        ctx.moveTo(mouseX, mouseY + innerRadius);
        ctx.lineTo(mouseX, mouseY + outerRadius + 5);
        ctx.stroke();
        ctx.fillStyle = cursorColor;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    drawHearts(ctx) {
        ctx.save();
        for (const heart of this.hearts) {
            const ageRatio = heart.age / heart.maxAge;
            const opacity = 1 - ageRatio;
            ctx.globalAlpha = opacity;
            if (heart.type === 'star') {
                ctx.fillStyle = '#ffdd00';
                ctx.font = `${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⭐', heart.x, heart.y);
            } else if (heart.type === 'bubble') {
                ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
                ctx.strokeStyle = 'rgba(150, 220, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(heart.x, heart.y, heart.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (heart.type === 'zzz') {
                ctx.fillStyle = '#cccccc';
                ctx.font = `${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Z', heart.x, heart.y);
            } else if (heart.type === 'lightning') {
                ctx.fillStyle = '#ffff00';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.font = `bold ${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeText('⚡', heart.x, heart.y);
                ctx.fillText('⚡', heart.x, heart.y);
            } else if (heart.type === 'food') {
                ctx.fillStyle = '#ff6b6b';
                ctx.font = `${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🍎', heart.x, heart.y);
            } else if (heart.type === 'question') {
                ctx.fillStyle = '#ffaa00';
                ctx.font = `bold ${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', heart.x, heart.y);
            } else if (heart.type === 'exclamation') {
                ctx.fillStyle = '#ff0000';
                ctx.font = `bold ${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', heart.x, heart.y);
            } else {
                // Hearts in romantic phase - pink color
                ctx.fillStyle = '#ff69b4';
                ctx.font = `${heart.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('❤️', heart.x, heart.y);
            }
        }
        ctx.restore();
    }
    
    drawFish(ctx) {
        if (!this.imageLoaded || this.fishImage.naturalWidth === 0) return;
        // Curious fish is always in the closest layer — use original image (tier 3 = no tint)
        const depthImage = (this._fishDepthCache) ? this._fishDepthCache[3] : this.fishImage;
        // Use extracted renderer module
        drawFishRenderer(
            ctx,
            this.fish,
            depthImage,
            this.config,
            this.isAttackingSchoolFish,
            this.targetSchoolFish,
            this.width,
            this.height
        );
    }
    
    startDance(partner) {
        // Use extracted MatingScenario module
        this.danceState = initiateMatingDance(this.fish, partner);
        this.dancePartner = partner;
    }
    
    updateDance(deltaTime, width, height) {
        if (!this.danceState || !this.dancePartner) return;
        
        // Use extracted MatingScenario module with callbacks
        const result = updateMatingDance(
            this.danceState,
            this.fish,
            this.dancePartner,
            deltaTime,
            width,
            height,
            (dt) => this.updateRotationAndAnimation(dt),
            () => this.spawnHeart(),
            performance.now()
        );
        
        // Update state from result
        this.danceState = result;
        
        // Check if dance completed
        if (result.completed) {
            const fishLayer = this.manager && this.manager.getLayer('fish');
            if (fishLayer && this.dancePartner && !this.dancePartner.isDying) {
                completeMatingDance(
                    this.fish,
                    this.dancePartner,
                    width,
                    height,
                    fishLayer,
                    (w, h, x, y, options, cfg) => spawnBabyFishFromModule(w, h, x, y, fishLayer, options, cfg)
                );
                
                this.fish.velocityX = 0;
                this.fish.velocityY = 0;
                
                // Clear dance state — game continues
                this.danceState = null;
                this.dancePartner = null;
            }
        }
    }
    
    spawnBabyFish(width, height, spawnX, spawnY, options = {}) {
        // Use extracted MatingScenario module
        const fishLayer = this.manager && this.manager.getLayer('fish');
        if (!fishLayer) return;
        
        return spawnBabyFishFromModule(
            width, 
            height, 
            spawnX, 
            spawnY, 
            fishLayer, 
            options, 
            this.config
        );
    }
    
    

    
    /**
     * Spawn the curious fish at bottom-center with initial upward velocity.
     * No parameters — uses this.width/this.height (or window) and last mouse pos.
     * Fish will "soft" swim toward last mouse position (if available) via setTargetPoint.
     */
    spawnFish() {
        const width = this.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
        const height = this.height || (typeof window !== 'undefined' ? window.innerHeight : 600);

        const spawnX = Math.round(-Math.max(40, this.config.size + 20));
        const spawnY = Math.round(height / 2);

        this.fish = {
            x: spawnX,
            y: spawnY,
            velocityX: 1.5, // initial swim-right
            velocityY: 0,
            rotation: 0,
            targetRotation: 0,
            flipScale: 1,
            targetFlipScale: 1,
            age: 0,
            swimPhase: 0,
            isFleeing: false,
            fleeTimer: 0,
            currentSize: this.config.size,
            targetSize: this.config.size,
            targetedFood: null,
            hidden: false,
            skeletonSpawned: false
        };

        // Basic resets
        this.isAttackingSchoolFish = false;
        this.targetSchoolFish = null;
        
        // Set game state to playing when fish spawns
        this.gameState = 'playing';

        // Clear any stale forced target from previous life
        delete this._forcedTarget;
    }
    
    /**
     * Pre-render 4 depth-tinted variants of a source image into OffscreenCanvases.
     * Mirrors FishLayer._buildDepthCache — shared logic kept in sync manually.
     */
    _buildDepthCache(sourceImage) {
        const TIERS = [
            { sat: 30, bri: 100 },
            { sat: 55, bri: 100 },
            { sat: 78, bri: 100 },
            null  // tier 3: original
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

    drawSkeletons(ctx, height) {
        const FALL_DURATION = 3000;  // ms padání
        const FADE_DURATION = 800;   // ms fadeoutu
        const GRAVITY = 0.0002;      // px/ms² underwater gravity
        const now = Date.now();
        let writeIdx = 0;
        let anyActive = false;
        for (let i = 0; i < this.skeletons.length; i++) {
            const sk = this.skeletons[i];
            const elapsed = now - sk.startTime;
            if (elapsed > FALL_DURATION + FADE_DURATION) continue; // smazat

            const dtSk = now - (sk.lastUpdate || now);
            sk.lastUpdate = now;
            sk.vy += GRAVITY * dtSk;
            sk.vx *= 1 - 0.003 * (dtSk / 16);
            sk.x += sk.vx * dtSk;
            sk.y += sk.vy * dtSk;

            // Alpha: 1.0 po dobu padání, pak lineárně na 0
            const alpha = elapsed < FALL_DURATION
                ? 1.0
                : 1.0 - (elapsed - FALL_DURATION) / FADE_DURATION;

            if (this.boneLoaded && this.boneImage) {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(sk.x, sk.y);
                ctx.scale(sk.flipScale, 1);
                const w = sk.size * 2;
                const h = w * (this.boneImage.height / this.boneImage.width);
                ctx.drawImage(this.boneImage, -w / 2, -h / 2, w, h);
                ctx.restore();
            }
            anyActive = true;
            this.skeletons[writeIdx++] = sk;
        }
        this.skeletons.length = writeIdx;
        if (!anyActive && this.fish && this.fish.isDying) {
            this.skeletons = [];
            this.spawnFish();
        }
    }

    /**
     * Cleanup resources and event listeners
     */
    destroy() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('touchmove', this.handleTouchMove);
        this.fish = null;
        this.hearts = [];
        this.allFish = [];
        this.skeletons = [];
        this.dancePartner = null;
        console.log('CuriousFishLayer destroyed');
    }
}
