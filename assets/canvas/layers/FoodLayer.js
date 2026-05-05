/**
 * Food Particle Layer
 * 
 * Manages food particles with object pooling for performance.
 * Handles spawning, updating, and rendering of food particles.
 * 
 * @module FoodLayer
 */

export class FoodLayer {
    // Single source of truth for food particle configuration
    static DEFAULT_CONFIG = {
        count: 3,
        size: 5,
        fallSpeed: 0.08,
        spread: 30,
        shrinkRate: 0.05 // pixels per second (5px takes ~100 seconds to vanish)
    };

    constructor(mathUtils, configRef = {}) {
        this.mathUtils = mathUtils;
        
        // Private: Active food particles (use getParticles() for read-only access)
        this._particles = [];
        
        // Private: Object pool for performance
        this._particlePool = [];
        
        // Defensive copy of config to prevent external modifications
        this.config = {
            ...FoodLayer.DEFAULT_CONFIG,
            ...configRef  // Override with provided config
        };
        
        // Performance optimization: pre-generated color lookup tables
        this.colorLUT = this._generateColorLUT();
        
        // Batch rendering groups (reused arrays to avoid allocations)
        this.renderableParticles = [];
        this.sparkleParticles = [];
        
        // Quality-based feature flags (updated per frame)
        this.renderStrokes = true;
        this.renderSparkles = true;
        this.useSimpleGlimmer = false;
        
        // Safety limit for max particles (optimized for small counts)
        this.MAX_PARTICLES = 100;
    }
    
    /**
     * Generate color lookup tables to eliminate per-frame rgba() string creation
     * @private
     * @returns {Object} Color lookup tables
     */
    _generateColorLUT() {
        const lut = {
            fill: [],      // Fill colors by glimmer intensity
            stroke: [],    // Stroke colors by glimmer intensity
            sparkle: []    // Sparkle colors by opacity
        };
        
        // Pre-generate 256 colors with variety (3 base shades)
        for (let i = 0; i < 256; i++) {
            const glimmer = i / 255;
            // Vary between orange, golden, and yellow tones
            const hueVariation = Math.floor(i / 85) % 3; // 0, 1, or 2
            let r = 255, g, b = 0;
            
            if (hueVariation === 0) {
                // Pure orange
                g = Math.floor(100 + glimmer * 155);
            } else if (hueVariation === 1) {
                // Golden orange
                g = Math.floor(140 + glimmer * 115);
            } else {
                // Yellow-orange
                g = Math.floor(180 + glimmer * 75);
            }
            
            lut.fill[i] = `rgba(${r},${g},${b},1)`;
            lut.stroke[i] = `rgba(255,230,100,${glimmer})`;
        }
        
        // Pre-generate sparkle colors
        for (let i = 0; i < 256; i++) {
            lut.sparkle[i] = `rgba(255,255,255,${i / 255})`;
        }
        
        return lut;
    }
    
    /**
     * Get particle from pool or create new one
     * @private
     * @returns {Object} Particle object
     */
    getFromPool() {
        return this._particlePool.pop() || {
            x: 0, y: 0, vx: 0, vy: 0, size: 0, initialSize: 0,
            opacity: 1, eaten: false, age: 0, lifetime: 0,
            glimmerPhase: 0, isTargeted: false,
            glimmer: 0.5, currentSize: 0
        };
    }
    
    /**
     * Return particle to pool
     * @private
     * @param {Object} particle - Particle to return
     */
    returnToPool(particle) {
        this._particlePool.push(particle);
    }
    
