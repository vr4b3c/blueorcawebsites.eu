/**
 * AttackBehavior - Handles all attack-related behaviors for curious fish
 * EXTRACTED AS-IS from CuriousFishLayer
 * 
 * Attack types:
 * 1. Idle attacks at cursor (reverse -> charge -> retreat -> swim away after 3)
 * 2. School fish attacks (direct charge at clicked school fish)
 */

/**
 * Update swimming away behavior (after idle attacks)
 * EXTRACTED AS-IS from CuriousFishLayer lines ~439-468, 558-586
 * 
 * @param {Object} fish - Fish entity
 * @param {number} currentTimestamp - Current timestamp
 * @param {number} swimAwayStartTime - When swim away started
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 * @param {number} deltaTime - Delta time
 * @returns {Object} { isComplete: boolean, velocityX, velocityY, targetRotation, targetFlipScale }
 */
export function updateSwimAway(fish, currentTimestamp, swimAwayStartTime, mouseX, mouseY, deltaTime) {
    const swimDuration = currentTimestamp - swimAwayStartTime;
    if (swimDuration > 2000) {
        return {
            isComplete: true,
            velocityX: 0,
            velocityY: 0
        };
    }
    
    let velocityX = fish.velocityX;
    let velocityY = fish.velocityY;
    let targetRotation = fish.targetRotation;
    let targetFlipScale = fish.targetFlipScale;
    
    if (mouseX !== null && mouseY !== null) {
        const dx = fish.x - mouseX;
        const dy = fish.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const swimSpeed = 2.5;
            velocityX = (dx / distance) * swimSpeed;
            velocityY = (dy / distance) * swimSpeed;
            const angleAway = Math.atan2(dy, dx);
            targetRotation = angleAway;
            targetFlipScale = Math.cos(angleAway) > 0 ? 1 : -1;
        }
    }
    
    return {
        isComplete: false,
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale
    };
}

/**
 * Update reversing behavior (before idle attack)
 * EXTRACTED AS-IS from CuriousFishLayer lines ~517-554
 * 
 * @param {Object} fish - Fish entity
 * @param {number} currentTimestamp - Current timestamp
 * @param {number} reverseStartTime - When reverse started
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 * @returns {Object} { isComplete: boolean, shouldStartAttack: boolean, velocityX, velocityY, targetRotation, targetFlipScale }
 */
export function updateReverse(fish, currentTimestamp, reverseStartTime, mouseX, mouseY) {
    const reverseDuration = currentTimestamp - reverseStartTime;
    if (reverseDuration > 600) {
        return {
            isComplete: true,
            shouldStartAttack: true
        };
    }
    
    let velocityX = fish.velocityX;
    let velocityY = fish.velocityY;
    let targetRotation = fish.targetRotation;
    let targetFlipScale = fish.targetFlipScale;
    
    if (mouseX !== null && mouseY !== null) {
        const dx = fish.x - mouseX;
        const dy = fish.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const reverseSpeed = 0.8;
            velocityX = (dx / distance) * reverseSpeed;
            velocityY = (dy / distance) * reverseSpeed;
            const angleToMouse = Math.atan2(-dy, -dx);
            if (angleToMouse > Math.PI / 2) {
                targetFlipScale = -1;
                targetRotation = Math.PI - angleToMouse;
            } else if (angleToMouse < -Math.PI / 2) {
                targetFlipScale = -1;
                targetRotation = -Math.PI - angleToMouse;
            } else {
                targetFlipScale = 1;
                targetRotation = angleToMouse;
            }
        }
    }
    
    return {
        isComplete: false,
        shouldStartAttack: false,
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale
    };
}

/**
 * Update retreat behavior (after idle attack)
 * EXTRACTED AS-IS from CuriousFishLayer lines ~589-621
 * 
 * @param {Object} fish - Fish entity
 * @param {number} retreatTargetX - Retreat target X
 * @param {number} retreatTargetY - Retreat target Y
 * @returns {Object} { isComplete: boolean, velocityX, velocityY, targetRotation, targetFlipScale }
 */
