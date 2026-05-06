/**
 * CuriousFishRenderer - Pure rendering functions
 * EXTRACTED AS-IS from CuriousFishLayer
 * NO decisions, only drawing based on provided state
 * 
 * All functions are stateless - they receive what they need to draw
 */

const FISH_SIZE_FACTORS = {
    FOLLOW_DISTANCE: 0.5,
    MOUTH_DISTANCE: 0.9,
    MOUTH_RADIUS: 0.3,
    FOV_ORIGIN_DISTANCE: 0.3,
    COLLISION_THRESHOLD: 0.5,
    NEAR_MOUSE_THRESHOLD: 0.8,
    MIN_CENTER_DISTANCE: 1.2
};

/**
 * Draw the curious fish
 * EXTRACTED AS-IS from CuriousFishLayer.drawFish()
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} fish - Fish entity
 * @param {HTMLImageElement} fishImage - Fish image
 * @param {string} lifePhase - Current life phase
 * @param {Object} config - Layer config
 * @param {boolean} isAttackingSchoolFish - Attack state flag
 * @param {Object|null} targetSchoolFish - Target fish if attacking
 * @param {number} width - Canvas width (for debug)
 * @param {number} height - Canvas height (for debug)
 */
export function drawFish(ctx, fish, fishImage, config, isAttackingSchoolFish, targetSchoolFish, width, height) {
    if (fish && fish.hidden) return;
    
    const currentSpeed = Math.sqrt(fish.velocityX * fish.velocityX + fish.velocityY * fish.velocityY);
    const maxSpeed = config.maxSpeed;
    const speedRatio = Math.min(currentSpeed / maxSpeed, 1.0);
    // Scale vertical bob with fish size for more natural large fish movement
    const sizeScale = fish.currentSize / 30; // 30 is base size
    // Slow down bobbing frequency for larger fish (inverse scaling) - made even slower
    const bobFrequency = 0.0008 / Math.sqrt(sizeScale);
    // Gradual fade-in of bob effect as fish slows down (smooth transition from 0.5 to 0.1 speed)
    const fadeThreshold = 0.5; // Start fading at 50% speed
    const fadeStart = 0.1; // Full bob at 10% speed
    const fadeAmount = speedRatio < fadeStart ? 1.0 : 
                      speedRatio > fadeThreshold ? 0.0 :
                      1.0 - ((speedRatio - fadeStart) / (fadeThreshold - fadeStart));
    const bobActive = config.enableBob ? fadeAmount : 0;
    const verticalBob = bobActive * Math.sin(fish.age * bobFrequency) * 6 * sizeScale;
    // Add gentle rotation bob (±3 degrees) with slightly different frequency for natural movement
    const rotationBob = bobActive * Math.sin(fish.age * bobFrequency * 0.7) * 0.05;
    
    ctx.save();
    ctx.translate(fish.x, fish.y + verticalBob);
    ctx.scale(fish.flipScale, 1);
    ctx.rotate(fish.rotation + rotationBob);
    
    // Removed body sway rotation for smoother, more natural movement
    
    // Life phase visual effects - use external glow config.
    // Allow per-fish override for permanent pink/blue glow created by reproduction.
    ctx.globalAlpha = 1.0;
    const size = fish.currentSize;
    const imgWidth = size * 2;
    const imgHeight = size * (fishImage.height / fishImage.width) * 2;
    ctx.drawImage(fishImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
    
    ctx.restore();
    
    if (config.showDebug) {
        drawFishDebug(ctx, fish, config, isAttackingSchoolFish, targetSchoolFish, width, height);
    }
}

/**
 * Draw debug overlay for the curious fish (hitboxes, FOV cone, zones).
 * Only called when config.showDebug is true.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} fish
 * @param {Object} config
 * @param {boolean} isAttackingSchoolFish
 * @param {Object|null} targetSchoolFish
 * @param {number} width
 * @param {number} height
 */
function drawFishDebug(ctx, fish, config, isAttackingSchoolFish, targetSchoolFish, width, height) {
    const mouthDistance = fish.currentSize * 0.9;
    ctx.save();
    const mouthX = fish.x + Math.cos(fish.rotation) * mouthDistance * fish.flipScale;
        const mouthY = fish.y + Math.sin(fish.rotation) * mouthDistance;
        const mouthRadius = fish.currentSize * 0.3;
        
        // Mouth eating radius (red)
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouthX, mouthY, mouthRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Follow distance (yellow)
        const effectiveFollowDistance = Math.min(
            fish.currentSize * FISH_SIZE_FACTORS.FOLLOW_DISTANCE * config.followDistance, 
            150
        );
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouthX, mouthY, effectiveFollowDistance, 0, Math.PI * 2);
        ctx.stroke();
        
        // Avoidance zone - area where other fish avoid (cyan)
        const cfSize = fish.currentSize;
        const avoidRadius = 100 + cfSize;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Draw ellipse for elongated fish shape
        ctx.ellipse(fish.x, fish.y, avoidRadius * 0.87, avoidRadius * 0.4, fish.rotation, 0, Math.PI * 2);
        ctx.stroke();
        
        // Collision radius for attacks (purple)
        if (isAttackingSchoolFish && targetSchoolFish) {
            const collisionDistance = (fish.currentSize + targetSchoolFish.size) * 0.5;
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Draw ellipse oriented toward fish rotation
            ctx.ellipse(fish.x, fish.y, collisionDistance * 0.87, collisionDistance * 0.4, fish.rotation, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw line to target
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(fish.x, fish.y);
            ctx.lineTo(targetSchoolFish.x, targetSchoolFish.baseY || targetSchoolFish.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Flee radius (orange)
        ctx.strokeStyle = 'rgba(255, 128, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fish.x, fish.y, fish.currentSize * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(fish.currentSize)}px`, fish.x + fish.currentSize, fish.y - fish.currentSize - 10);
        
        const fovOriginDistance = fish.currentSize * 0.3;
        const fovOriginX = fish.x + Math.cos(fish.rotation) * fovOriginDistance * fish.flipScale;
        const fovOriginY = fish.y + Math.sin(fish.rotation) * fovOriginDistance;
        const viewportBaseDraw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth * 0.20 : 800 * 0.20;
        const minBySizeDraw = fish.currentSize * 1.5;
        const fovBaseDraw = Math.max(viewportBaseDraw, minBySizeDraw);
        const fovMultiplierDraw = (config && config.fovMultiplier !== undefined) ? config.fovMultiplier : 1.0;
        const fovDistance = fovBaseDraw * fovMultiplierDraw;
        const fovAngle = Math.PI / 2;
        const fishDirection = fish.flipScale > 0 ? fish.rotation : Math.PI - fish.rotation;
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fovOriginX, fovOriginY);
        const leftAngle = fishDirection - fovAngle / 2;
        const leftX = fovOriginX + Math.cos(leftAngle) * fovDistance;
        const leftY = fovOriginY + Math.sin(leftAngle) * fovDistance;
        ctx.lineTo(leftX, leftY);
        ctx.arc(fovOriginX, fovOriginY, fovDistance, leftAngle, fishDirection + fovAngle / 2);
        ctx.lineTo(fovOriginX, fovOriginY);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        const bottomThreshold = height * 0.9;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.fillRect(0, bottomThreshold, width, height - bottomThreshold);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, bottomThreshold);
        ctx.lineTo(width, bottomThreshold);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('Dead zone (10vh)', width - 10, bottomThreshold - 5);
}

/**
 * Draw hearts/icons
 * EXTRACTED AS-IS from CuriousFishLayer.drawHearts()
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} hearts - Array of heart/icon objects
 */
export function drawHearts(ctx, hearts) {
    ctx.save();
    for (const heart of hearts) {
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

/**
 * Draw targeting crosshair over hovered fish
 * EXTRACTED AS-IS from CuriousFishLayer.drawTargetingCrosshair()
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 * @param {Object} phaseConfig - Current phase config
 * @param {boolean} canAttack - Whether fish can attack
 * @param {string} lifePhase - Current life phase
 * @param {Array} schoolFish - Array of school fish
 */
export function drawTargetingCrosshair(ctx, mouseX, mouseY, phaseConfig, canAttack, lifePhase, schoolFish) {
    if (!phaseConfig.showTargetCursor || !canAttack) return;
    const canvas = document.querySelector('canvas');
    if (!canvas || mouseX === null || mouseY === null) return;
    const rect = canvas.getBoundingClientRect();
    const canvasMouseX = mouseX - rect.left;
    const canvasMouseY = mouseY - rect.top;
    
    let hoveredFish = null;
    const isRomantic = lifePhase === 'romantic';
    
    for (const shark of schoolFish) {
        if (shark.isDying) continue;
        
        const sharkY = shark.baseY || shark.y;
        const dx = canvasMouseX - shark.x;
        const dy = canvasMouseY - sharkY;
        if (dx * dx + dy * dy < shark.size * shark.size) {
            hoveredFish = shark;
            break;
        }
    }
    if (!hoveredFish) return;
    
    // Use pink color for romantic phase, red for aggressive
    const cursorColor = isRomantic ? '#ff69b4' : '#ff0000';
    
    ctx.save();
    ctx.strokeStyle = cursorColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const diameter = 1.5 * fontSize;
    const innerRadius = diameter * 0.3;
    const outerRadius = diameter * 0.5;
    ctx.beginPath();
    ctx.arc(canvasMouseX, canvasMouseY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvasMouseX - outerRadius - 5, canvasMouseY);
    ctx.lineTo(canvasMouseX - innerRadius, canvasMouseY);
    ctx.moveTo(canvasMouseX + innerRadius, canvasMouseY);
    ctx.lineTo(canvasMouseX + outerRadius + 5, canvasMouseY);
    ctx.moveTo(canvasMouseX, canvasMouseY - outerRadius - 5);
    ctx.lineTo(canvasMouseX, canvasMouseY - innerRadius);
    ctx.moveTo(canvasMouseX, canvasMouseY + innerRadius);
    ctx.lineTo(canvasMouseX, canvasMouseY + outerRadius + 5);
    ctx.stroke();
    ctx.fillStyle = cursorColor;
    ctx.beginPath();
    ctx.arc(canvasMouseX, canvasMouseY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/**
 * Draw skeleton (falling bone)
 * EXTRACTED AS-IS from CuriousFishLayer death rendering
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} skeletons - Array of skeleton objects
 * @param {HTMLImageElement} boneImage - Bone image
 * @param {number} deltaTime - Delta time
 * @param {number} height - Canvas height
 * @returns {Array} Updated skeletons array
 */
export function drawSkeletons(ctx, skeletons, boneImage, deltaTime, height) {
    const updatedSkeletons = [];
    
    for (let i = 0; i < skeletons.length; i++) {
        const s = skeletons[i];
        // Linear fall until bottom
        s.boneY += s.speed * deltaTime;

        const boneW = s.size * 2;
        const boneH = boneW * (boneImage.height / boneImage.width) || s.size;

        const age = Date.now() - (s.startTime || 0);
        const lifeMs = 10000; // lifetime in ms (10s)

        // If bone reached the visible bottom, snap to bottom and stop falling
        const bottomLimit = height - boneH / 2 - 8;
        if (s.boneY > bottomLimit) {
            s.boneY = bottomLimit;
            s.speed = 0;
        }

        // Draw fully opaque skeleton (no fade)
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.translate(s.x, s.boneY);
        if (s.direction < 0) ctx.scale(-1, 1);
        try {
            ctx.drawImage(boneImage, -boneW / 2, -boneH / 2, boneW, boneH);
        } catch (e) {
            // ignore draw error
        }
        ctx.restore();

        // Keep skeleton if lifetime not exceeded and not far off-screen
        if (age <= lifeMs && s.boneY - boneH / 2 <= height + 200) {
            updatedSkeletons.push(s);
        }
    }
    
    return updatedSkeletons;
}

/**
 * Draw big heart (mating scenario)
 * EXTRACTED AS-IS from CuriousFishLayer dance rendering
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} bigHeart - Big heart object with {x, y, size, opacity}
 */
export function drawBigHeart(ctx, bigHeart) {
    if (!bigHeart) return;
    
    ctx.save();
    ctx.globalAlpha = bigHeart.opacity;
    ctx.fillStyle = '#ff69b4'; // Hot pink
    ctx.font = `${bigHeart.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add glow effect
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 30;
    
    ctx.fillText('❤️', bigHeart.x, bigHeart.y);
    ctx.restore();
}
