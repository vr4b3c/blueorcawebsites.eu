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
 *
 * @param {Object} fish - Curious fish entity
 * @param {Object} partner - Partner school fish
 * @param {number} currentTime - Current timestamp from performance.now()
 * @returns {Object} Dance state object
 */
export function initiateMatingDance(fish, partner, currentTime = performance.now()) {
    console.log('Starting romantic dance with partner!');

    // Mark partner as dancing so FishLayer skips schooling/flocking for it
    partner.isDancing = true;
    if (partner.velocityX !== undefined) partner.velocityX = 0;
    if (partner.velocityY !== undefined) partner.velocityY = 0;

    return {
        phase: 0,           // 0=approach 1=choreography 2=kiss 3=complete
        startTime: currentTime,
        kissStartTime: null,
        bigHeart: null,
        progress: 0,
        danceStep: 0,
        danceSteps: null,   // built when phase 0 ends
        stepStartTime: null,
        _approachMax: null,
        _stepMidX: 0,
        _stepMidY: 0,
    };
}

// ── Private helpers ─────────────────────────────────────────────────────────

/** Build the ordered list of choreography steps for phase 1. */
function _buildDanceSteps() {
    return [
        { type: 'orbit_close', duration: 2800 },  // tight mutual orbit, 2.5 rotations
        { type: 'spin_flip',   duration: 2600 },  // side-by-side smooth X-axis barrel-rolls
        { type: 'spiral_in',   duration: 1600 },  // spiral inward until collision
    ];
}

/**
 * Execute one frame of a choreography step.
 * Returns true when all steps are done (= time to enter kiss phase).
 */
function _stepDanceChoreography(danceState, fish, partner, deltaTime, currentTime, spawnHeart) {
    const steps = danceState.danceSteps;
    if (!steps || danceState.danceStep >= steps.length) return true;

    const step = steps[danceState.danceStep];

    // Initialise per-step state once
    if (!danceState.stepStartTime) {
        danceState.stepStartTime = currentTime;
        // Lock midpoint at start of each step so fish don't drift away
        danceState._stepMidX = (fish.x + partner.x) / 2;
        danceState._stepMidY = (fish.y + (partner.baseY !== undefined ? partner.baseY : partner.y)) / 2;
        // Remember where fish is relative to center (start angle)
        danceState._baseAngle = Math.atan2(
            fish.y  - danceState._stepMidY,
            fish.x  - danceState._stepMidX
        );
    }

    const elapsed = currentTime - danceState.stepStartTime;
    const t       = Math.min(elapsed / step.duration, 1.0);
    const midX    = danceState._stepMidX;
    const midY    = danceState._stepMidY;
    // Tight radius — fish nearly touch (0.38 × combined size ≈ just over half-size gap each)
    const baseR   = Math.max(28, (fish.currentSize + partner.size) * 0.38);

    if (Math.random() < 0.04) spawnHeart();

    // ── orbit_close: tight CCW mutual orbit, both facing direction of travel ──
    if (step.type === 'orbit_close') {
        // 2.5 full rotations so they end on opposite sides → sets up spin_flip nicely
        const angle = danceState._baseAngle + t * Math.PI * 5;

        fish.x        = midX + Math.cos(angle) * baseR;
        fish.y        = midY + Math.sin(angle) * baseR;
        fish.velocityX = 0; fish.velocityY = 0;
        fish.rotation  = 0; fish.targetRotation = 0;

        // Face direction of travel: CCW tangent dx = -sin(angle)
        const goRight = -Math.sin(angle) >= 0;
        fish.flipScale       = goRight ? 1 : -1;
        fish.targetFlipScale = fish.flipScale;

        partner.x = midX + Math.cos(angle + Math.PI) * baseR;
        const pY  = midY + Math.sin(angle + Math.PI) * baseR;
        if (partner.baseY !== undefined) partner.baseY = pY; else partner.y = pY;
        partner.direction = goRight ? -1 : 1;  // 180° opposite
        partner.flipX     = undefined;          // no smooth flip yet

    // ── spin_flip: side-by-side smooth barrel-rolls along X axis ─────────────
    } else if (step.type === 'spin_flip') {
        const N          = 3;                         // number of full flips
        const flipAngle  = t * N * Math.PI * 2;      // 0 → 6π
        const yBounce    = Math.sin(flipAngle) * (fish.currentSize * 0.38);
        const r          = baseR;

        // Curious fish — left side
        fish.x        = midX - r;
        fish.y        = midY + yBounce;
        fish.velocityX = 0; fish.velocityY = 0;
        fish.rotation  = 0; fish.targetRotation = 0;
        // Smooth X rotation: set flipScale directly (bypasses the 0.20 lerp)
        fish.flipScale       = Math.cos(flipAngle);
        fish.targetFlipScale = fish.flipScale;

        // Partner — right side, opposite bounce phase & inverted flip phase
        partner.x = midX + r;
        const pY  = midY - yBounce;   // counter-phase bounce
        if (partner.baseY !== undefined) partner.baseY = pY; else partner.y = pY;
        // flipX drives ctx.scale in drawShark for smooth rotation
        partner.flipX     = Math.cos(flipAngle + Math.PI); // 180° offset → anti-phase
        partner.direction = partner.flipX >= 0 ? -1 : 1;  // fallback (unused while flipX set)

        // Hearts burst every time fish are edge-on (squish zero)
        if (Math.abs(Math.cos(flipAngle)) < 0.12 && Math.random() < 0.45) spawnHeart();

    // ── spiral_in: shrinking orbit until collision at midpoint ───────────────
    } else if (step.type === 'spiral_in') {
        // easeIn: slow start, fast finish for dramatic effect
        const ease    = t * t;
        const spiralR = baseR * (1 - ease);
        // Quarter-orbit so they arrive face-to-face
        const angle   = danceState._baseAngle + t * Math.PI * 0.5;

        fish.x        = midX + Math.cos(angle) * spiralR;
        fish.y        = midY + Math.sin(angle) * spiralR;
        fish.velocityX = 0; fish.velocityY = 0;
        fish.rotation  = 0; fish.targetRotation = 0;

        const goRight = -Math.sin(angle) >= 0;
        fish.flipScale       = goRight ? 1 : -1;
        fish.targetFlipScale = fish.flipScale;

        partner.x = midX + Math.cos(angle + Math.PI) * spiralR;
        const pY  = midY + Math.sin(angle + Math.PI) * spiralR;
        if (partner.baseY !== undefined) partner.baseY = pY; else partner.y = pY;
        partner.direction = goRight ? -1 : 1;
        partner.flipX     = undefined;  // clear smooth flip from previous step

        // Increasing heart rate as they converge
        if (Math.random() < 0.04 + ease * 0.18) spawnHeart();
    }

    if (t >= 1.0) {
        danceState.danceStep++;
        danceState.stepStartTime = null;
        return danceState.danceStep >= steps.length;
    }
    return false;
}