export function updateRetreat(fish, retreatTargetX, retreatTargetY) {
    const dx = retreatTargetX - fish.x;
    const dy = retreatTargetY - fish.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 20) {
        return {
            isComplete: true,
            velocityX: 0,
            velocityY: 0
        };
    }
    
    const retreatSpeed = 3.0;
    const velocityX = (dx / distance) * retreatSpeed;
    const velocityY = (dy / distance) * retreatSpeed;
    const angleToTarget = Math.atan2(dy, dx);
    
    let targetFlipScale, targetRotation;
    if (angleToTarget > Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = Math.PI - angleToTarget;
    } else if (angleToTarget < -Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = -Math.PI - angleToTarget;
    } else {
        targetFlipScale = 1;
        targetRotation = angleToTarget;
    }
    
    return {
        isComplete: false,
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale
    };
}

/**
 * Update idle attack behavior (charging at cursor)
 * EXTRACTED AS-IS from CuriousFishLayer lines ~624-667
 * 
 * @param {Object} fish - Fish entity
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 * @param {number} currentTimestamp - Current timestamp
 * @param {number} idleAttackCount - Current idle attack count
 * @param {number} maxIdleAttacks - Max idle attacks before swimming away
 * @param {number} reverseStartX - Original reverse position X
 * @param {number} reverseStartY - Original reverse position Y
 * @param {Object} FISH_SIZE_FACTORS - Size factor constants
 * @returns {Object} { shouldRetreat, shouldSwimAway, velocityX, velocityY, targetRotation, targetFlipScale }
 */
export function updateIdleAttack(fish, mouseX, mouseY, currentTimestamp, idleAttackCount, maxIdleAttacks, reverseStartX, reverseStartY, FISH_SIZE_FACTORS) {
    if (mouseX === null || mouseY === null) {
        return { shouldRetreat: false, shouldSwimAway: false };
    }
    
    const dx = mouseX - fish.x;
    const dy = mouseY - fish.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < fish.currentSize * FISH_SIZE_FACTORS.NEAR_MOUSE_THRESHOLD) {
        if (idleAttackCount >= maxIdleAttacks) {
            console.log('Fish tired after 3 attacks, swimming away...');
            return {
                shouldRetreat: false,
                shouldSwimAway: true
            };
        } else {
            console.log('Fish reached cursor, retreating to original position!');
            return {
                shouldRetreat: true,
                shouldSwimAway: false,
                retreatTargetX: reverseStartX,
                retreatTargetY: reverseStartY
            };
        }
    }
    
    const attackSpeed = 7.5;
    const velocityX = (dx / distance) * attackSpeed;
    const velocityY = (dy / distance) * attackSpeed;
    const angleToMouse = Math.atan2(dy, dx);
    
    let targetFlipScale, targetRotation;
    if (angleToMouse > Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = Math.PI - angleToMouse;
    } else if (angleToMouse < -Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = -Math.PI - angleToMouse;
    } else {
        targetFlipScale = 1;
        targetRotation = angleToMouse;
    }
    
    return {
        shouldRetreat: false,
        shouldSwimAway: false,
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale
    };
}

/**
 * Update school fish attack behavior — circle pre-phase then charge.
 *
 * @param {Object}        fish             - Curious fish entity
 * @param {Object}        targetSchoolFish - Target school fish
 * @param {Object}        fishLayer        - Fish layer reference
 * @param {Function}      onVictory        - Victory callback(target, newSize)
 * @param {Function}      onDefeat         - Defeat callback()
 * @param {Function}      spawnHeart       - Heart spawn callback
 * @param {Function|null} onBlood          - Blood burst callback(x, y, impactAngle)
 * @param {number}        maxFishSize      - Max fish size
 * @param {number}        currentTime      - Current timestamp (ms)
 */
