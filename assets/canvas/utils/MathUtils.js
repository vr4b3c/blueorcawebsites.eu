/**
 * Mathematical Utilities for Canvas System
 * 
 * Provides optimized mathematical functions with caching for performance.
 * Pre-calculates frequently used trigonometric values.
 * 
 * @module MathUtils
 */

export class MathUtils {
    constructor() {
        // Pre-calculate sin/cos values for all degrees (0-359)
        // This avoids expensive Math.sin/cos calls in animation loops
        this.sinCache = new Float32Array(360);
        this.cosCache = new Float32Array(360);
        
        for (let i = 0; i < 360; i++) {
            const rad = (i * Math.PI) / 180;
            this.sinCache[i] = Math.sin(rad);
            this.cosCache[i] = Math.cos(rad);
        }
        
        // Reusable vector for calculations to avoid allocations
        this.tempVec2 = { x: 0, y: 0 };
    }
    
    /**
     * Get cached sine value for degree (0-359)
     * @param {number} degree - Angle in degrees
     * @returns {number} Sine value
     */
    sin(degree) {
        const index = Math.floor(degree) % 360;
        return this.sinCache[index < 0 ? index + 360 : index];
    }
    
    /**
     * Get cached cosine value for degree (0-359)
     * @param {number} degree - Angle in degrees
     * @returns {number} Cosine value
     */
    cos(degree) {
        const index = Math.floor(degree) % 360;
        return this.cosCache[index < 0 ? index + 360 : index];
    }
    
    /**
     * Get cached sine value from radians
     * @param {number} rad - Angle in radians
     * @returns {number} Sine value
     */
    sinRad(rad) {
        const degree = Math.floor((rad * 180 / Math.PI)) % 360;
        return this.sinCache[degree < 0 ? degree + 360 : degree];
    }
    
    /**
     * Get cached cosine value from radians
     * @param {number} rad - Angle in radians
     * @returns {number} Cosine value
     */
    cosRad(rad) {
        const degree = Math.floor((rad * 180 / Math.PI)) % 360;
        return this.cosCache[degree < 0 ? degree + 360 : degree];
    }
    
    /**
     * Calculate distance between two points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Distance
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Calculate squared distance (faster, no sqrt)
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Squared distance
     */
    distanceSquared(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    }
    
    /**
     * Linear interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    /**
     * Clamp value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * Map value from one range to another
     * @param {number} value - Input value
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number} Mapped value
     */
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }
    
    /**
     * Generate random number in range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random value
     */
    random(min, max) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Generate random integer in range
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    }
}