/**
 * Update mating dance state — one frame.
 * Phases: 0=approach  1=choreography  2=kiss  3=complete
 *
 * @param {Object} danceState
 * @param {Object} fish - Curious fish entity
 * @param {Object} partner - Partner school fish
 * @param {number} deltaTime
 * @param {number} width
 * @param {number} height
 * @param {Function} updateRotationAndAnimation
 * @param {Function} spawnHeart
 * @param {number} currentTime
 * @returns {Object} Updated danceState
 */
export function updateMatingDance(danceState, fish, partner, deltaTime, width, height, updateRotationAndAnimation, spawnHeart, currentTime) {
    if (!partner) return { ...danceState, completed: true };
    if (partner.isDying) {
        // Partner killed mid-dance (e.g. by das) — abort cleanly
        if (partner.isDancing) {
            partner.isDancing = false;
            delete partner.flipX;
        }
        return { ...danceState, completed: true };
    }

    const partnerY = partner.baseY !== undefined ? partner.baseY : partner.y;

    // ── Phase 0: Approach ─────────────────────────────────────────────────
    if (danceState.phase === 0) {
        const targetDistance = (fish.currentSize + partner.size) * 0.9;
        const dx = partner.x - fish.x;
        const dy = partnerY - fish.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        danceState._approachMax = danceState._approachMax || Math.max(dist, 300);
        danceState.progress = Math.min(0.22, (1 - dist / danceState._approachMax) * 0.22);

        if (dist > targetDistance) {
            const speed = 2.5;
            const nx = dx / dist;
            const ny = dy / dist;

            // Curious fish swims toward partner
            fish.velocityX = nx * speed;
            fish.velocityY = ny * speed;
            fish.x += fish.velocityX;
            fish.y += fish.velocityY;

            // Partner swims toward curious fish at higher speed to break from school
            partner.x -= nx * speed * 1.3;
            if (partner.baseY !== undefined) partner.baseY -= ny * speed * 1.3;
            else partner.y -= ny * speed * 1.3;
            partner.age = (partner.age || 0) + deltaTime;

            // Curious fish faces partner
            const angleToPartner = Math.atan2(dy, dx);
            fish.targetFlipScale = (Math.abs(angleToPartner) > Math.PI / 2) ? -1 : 1;
            fish.targetRotation  = fish.targetFlipScale === 1 ? angleToPartner : Math.PI - angleToPartner;

            // Partner faces curious fish
            const angleToUs = Math.atan2(-dy, -dx);
            partner.direction = (angleToUs > -Math.PI / 2 && angleToUs < Math.PI / 2) ? 1 : -1;

            updateRotationAndAnimation(deltaTime);
            if (Math.random() < 0.02) spawnHeart();

        } else {
            // Close enough — enter choreography phase
            fish.velocityX = 0;
            fish.velocityY = 0;
            fish.targetRotation = 0;
            fish.rotation = 0;
            danceState.phase = 1;
            danceState.danceStep = 0;
            danceState.danceSteps = _buildDanceSteps();
            danceState.stepStartTime = null;
            danceState.progress = 0.22;
        }

    // ── Phase 1: Choreography ─────────────────────────────────────────────
    } else if (danceState.phase === 1) {
        const totalSteps = danceState.danceSteps ? danceState.danceSteps.length : 1;
        const done = _stepDanceChoreography(danceState, fish, partner, deltaTime, currentTime, spawnHeart);

        if (done) {
            // Clear partner's smooth flipX before entering kiss phase
            delete partner.flipX;
            danceState.phase = 2;
            danceState.kissStartTime = currentTime;
            danceState.bigHeart = null;
            danceState.progress = 0.70;
        } else {
            const step   = danceState.danceStep;
            const stepDur = danceState.danceSteps[step].duration;
            const stepT   = danceState.stepStartTime
                ? Math.min((currentTime - danceState.stepStartTime) / stepDur, 1)
                : 0;
            danceState.progress = 0.22 + ((step + stepT) / totalSteps) * 0.48;
        }

    // ── Phase 2: Kiss ─────────────────────────────────────────────────────
    } else if (danceState.phase === 2) {
        const kissTime = currentTime - danceState.kissStartTime;
        const kissDuration = 2000;
        danceState.progress = 0.70 + Math.min(kissTime / kissDuration, 1) * 0.30;

        if (kissTime < kissDuration) {
            const midX = (fish.x + partner.x) / 2;
            const midY = (fish.y + (partner.baseY !== undefined ? partner.baseY : partner.y)) / 2;

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
                const p = kissTime / 500;
                danceState.bigHeart.size    = danceState.bigHeart.targetSize * p;
                danceState.bigHeart.opacity = p;
            } else if (kissTime < 1500) {
                danceState.bigHeart.size    = danceState.bigHeart.targetSize;
                danceState.bigHeart.opacity = 1;
                danceState.bigHeart.x = midX;
                danceState.bigHeart.y = midY;
            } else {
                danceState.bigHeart.opacity = 1 - (kissTime - 1500) / 500;
            }

            if (Math.random() < 0.06) spawnHeart();

        } else {
            danceState.phase = 3;
            danceState.progress = 1.0;
        }

    // ── Phase 3: Complete ─────────────────────────────────────────────────
    } else if (danceState.phase === 3) {
        danceState.progress  = 1.0;
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

    const spawnX = (fish.x + partner.x) / 2;
    const spawnY = (fish.y + (partner.baseY !== undefined ? partner.baseY : partner.y)) / 2;

    // Give the partner a truly solo schoolId (count=1 → no centroid pull ever again)
    // and keep whatever direction it was already facing after the dance.
    const soloSchoolId = `solo_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    partner.schoolId      = soloSchoolId;
    partner.isIndependent = true;   // FishLayer: skip centroid + pairwise separation
    partner.isBeingAttacked = false;
    partner.passive       = true;
    partner.bornAt        = performance.now(); // for FishLayer lifespan culling
    partner.speed         = Math.max(0.4, (partner.speed || 0.6) * 0.8);
    // direction is already set correctly by the nuzzle step — do NOT override it

    // Babies share a separate school so they flock together (not with the parent)
    const babySchoolId  = `family_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const babyDirection = partner.direction;
    spawnBabyFish(width, height, spawnX, spawnY, { promoteNewCurious: false, schoolId: babySchoolId, direction: babyDirection });

    fish.velocityX = 0;
    fish.velocityY = 0;

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

    // Respect the global fish cap — skip spawn if already at limit
    const MAX_FISH = 150;
    if (fishLayer.sharks && fishLayer.sharks.length >= MAX_FISH) return 0;

    const curiousFishImage = fishLayer.fishImages && fishLayer.fishImages[3]; // curiousfish.png
    const promoteNewCurious = !!options.promoteNewCurious;
    const providedSchoolId = options.schoolId;
    const providedDirection = options.direction;

    for (let i = 0; i < babyCount; i++) {
        const burstAngle = Math.random() * Math.PI * 2;
        const burstSpeed = 2.5 + Math.random() * 2.0;

        const baby = {
            x: spawnX,
            baseY: spawnY,
            y: 0,
            direction: (typeof providedDirection !== 'undefined') ? providedDirection : (Math.random() > 0.5 ? 1 : -1),
            speed: 0.3 + Math.random() * 0.3,
            baseSpeed: 0.3 + Math.random() * 0.3,
            size: 20,
            burstVX: Math.cos(burstAngle) * burstSpeed,
            burstVY: Math.sin(burstAngle) * burstSpeed,
            age: 0,
            schoolWavePhase: Math.random() * Math.PI * 2,
            schoolWaveSpeed: 0.001 + Math.random() * 0.0005,
            schoolWaveAmplitude: 8 + Math.random() * 4,
            verticalPeriod: 3000 + Math.random() * 2000,
            verticalAmplitude: 3 + Math.random() * 3,
            depthTier: 3,
            image: curiousFishImage,
            _imageIndex: 3, // fishImages[3] = curiousfish.webp — O(1) lookup in drawShark
            isDying: false,
            bornAt: performance.now() // for FishLayer lifespan culling
        };

        // If a schoolId was provided, assign babies to that school so they flock together
        if (providedSchoolId) baby.schoolId = providedSchoolId;

        if (fishLayer?.sharks) {
            fishLayer.sharks.push(baby);
        }
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
