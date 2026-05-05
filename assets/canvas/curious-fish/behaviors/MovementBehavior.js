/**
 * MovementBehavior - Handles all movement-related behaviors for curious fish
 * EXTRACTED AS-IS from CuriousFishLayer
 * 
 * Movement types:
 * 1. Following cursor (with dynamic speed based on distance and size)
 * 2. Fleeing from cursor (when too close)
 * 3. Food chasing (targeting and moving towards food)
 * 4. Forced target movement (direct navigation to specific point)
 */

/**
 * Update forced target movement
 * EXTRACTED AS-IS from CuriousFishLayer lines ~474-514
 * 
 * @param {Object} fish - Fish entity
 * @param {Object} forcedTarget - { x, y, speed, tolerance }
 * @returns {Object} { isComplete: boolean, velocityX, velocityY, targetRotation, targetFlipScale }
 */
export function updateForcedTarget(fish, forcedTarget) {
    const dx = forcedTarget.x - fish.x;
    const dy = forcedTarget.y - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tol = (typeof forcedTarget.tolerance === 'number') ? forcedTarget.tolerance : 6;
    const speed = (typeof forcedTarget.speed === 'number') ? forcedTarget.speed : 2.0;

    if (dist <= tol) {
        // Reached target - complete
        return {
            isComplete: true,
            velocityX: 0,
            velocityY: 0
        };
    }
    
    // Calculate velocity and rotation
    const velocityX = (dx / dist) * speed;
    const velocityY = (dy / dist) * speed;
    
    const angle = Math.atan2(dy, dx);
    let targetFlipScale, targetRotation;
    
    if (angle > Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = Math.PI - angle;
    } else if (angle < -Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = -Math.PI - angle;
    } else {
        targetFlipScale = 1;
        targetRotation = angle;
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
 * Find food in field of view
 * EXTRACTED AS-IS from CuriousFishLayer lines ~811-932
 * 
 * @param {Object} fish - Fish entity
 * @param {Array} foodParticles - Array of food particles
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} followDistance - Follow distance config
 * @param {number} fovMultiplier - FOV multiplier config
 * @param {Object} FISH_SIZE_FACTORS - Size factor constants
 * @returns {Object} { targetFood, eatenFood: [], mutations: { targetedFood, foodUpdates: [] } }
 */
export function findFoodTarget(fish, foodParticles, width, height, followDistance, fovMultiplier, FISH_SIZE_FACTORS) {
    const mouthDistance = fish.currentSize * FISH_SIZE_FACTORS.MOUTH_DISTANCE;
    const mouthX = fish.x + Math.cos(fish.rotation) * mouthDistance * fish.flipScale;
    const mouthY = fish.y + Math.sin(fish.rotation) * mouthDistance;
    const mouthRadius = fish.currentSize * FISH_SIZE_FACTORS.MOUTH_RADIUS;
    const fovOriginDistance = fish.currentSize * FISH_SIZE_FACTORS.FOV_ORIGIN_DISTANCE;
    const fovOriginX = fish.x + Math.cos(fish.rotation) * fovOriginDistance * fish.flipScale;
    const fovOriginY = fish.y + Math.sin(fish.rotation) * fovOriginDistance;
    
    const viewportBase = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth * 0.20 : 800 * 0.20;
    const minBySize = fish.currentSize * 1.5;
    const fovBase = Math.max(viewportBase, minBySize);
    const fovDistance = fovBase * fovMultiplier;
    const fovAngle = Math.PI / 2;
    const fishDirection = fish.flipScale > 0 ? fish.rotation : Math.PI - fish.rotation;
    
    const eatenFood = [];
    const foodUpdates = []; // Track food particle updates for orchestrator to apply
    let newTargetedFood = fish.targetedFood; // Track new targeted food value
    
    // Check if targeted food still valid (use squared distance for performance)
    let shouldFindNewFood = true;
    if (fish.targetedFood) {
        const targeted = fish.targetedFood;
        if (!targeted.eaten) {
            const tdx = targeted.x - fovOriginX;
            const tdy = targeted.y - fovOriginY;
            const tdistSquared = tdx * tdx + tdy * tdy;
            const centerDx = targeted.x - fish.x;
            const centerDy = targeted.y - fish.y;
            const centerDistSquared = centerDx * centerDx + centerDy * centerDy;
            const minCenterDistanceSquared = (fish.currentSize * 1.2) ** 2;
            
            if (centerDistSquared < minCenterDistanceSquared) {
                newTargetedFood = null;
            } else if (tdistSquared <= fovDistance * fovDistance && targeted.y <= height * 0.9) {
                shouldFindNewFood = false;
                foodUpdates.push({ food: targeted, updates: { isTargeted: true } });
            } else {
                newTargetedFood = null;
            }
        } else {
            newTargetedFood = null;
        }
    }
    
    // Check for eating (use squared distance for performance)
    for (const food of foodParticles) {
        if (food.eaten) continue;
        const mouthDx = food.x - mouthX;
        const mouthDy = food.y - mouthY;
        const mouthDistSquared = mouthDx * mouthDx + mouthDy * mouthDy;
        if (mouthDistSquared < mouthRadius * mouthRadius) {
            foodUpdates.push({ food, updates: { eaten: true } });
            eatenFood.push(food);
            if (fish.targetedFood === food) {
                newTargetedFood = null;
                shouldFindNewFood = true;
            }
        }
    }
    
    // Find new food (use squared distance for performance)
    if (shouldFindNewFood) {
        const bottomThreshold = height * 0.9;
        let nearestFood = null;
        let nearestDistanceSquared = fovDistance * fovDistance;
        
        for (const food of foodParticles) {
            if (food.eaten || food.y > bottomThreshold) continue;
            
            const foodDeltaX = food.x - fovOriginX;
            const foodDeltaY = food.y - fovOriginY;
            const foodDistanceSquared = foodDeltaX * foodDeltaX + foodDeltaY * foodDeltaY;
            
            const centerDx = food.x - fish.x;
            const centerDy = food.y - fish.y;
            const centerDistSquared = centerDx * centerDx + centerDy * centerDy;
            const minCenterDistanceSquared = (fish.currentSize * FISH_SIZE_FACTORS.MIN_CENTER_DISTANCE) ** 2;
            
            if (centerDistSquared < minCenterDistanceSquared || foodDistanceSquared > fovDistance * fovDistance) continue;
            
            const angleToFood = Math.atan2(foodDeltaY, foodDeltaX);
            let angleDiff = angleToFood - fishDirection;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const isInCone = Math.abs(angleDiff) < fovAngle / 2;
            
            if (isInCone && foodDistanceSquared < nearestDistanceSquared) {
                nearestDistanceSquared = foodDistanceSquared;
                nearestFood = food;
            }
        }
        
        if (nearestFood) {
            newTargetedFood = nearestFood;
            foodUpdates.push({ food: nearestFood, updates: { isTargeted: true } });
        }
    }
    
    const foodToChase = newTargetedFood;
    if (foodToChase && !foodToChase.eaten) {
        foodUpdates.push({ food: foodToChase, updates: { isTargeted: true } });
    }
    
    return {
        targetFood: foodToChase,
        eatenFood,
        mutations: {
            targetedFood: newTargetedFood,
            foodUpdates
        }
    };
}

/**
 * Calculate movement towards target (cursor or food)
 * EXTRACTED AS-IS from CuriousFishLayer lines ~934-1026
 * 
 * @param {Object} fish - Fish entity
 * @param {number} targetX - Target X position
 * @param {number} targetY - Target Y position
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 * @param {boolean} targetIsFood - Whether target is food
 * @param {number} maxSpeed - Max speed config
 * @param {number} maxFishSize - Max fish size
 * @param {number} followDistance - Follow distance config
 * @param {number} deltaTime - Delta time
 * @param {Object} FISH_SIZE_FACTORS - Size factor constants
 * @returns {Object} { velocityX, velocityY, targetRotation, targetFlipScale, isFleeing, isStaring, fleeTimer }
 */
export function calculateMovement(fish, targetX, targetY, mouseX, mouseY, targetIsFood, maxSpeed, maxFishSize, followDistance, deltaTime, FISH_SIZE_FACTORS) {
    if (targetX === null || targetY === null) {
        return {
            velocityX: fish.velocityX * 0.95,
            velocityY: fish.velocityY * 0.95,
            isStaring: false
        };
    }
    
    const dx = targetX - fish.x;
    const dy = targetY - fish.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let angleToMouse = Math.atan2(dy, dx);
    
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
    
    const mouthDistance = fish.currentSize * FISH_SIZE_FACTORS.MOUTH_DISTANCE;
    const mouthX = fish.x + Math.cos(fish.rotation) * mouthDistance * fish.flipScale;
    const mouthY = fish.y + Math.sin(fish.rotation) * mouthDistance;
    const mouthToCursorDx = mouseX - mouthX;
    const mouthToCursorDy = mouseY - mouthY;
    const mouthDistance_cursor = Math.sqrt(mouthToCursorDx * mouthToCursorDx + mouthToCursorDy * mouthToCursorDy);
    const effectiveFollowDistance = Math.min(
        fish.currentSize * FISH_SIZE_FACTORS.FOLLOW_DISTANCE * followDistance, 
        150
    );
    
    let isFleeing = fish.isFleeing;
    let fleeTimer = fish.fleeTimer || 0;
    let isStaring = false;
    let velocityX = fish.velocityX;
    let velocityY = fish.velocityY;
    
    if (!targetIsFood && distance < fish.currentSize * FISH_SIZE_FACTORS.COLLISION_THRESHOLD && !isFleeing) {
        isFleeing = true;
        fleeTimer = 0;
    }
    
    if (isFleeing) {
        fleeTimer += deltaTime;
        const swimDirection = fish.rotation;
        const fleeSpeed = maxSpeed * 1.5;
        velocityX = Math.cos(swimDirection) * fleeSpeed * fish.flipScale;
        velocityY = Math.sin(swimDirection) * fleeSpeed;
        let angleAwayFromCursor = Math.atan2(dy, dx) + Math.PI;
        if (angleAwayFromCursor > Math.PI / 2) {
            targetFlipScale = -1;
            targetRotation = Math.PI - angleAwayFromCursor;
        } else if (angleAwayFromCursor < -Math.PI / 2) {
            targetFlipScale = -1;
            targetRotation = -Math.PI - angleAwayFromCursor;
        } else {
            targetFlipScale = 1;
            targetRotation = angleAwayFromCursor;
        }
        if (fleeTimer > 600 || distance > effectiveFollowDistance * 1.5) {
            isFleeing = false;
        }
    } else if (targetIsFood) {
        const sizeRatio = fish.currentSize / maxFishSize;
        const speedMultiplier = 1.1 - (sizeRatio * 0.2);
        const adjustedSpeed = maxSpeed * speedMultiplier;
        const targetVelX = (dx / distance) * adjustedSpeed;
        const targetVelY = (dy / distance) * adjustedSpeed;
        velocityX += (targetVelX - velocityX) * 0.22;
        velocityY += (targetVelY - velocityY) * 0.22;
    } else if (mouthDistance_cursor > effectiveFollowDistance) {
        const maxDistance = 500;
        const distanceRatio = Math.min(distance / maxDistance, 1.0);
        const sizeRatio = fish.currentSize / maxFishSize;
        const sizeSpeedMultiplier = 1.1 - (sizeRatio * 0.2);
        // Natural easing: minimum 40% speed even when near cursor — keeps fish lively
        const dynamicSpeed = maxSpeed * (0.40 + distanceRatio * distanceRatio * 0.60) * sizeSpeedMultiplier;
        const targetVelX = (dx / distance) * dynamicSpeed;
        const targetVelY = (dy / distance) * dynamicSpeed;
        velocityX += (targetVelX - velocityX) * 0.22;
        velocityY += (targetVelY - velocityY) * 0.22;
    } else {
        isStaring = true;
        velocityX *= 0.9;
        velocityY *= 0.9;
    }
    
    return {
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale,
        isFleeing,
        isStaring,
        fleeTimer
    };
}

/**
 * Clamp fish position to canvas bounds
 * EXTRACTED AS-IS from CuriousFishLayer lines ~1032-1039
 * 
 * @param {Object} fish - Fish entity
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} size - Fish size
 * @param {boolean} isSwimmingAway - Whether fish is swimming away
 * @returns {Object} { x, y }
 */
export function clampPosition(fish, width, height, size, isSwimmingAway) {
    if (isSwimmingAway) {
        return { x: fish.x, y: fish.y };
    }
    
    let x = Math.max(size, Math.min(width - size, fish.x));
    let y = fish.y;
    
    // Only clamp Y if fish is within or above the viewport; allow below-viewport spawns to remain
    if (y <= height) {
        // Allow the fish to enter from below smoothly; only clamp to the canvas bottom
        y = Math.max(height * 0.1, Math.min(height, y));
    }
    
    return { x, y };
}

/**
 * Update rotation and animation
 * EXTRACTED AS-IS from CuriousFishLayer lines ~1067-1078
 * 
 * @param {Object} fish - Fish entity
 * @param {number} deltaTime - Delta time
 * @param {number} rotationSpeed - Rotation speed config
 * @param {number} maxFishSize - Max fish size
 * @returns {Object} { rotation, flipScale, age, swimPhase }
 */
export function updateRotationAndAnimation(fish, deltaTime, rotationSpeed, maxFishSize) {
    let rotationDiff = fish.targetRotation - fish.rotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    const sizeRatio = fish.currentSize / maxFishSize;
    // Milder rotation slowdown - larger fish still turn reasonably well
    const rotationMultiplier = 1.2 - (sizeRatio * 0.3);
    const rotation = fish.rotation + rotationDiff * rotationSpeed * rotationMultiplier;
    
    const flipDiff = fish.targetFlipScale - fish.flipScale;
    const flipScale = fish.flipScale + flipDiff * 0.20;
    
    const age = fish.age + deltaTime;
    const swimPhase = (age / 800) % 1;
    
    return {
        rotation,
        flipScale,
        age,
        swimPhase
    };
}

/**
 * Set target point for fish movement
 * EXTRACTED AS-IS from CuriousFishLayer lines ~1084-1136
 * 
 * @param {Object} fish - Fish entity
 * @param {number} x - Target X
 * @param {number} y - Target Y
 * @param {Object} opts - { immediate, hold, speed, tolerance }
 * @param {number} maxSpeed - Max speed config
 * @returns {Object} { velocityX, velocityY, targetRotation, targetFlipScale, forcedTarget }
 */
export function setTargetPoint(fish, x, y, opts = {}, maxSpeed) {
    const immediate = !!opts.immediate;
    const hold = !!opts.hold;
    const dx = x - fish.x;
    const dy = y - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) {
        return null;
    }

    // Update visual rotation/flip targets
    const angle = Math.atan2(dy, dx);
    let targetFlipScale, targetRotation;
    
    if (angle > Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = Math.PI - angle;
    } else if (angle < -Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = -Math.PI - angle;
    } else {
        targetFlipScale = 1;
        targetRotation = angle;
    }

    const baseSpeed = (typeof opts.speed === 'number') ? opts.speed : maxSpeed || 2.0;
    
    if (hold) {
        // Forced target - hold until reached
        const forcedTarget = {
            x: Math.round(x),
            y: Math.round(y),
            speed: baseSpeed,
            tolerance: (typeof opts.tolerance === 'number' ? opts.tolerance : 6)
        };
        const velocityX = (dx / dist) * baseSpeed;
        const velocityY = (dy / dist) * baseSpeed;
        
        return {
            velocityX,
            velocityY,
            targetRotation,
            targetFlipScale,
            forcedTarget
        };
    } else if (immediate) {
        const velocityX = (dx / dist) * baseSpeed;
        const velocityY = (dy / dist) * baseSpeed;
        return {
            velocityX,
            velocityY,
            targetRotation,
            targetFlipScale
        };
    } else {
        // Soft nudge toward target
        const targetVelX = (dx / dist) * (baseSpeed * 0.6);
        const targetVelY = (dy / dist) * (baseSpeed * 0.6);
        const velocityX = fish.velocityX + (targetVelX - fish.velocityX) * 0.12;
        const velocityY = fish.velocityY + (targetVelY - fish.velocityY) * 0.12;
        return {
            velocityX,
            velocityY,
            targetRotation,
            targetFlipScale
        };
    }
}
