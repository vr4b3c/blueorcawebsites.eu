/**
 * Performance Monitor
 * 
 * Tracks and displays FPS, frame times, and performance metrics.
 * Implements adaptive quality adjustment based on FPS.
 * 
 * @module PerformanceMonitor
 */

export class PerformanceMonitor {
    constructor(options = {}) {
        // Performance metrics tracking
        this.metrics = {
            fps: 60,
            frameTime: 0,
            frameTimeHistory: new Array(60).fill(16.67), // Pre-allocate circular buffer
            frameTimeIndex: 0, // Current write index
            frameTimeCount: 0, // Number of frames recorded (max 60)
            lastFpsUpdate: 0
        };
        
        // Stats display toggle (accessible from outside)
        this.showStats = options.showStats !== false; // FPS enabled by default
        
        // Adaptive quality system
        this.qualitySettings = {
            current: 1.0,
            target: 1.0,
            min: 0.3,
            max: 1.0,
            targetFPS: options.targetFPS || 45,
            adjustInterval: 1000
        };
        
        this.lastQualityAdjustment = 0;
        this.qualityChangeListeners = [];
    }
    
    /**
     * Toggle performance stats display
     */
    toggleStats() {
        this.showStats = !this.showStats;
        console.log('Performance stats:', this.showStats ? 'ON' : 'OFF');
        return this.showStats;
    }
    
    /**
     * Update performance metrics
     * @param {number} currentTime - Current timestamp
     * @param {number} deltaTime - Time since last frame
     */
    update(currentTime, deltaTime) {
        this.metrics.frameTime = deltaTime;
        
        // Use circular buffer for O(1) writes (no shift/push needed)
        this.metrics.frameTimeHistory[this.metrics.frameTimeIndex] = deltaTime;
        this.metrics.frameTimeIndex = (this.metrics.frameTimeIndex + 1) % 60;
        
        // Track count until buffer is full
        if (this.metrics.frameTimeCount < 60) {
            this.metrics.frameTimeCount++;
        }
        
        // Update FPS every 500ms
        if (currentTime - this.metrics.lastFpsUpdate > 500) {
            // Calculate average from circular buffer
            let sum = 0;
            for (let i = 0; i < this.metrics.frameTimeCount; i++) {
                sum += this.metrics.frameTimeHistory[i];
            }
            const avgFrameTime = sum / this.metrics.frameTimeCount;
            this.metrics.fps = Math.round(1000 / avgFrameTime);
            this.metrics.lastFpsUpdate = currentTime;
            
            // Adaptive quality adjustment
            if (currentTime - this.lastQualityAdjustment > this.qualitySettings.adjustInterval) {
                this.adjustQuality();
                this.lastQualityAdjustment = currentTime;
            }
        }
    }
    
    /**
     * Adjust quality based on current FPS
     * @private
     */
    adjustQuality() {
        const fps = this.metrics.fps;
        const target = this.qualitySettings.targetFPS;
        const oldQuality = this.qualitySettings.current;
        
        if (fps < target - 5) {
            // Reduce quality
            this.qualitySettings.current = Math.max(
                this.qualitySettings.min,
                this.qualitySettings.current - 0.1
            );
        } else if (fps > target + 10 && this.qualitySettings.current < this.qualitySettings.max) {
            // Increase quality
            this.qualitySettings.current = Math.min(
                this.qualitySettings.max,
                this.qualitySettings.current + 0.05
            );
        }
        
        // Notify listeners if quality changed
        if (oldQuality !== this.qualitySettings.current) {
            this.notifyQualityChange(this.qualitySettings.current);
        }
    }
    
    /**
     * Register listener for quality changes
     * @param {Function} callback - Callback function receiving new quality value
     */
    onQualityChange(callback) {
        this.qualityChangeListeners.push(callback);
    }
    
    /**
     * Notify all listeners about quality change
     * @private
     * @param {number} newQuality - New quality value
     */
    notifyQualityChange(newQuality) {
        this.qualityChangeListeners.forEach(listener => {
            try {
                listener(newQuality);
            } catch (error) {
                console.error('Error in quality change listener:', error);
            }
        });
    }
    
    /**
     * Get current quality multiplier
     * @returns {number} Quality value (0.3 to 1.0)
     */
    getQuality() {
        return this.qualitySettings.current;
    }
    
    /**
     * Get current FPS
     * @returns {number} Frames per second
     */
    getFPS() {
        return this.metrics.fps;
    }
    
    /**
     * Draw performance statistics on canvas (DEPRECATED - use DebugPanel instead)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {Object} particleCounts - Object with particle counts for each system
     */
    render(ctx, width, particleCounts = {}) {
        // Stats rendering moved to DebugPanel for better UI/UX
        // This method is kept for backwards compatibility but does nothing
        return;
    }
}
