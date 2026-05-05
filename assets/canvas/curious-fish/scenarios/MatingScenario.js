/**
 * MatingScenario - Handles the romantic mating dance between curious fish and partner
 * EXTRACTED AS-IS from CuriousFishLayer
 * 
 * Multi-phase dance sequence:
 * Phase 0: Approach - fish swim towards each other
 * Phase 1: Transformations - flips and rotations
 * Phase 2: The Kiss - big heart appears
 * Phase 3: End - spawn baby fish, convert pair to passive school fish
 */

/**
 * Initialize mating dance scenario
 * EXTRACTED AS-IS from CuriousFishLayer.startDance()
 * 
 * @param {Object} fish - Curious fish entity
 * @param {Object} partner - Partner school fish
 * @param {number} currentTime - Current timestamp from performance.now()
 * @returns {Object} Dance state object
 */
export function initiateMatingDance(fish, partner, currentTime = performance.now()) {
    console.log('Starting romantic dance with partner!');
    
    // Mark partner as dancing so FishLayer freezes it
    partner.isDancing = true;
    if (partner.velocityX !== undefined) partner.velocityX = 0;
    if (partner.velocityY !== undefined) partner.velocityY = 0;

    // Do NOT teleport — let phase 0 swim them together naturally
    return {
        phase: 0,
        startTime: currentTime,
        transformStartTime: null,
        kissStartTime: null,
        flipCount: 0,
        bigHeart: null,
        progress: 0
    };
}

/**
 * Update mating dance state
 * EXTRACTED AS-IS from CuriousFishLayer.updateDance()
 * 
 * @param {Object} danceState - Current dance state
 * @param {Object} fish - Curious fish entity
 * @param {Object} partner - Partner school fish
 * @param {number} deltaTime - Delta time in ms
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Function} updateRotationAndAnimation - Rotation update callback
 * @param {Function} spawnHeart - Heart spawn callback
 * @param {number} currentTime - Current timestamp from performance.now()
 * @returns {Object} Updated dance state with { phase, progress, bigHeart, completed }
 */