    /**
     * Spawn food particles at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} qualityMultiplier - Quality setting (0.3-1.0) - NOT used for count anymore
     */
    spawn(x, y, qualityMultiplier = 1.0) {
        // Safety limit: prevent runaway particle count
        if (this._particles.length >= this.MAX_PARTICLES) {
            return;
        }
        
        // Use config.count directly without quality multiplier - user wants consistent count
        const particleCount = this.config.count;
        const actualCount = Math.min(particleCount, this.MAX_PARTICLES - this._particles.length);
        const baseSize = this.config.size;
        const fallSpeed = this.config.fallSpeed;
        const spread = this.config.spread;
        
        for (let i = 0; i < actualCount; i++) {
            const particle = this.getFromPool();
            particle.x = x + (Math.random() - 0.5) * spread;
            particle.y = y + (Math.random() - 0.5) * spread;
            particle.vx = (Math.random() - 0.5) * 0.3;
            particle.vy = Math.random() * fallSpeed * 1.5 + fallSpeed;
            particle.size = baseSize * 0.7 + Math.random() * baseSize * 0.6;
            particle.initialSize = particle.size;
            // Lifetime proportional to size: larger particles live longer
            // At shrinkRate 0.05 px/s, a 5px particle takes 100s to vanish
            particle.lifetime = (particle.size / this.config.shrinkRate) * 1000; // in ms
            particle.currentSize = particle.initialSize;
            particle.opacity = 1;
            particle.eaten = false;
            particle.age = 0;
            particle.glimmerPhase = Math.random() * Math.PI * 2;
            particle.isTargeted = false;
            particle.glimmer = 0.5;
            this._particles.push(particle);
        }
    }
    
    /**
     * Reset all targeted flags
     */
    resetTargetedFlags() {
        for (let i = 0, len = this._particles.length; i < len; i++) {
            this._particles[i].isTargeted = false;
        }
    }
    
    /**
     * Update and render food particles with batched rendering
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} deltaTime - Time since last frame
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} qualityMultiplier - Quality setting (0.3-1.0)
     */
    update(ctx, deltaTime, width, height, qualityMultiplier = 1.0) {
        const len = this._particles.length;
        if (len === 0) return;
        
        // No ctx.save/restore needed - we don't use transforms, globalAlpha, or composite modes
        
        // Update LOD flags based on quality
        this._updateLODFlags(qualityMultiplier);
        
        const dt = Math.min(deltaTime, 50); // Cap delta for stability
        
        // Clear batch arrays (reuse to avoid allocations)
        this.renderableParticles.length = 0;
        this.sparkleParticles.length = 0;
        
        // Update particles and collect renderable ones
        let writeIndex = 0;
        for (let readIndex = 0; readIndex < this._particles.length; readIndex++) {
            const food = this._particles[readIndex];
            
            // Remove eaten particles
            if (food.eaten) {
                this.returnToPool(food);
                continue;
            }
            
            // Update position (frame-rate independent)
            food.x += food.vx * (dt / 16.67);
            food.y += food.vy * (dt / 16.67);
            food.age += dt;
            
            // Normalized lifetime calculation (0 → 1)
            const normalizedLife = Math.min(1, food.age / food.lifetime);
            
            // Size decays linearly with normalized lifetime
            // currentSize = initialSize * (1 - normalizedLife)
            food.currentSize = food.initialSize * (1 - normalizedLife);
            
            // Remove when normalized lifetime reaches 1 (currentSize → 0)
            if (normalizedLife >= 1.0 || food.currentSize < 0.1) {
                this.returnToPool(food);
                continue;
            }
            
            // Fade opacity in final 20% of lifetime
            const sizeRatio = food.currentSize / food.initialSize;
            food.opacity = sizeRatio < 0.2 ? sizeRatio * 5 : 1.0;
            
            // Stop at bottom
            if (food.y >= height - 20) {
                food.y = height - 20;
                food.vy = 0;
                food.vx *= 0.95;
            }
            
            // Skip off-screen particles
            if (food.x >= -50 && food.x <= width + 50 && food.y >= -50) {
                // Update glimmer
                food.glimmerPhase += dt * 0.005;
                const glimmerIndex = Math.floor((food.glimmerPhase % (Math.PI * 2)) / (Math.PI * 2) * 360) | 0;
                food.glimmer = this.mathUtils.sin(glimmerIndex) * 0.5 + 0.5;
                
                // Add to renderable list
                this.renderableParticles.push(food);
                
                // Track sparkles
                if (this.renderSparkles && food.glimmer > 0.7) {
                    this.sparkleParticles.push(food);
                }
            }
            
            // Keep particle in array
            this._particles[writeIndex++] = food;
        }
        
        // Truncate array efficiently
        this._particles.length = writeIndex;
        
        // Render (optimized for small counts)
        this._renderBatched(ctx);
        
        // No ctx.restore needed - state unchanged
    }
    