export function updateSchoolFishAttack(fish, targetSchoolFish, fishLayer, onVictory, onDefeat, spawnHeart, onBlood, maxFishSize, currentTime) {
    const target = targetSchoolFish;
    const targetStillExists = fishLayer?.sharks?.includes(target);

    if (!targetStillExists) {
        delete fish._atkPhase;
        delete fish._atkCircleBaseAngle;
        delete fish._atkCircleStart;
        return { attackComplete: true, shouldDie: false };
    }

    const targetY = target.baseY !== undefined ? target.baseY : target.y;
    const targetX = target.x;
    const targetMutations = {};

    if (!target.isBeingAttacked) {
        targetMutations.isBeingAttacked = true;
        targetMutations.frozenX = targetX;
        targetMutations.frozenY = targetY;
    }

    // ── Circle pre-phase: orbit the target before charging ───────────────────
    if (!fish._atkPhase) {
        fish._atkPhase = 'circle';
        fish._atkCircleStart = currentTime;
        fish._atkCircleBaseAngle = Math.atan2(fish.y - targetY, fish.x - targetX);
    }

    if (fish._atkPhase === 'circle') {
        const CIRCLE_DURATION = 1100; // ms
        const elapsed = currentTime - fish._atkCircleStart;
        const circleAngle = fish._atkCircleBaseAngle + (elapsed / CIRCLE_DURATION) * Math.PI * 2.2;
        const circleRadius = (fish.currentSize + target.size) * 1.9;

        const orbitX = targetX + Math.cos(circleAngle) * circleRadius;
        const orbitY = targetY + Math.sin(circleAngle) * circleRadius;
        const ox = orbitX - fish.x;
        const oy = orbitY - fish.y;
        const od = Math.sqrt(ox * ox + oy * oy);
        const orbitSpeed = Math.min(od * 0.28, 13);

        const velX = od > 0.5 ? (ox / od) * orbitSpeed : 0;
        const velY = od > 0.5 ? (oy / od) * orbitSpeed : 0;

        // Always face the target while circling
        const faceAngle = Math.atan2(targetY - fish.y, targetX - fish.x);
        let tFlip, tRot;
        if (faceAngle > Math.PI / 2 || faceAngle < -Math.PI / 2) {
            tFlip = -1; tRot = Math.PI - faceAngle;
        } else {
            tFlip = 1;  tRot = faceAngle;
        }

        if (elapsed >= CIRCLE_DURATION) fish._atkPhase = 'charge';

        return { attackComplete: false, shouldDie: false, velocityX: velX, velocityY: velY, targetFlipScale: tFlip, targetRotation: tRot, targetMutations };
    }

    // ── Charge phase ─────────────────────────────────────────────────────────
    const targetIsBigger         = target.size > fish.currentSize * 1.2;
    const targetIsSlightlyBigger = target.size > fish.currentSize && !targetIsBigger;

    const dx = targetX - fish.x;
    const dy = targetY - fish.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const collisionDistance = (fish.currentSize + target.size) * 0.5;

    if (distance < collisionDistance) {
        // Blood burst at impact point
        if (onBlood) {
            onBlood((fish.x + targetX) / 2, (fish.y + targetY) / 2, Math.atan2(dy, dx));
        }
        // Brief red flash on target
        targetMutations._hitFlashTime = currentTime;

        // Cleanup circle state
        delete fish._atkPhase;
        delete fish._atkCircleBaseAngle;
        delete fish._atkCircleStart;

        if (targetIsBigger) {
            targetMutations.isBeingAttacked = false;
            if (onDefeat) onDefeat();
            return { attackComplete: true, shouldDie: true, targetMutations };
        } else if (targetIsSlightlyBigger && Math.random() > 0.4) {
            targetMutations.isBeingAttacked = false;
            if (onDefeat) onDefeat();
            return { attackComplete: true, shouldDie: true, targetMutations };
        } else if (!target.isDying) {
            targetMutations.isDying = true;
            if (fishLayer?.boneLoaded && fishLayer.boneImage) targetMutations.image = fishLayer.boneImage;
            targetMutations.killedByCurious  = true;
            targetMutations.deathRotation    = 0;
            targetMutations.deathStartTime   = currentTime;
            targetMutations.isBeingAttacked  = false;
            if (onVictory) onVictory(target, Math.min(fish.targetSize * 1.04, maxFishSize));
            if (spawnHeart) spawnHeart();
        }
        return { attackComplete: true, shouldDie: false, targetMutations };
    }

    // Approaching target
    const attackSpeed = 13.0;
    const velocityX = (dx / distance) * attackSpeed;
    const velocityY = (dy / distance) * attackSpeed;
    const angleToTarget = Math.atan2(dy, dx);

    let targetFlipScale, targetRotation;
    if (angleToTarget > Math.PI / 2) {
        targetFlipScale = -1; targetRotation = Math.PI - angleToTarget;
    } else if (angleToTarget < -Math.PI / 2) {
        targetFlipScale = -1; targetRotation = -Math.PI - angleToTarget;
    } else {
        targetFlipScale = 1;  targetRotation = angleToTarget;
    }

    return { attackComplete: false, shouldDie: false, velocityX, velocityY, targetFlipScale, targetRotation, targetMutations };
}