export function updateMatingDance(danceState, fish, partner, deltaTime, width, height, updateRotationAndAnimation, spawnHeart, currentTime) {
    if (!partner) return { ...danceState, completed: true };
    
    const partnerY = partner.baseY || partner.y;
    
    if (danceState.phase === 0) {
        // Phase 0: Both fish swim slowly towards each other face-to-face
        const targetDistance = (fish.currentSize + partner.size) * 0.9;
        const dx = partner.x - fish.x;
        const dy = partnerY - fish.y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Progress 0% → 50% during approach
        const approachMax = Math.max(currentDistance, 300);
        danceState._approachMax = danceState._approachMax || approachMax;
        const approachProgress = Math.min(1, 1 - (currentDistance / danceState._approachMax));
        danceState.progress = approachProgress * 0.5;
        
        if (currentDistance > targetDistance) {
            const speed = 1.5; // Slow romantic approach
            const nx = dx / currentDistance;
            const ny = dy / currentDistance;
            fish.velocityX = nx * speed;
            fish.velocityY = ny * speed;
            fish.x += fish.velocityX;
            fish.y += fish.velocityY;
            
            // Move partner towards curious fish
            partner.x -= nx * speed * 0.5;
            if (typeof partner.baseY !== 'undefined') partner.baseY -= ny * speed * 0.5;
            else partner.y -= ny * speed * 0.5;
            
            // Update partner's age for swim animation
            if (!partner.age) partner.age = 0;
            partner.age += deltaTime;
            
            // Face partner (curious fish)
            const angleToPartner = Math.atan2(dy, dx);
            if (angleToPartner > Math.PI/2 || angleToPartner < -Math.PI/2) {
                fish.targetFlipScale = -1;
                fish.targetRotation = Math.PI - angleToPartner;
            } else {
                fish.targetFlipScale = 1;
                fish.targetRotation = angleToPartner;
            }
            
            // Partner faces curious fish
            const angleToUs = Math.atan2(-dy, -dx);
            partner.direction = (angleToUs > Math.PI/2 || angleToUs < -Math.PI/2) ? -1 : 1;
            updateRotationAndAnimation(deltaTime);
            
            // Spawn hearts during approach
            if (Math.random() < 0.02) spawnHeart();
        } else {
            // Close enough - move to kiss phase
            fish.velocityX = 0;
            fish.velocityY = 0;
            danceState.phase = 1;
            danceState.kissStartTime = currentTime;
            danceState.progress = 0.5;
            console.log('Mating: The Kiss!');
        }
    } else if (danceState.phase === 1) {
        // Phase 1: The Kiss - big heart appears
        const kissTime = currentTime - danceState.kissStartTime;
        const kissDuration = 2000;
        
        // Progress 50% → 100% during kiss
        danceState.progress = 0.5 + (Math.min(kissTime / kissDuration, 1) * 0.5);
        
        if (kissTime < kissDuration) {
            const midX = (fish.x + partner.x) / 2;
            const midY = (fish.y + (partner.baseY || partner.y)) / 2;
            
            if (!danceState.bigHeart) {
                danceState.bigHeart = {
                    x: midX,
                    y: midY,
                    size: 0,
                    targetSize: Math.max(fish.currentSize, partner.size) * 1.5,
                    opacity: 0
                };
            }
            
            if (kissTime < 500) {
                const progress = kissTime / 500;
                danceState.bigHeart.size = danceState.bigHeart.targetSize * progress;
                danceState.bigHeart.opacity = progress;
            } else if (kissTime < 1500) {
                danceState.bigHeart.size = danceState.bigHeart.targetSize;
                danceState.bigHeart.opacity = 1;
                danceState.bigHeart.x = midX;
                danceState.bigHeart.y = midY;
            } else {
                const fadeProgress = (kissTime - 1500) / 500;
                danceState.bigHeart.opacity = 1 - fadeProgress;
            }
        } else {
            danceState.phase = 2;
            danceState.progress = 1.0;
            console.log('Mating complete - spawning babies');
        }
    } else if (danceState.phase === 2) {
        // Phase 2: Mark as completed
        danceState.progress = 1.0;
        danceState.completed = true;
    }
    
    return danceState;
}

/**
 * Complete mating dance - spawn babies and convert pair to passive school fish
 * EXTRACTED AS-IS from CuriousFishLayer.updateDance() phase 3
 * 
 * @param {Object} fish - Curious fish entity
 * @param {Object} partner - Partner school fish
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} fishLayer - Reference to FishLayer
 * @param {Function} spawnBabyFish - Baby spawn callback
 * @returns {Object} Result with { completed: true, hasReproduced: true, gameComplete: true }
 */