    /**
     * Update LOD flags based on quality multiplier
     * @private
     * @param {number} quality - Quality multiplier (0.3-1.0)
     */
    _updateLODFlags(quality) {
        if (quality >= 0.8) {
            // High quality: all features enabled
            this.renderStrokes = true;
            this.renderSparkles = true;
            this.useSimpleGlimmer = false;
        } else if (quality >= 0.5) {
            // Medium quality: disable sparkles
            this.renderStrokes = true;
            this.renderSparkles = false;
            this.useSimpleGlimmer = false;
        } else {
            // Low quality: minimal features
            this.renderStrokes = false;
            this.renderSparkles = false;
            this.useSimpleGlimmer = true;
        }
    }
    
    /**
     * Render particles (optimized for small counts < 50)
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    _renderBatched(ctx) {
        const count = this.renderableParticles.length;
        if (count === 0) return;
        
        // For small particle counts, per-particle fill is fine
        // Keeping glimmer variety is worth the minimal overhead
        for (let i = 0; i < count; i++) {
            const food = this.renderableParticles[i];
            const glimmerIdx = Math.floor(food.glimmer * 255) | 0;
            const size = food.currentSize; // Use first-class property
            
            // Use LUT for full opacity (most particles)
            if (food.opacity >= 0.99) {
                ctx.fillStyle = this.colorLUT.fill[glimmerIdx];
            } else {
                // Dynamic opacity for fading particles (last ~20% of lifetime)
                const g = 100 + Math.floor(food.glimmer * 155);
                ctx.fillStyle = `rgba(255,${g},0,${food.opacity})`;
            }
            
            ctx.beginPath();
            this._appendDiamond(ctx, food.x, food.y, size);
            ctx.fill();
        }
        
        // Stroke batching (worth it even for small counts)
        if (this.renderStrokes && count > 0) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = this.colorLUT.stroke[180];
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const food = this.renderableParticles[i];
                const size = food.currentSize; // Use first-class property
                this._appendDiamond(ctx, food.x, food.y, size);
            }
            ctx.stroke();
        }
        
        // Sparkles (only high-glimmer particles)
        if (this.renderSparkles && this.sparkleParticles.length > 0) {
            for (let i = 0; i < this.sparkleParticles.length; i++) {
                const food = this.sparkleParticles[i];
                const sparkleOpacity = (food.glimmer - 0.7) * food.opacity;
                const opacityIdx = Math.floor(Math.max(0, Math.min(1, sparkleOpacity)) * 255) | 0;
                
                ctx.fillStyle = this.colorLUT.sparkle[opacityIdx];
                ctx.fillRect(food.x - 1, food.y - 1, 2, 2);
            }
        }
    }
    
    /**
     * Append diamond shape to current path (for batch rendering)
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Diamond size
     */
    _appendDiamond(ctx, x, y, size) {
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.7, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.7, y);
        ctx.closePath();
    }
    
    /**
     * Get all particles for AI layer access
     * Layers may read positions and set eaten/isTargeted flags
     * @returns {Array} Array of food particles
     */
    getParticles() {
        return this._particles;
    }
    
    /**
     * Get number of active particles
     * @returns {number} Particle count
     */
    getCount() {
        return this._particles.length;
    }
    
    /**
     * Update configuration at runtime (e.g., from ice-switcher UI)
     * @param {Object} newConfig - Partial config to merge with current
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    /**
     * Clear all particles
     */
    clear() {
        // Return all to pool
        this._particles.forEach(p => this.returnToPool(p));
        this._particles.length = 0;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.clear();
        this._particlePool = [];
        console.log('FoodLayer destroyed');
    }
}