export function completeMatingDance(fish, partner, width, height, fishLayer, spawnBabyFish) {
    partner.isDancing = false;
    
    // Spawn baby fish but DO NOT promote any baby to be the new curious fish
    // The game should enter a completed state and wait for a user restart.
    const spawnX = (fish.x + partner.x) / 2;
    const spawnY = (fish.y + (partner.baseY || partner.y)) / 2;

    // Generate a shared school id for the new family so they flock together
    const newSchoolId = `pair_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    // determine pair direction (use curious fish position relative to center)
    const pairDirection = (fish.x >= (width/2)) ? 1 : -1;
    
    // assign to partner (existing school fish)
    if (partner) {
        partner.schoolId = newSchoolId;
        partner.direction = pairDirection;
    }

    spawnBabyFish(width, height, spawnX, spawnY, { promoteNewCurious: false, schoolId: newSchoolId, direction: pairDirection });

    // Convert partner (existing school fish) to passive fish (no glow)
    if (fishLayer) {
        try {
            partner.hasPinkGlow = false;
            partner.isDancing = false;
            partner.isBeingAttacked = false;
            partner.passive = true;
            partner.speed = Math.max(0.2, (partner.speed || 0.3) * 0.6);
            partner.direction = (partner.x >= (width/2)) ? 1 : -1;
        } catch (e) {
            console.warn('Failed to convert partner to passive school fish', e);
        }

        // Create a new passive school fish representing the curious fish
        const curiousFishImage = fishLayer.fishImages && fishLayer.fishImages[3];
        const pairFish = {
            x: fish.x,
            baseY: fish.y,
            y: 0,
            direction: (fish.x >= (width/2)) ? 1 : -1,
            speed: 0.6,
            size: fish.currentSize,
            age: 0,
            schoolWavePhase: (partner && partner.schoolWavePhase) ? partner.schoolWavePhase : Math.random() * Math.PI * 2,
            schoolWaveSpeed: 0.0003 + Math.random() * 0.0002,
            schoolWaveAmplitude: 8 + Math.random() * 4,
            verticalPeriod: 3000 + Math.random() * 2000,
            verticalAmplitude: 3 + Math.random() * 3,
            image: curiousFishImage,
            isDying: false,
            passive: true,
            schoolId: newSchoolId
        };
        if (fishLayer?.sharks) {
            fishLayer.sharks.push(pairFish);
        }
    }

    // Stop fish movement
    fish.velocityX = 0;
    fish.velocityY = 0;

    console.log('Dance ended - pair converted to passive pink-glowing fish and swam away');
    
    return {
        completed: true,
        hasReproduced: true
    };
}

/**
 * Spawn baby fish after mating
 * EXTRACTED AS-IS from CuriousFishLayer.spawnBabyFish()
 * 
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} spawnX - Spawn X position
 * @param {number} spawnY - Spawn Y position
 * @param {Object} fishLayer - Reference to FishLayer
 * @param {Object} options - { promoteNewCurious, schoolId, direction }
 * @param {Object} config - Layer config
 * @returns {number} Baby count spawned
 */
export function spawnBabyFish(width, height, spawnX, spawnY, fishLayer, options = {}, config) {
    const babyCount = 3 + Math.floor(Math.random() * 3); // 3-5 babies
    
    if (!fishLayer) return 0;

    const curiousFishImage = fishLayer.fishImages && fishLayer.fishImages[3]; // curiousfish.png
    const promoteNewCurious = !!options.promoteNewCurious;
    const providedSchoolId = options.schoolId;
    const providedDirection = options.direction;

    for (let i = 0; i < babyCount; i++) {
        const angle = (i / babyCount) * Math.PI * 2;
        const distance = 50 + Math.random() * 30;

        const baby = {
            x: spawnX + Math.cos(angle) * distance,
            baseY: spawnY + Math.sin(angle) * distance,
            y: 0,
            direction: (typeof providedDirection !== 'undefined') ? providedDirection : (Math.random() > 0.5 ? 1 : -1),
            speed: 0.3 + Math.random() * 0.3,
            size: 15 + Math.random() * 10,
            age: 0,
            schoolWavePhase: Math.random() * Math.PI * 2,
            schoolWaveSpeed: 0.001 + Math.random() * 0.0005,
            schoolWaveAmplitude: 8 + Math.random() * 4,
            verticalPeriod: 3000 + Math.random() * 2000,
            verticalAmplitude: 3 + Math.random() * 3,
            image: curiousFishImage,
            isDying: false
        };

        // If a schoolId was provided, assign babies to that school so they flock together
        if (providedSchoolId) baby.schoolId = providedSchoolId;

        if (fishLayer?.sharks) {
            fishLayer.sharks.push(baby);
        }
        console.log(`Baby fish ${i + 1} spawned in school!`);
    }

    // If promotion requested, promote a random baby to be the new curious fish
    // NOT USED in current flow (always false)
    if (promoteNewCurious && config) {
        const index = Math.floor(Math.random() * Math.min(babyCount, fishLayer.sharks.length));
        const promoted = fishLayer.sharks[index];
        if (promoted) {
            return {
                promoteToNewFish: true,
                x: promoted.x,
                y: promoted.baseY || promoted.y,
                size: config.size
            };
        }
    }
    
    return babyCount;
}
