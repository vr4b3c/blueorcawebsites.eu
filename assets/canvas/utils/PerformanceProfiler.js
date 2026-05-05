/**
 * PerformanceProfiler - Detailní měření výkonu render loop
 * 
 * Měří čas strávený v jednotlivých částech render cycle
 * a loguje bottlenecks
 */

export class PerformanceProfiler {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.logInterval = options.logInterval || 2000; // Log každé 2 sekundy
        this.lastLogTime = 0;
        
        // Timing data pro každý frame
        this.currentFrame = {};
        
        // Agregované statistiky
        this.stats = {
            frameCount: 0,
            totalFrameTime: 0,
            foodUpdate: { total: 0, count: 0, max: 0 },
            layers: new Map(), // name -> { total, count, max }
            performanceMonitor: { total: 0, count: 0, max: 0 },
            other: { total: 0, count: 0, max: 0 }
        };
        
        // Markers for current frame
        this.markers = [];
    }
    
    /**
     * Začít měřit frame
     */
    startFrame() {
        if (!this.enabled) return;
        this.currentFrame.start = performance.now();
        this.markers = [];
    }
    
    /**
     * Začít měřit section
     * @param {string} name - Název sekce
     */
    startSection(name) {
        if (!this.enabled) return;
        this.markers.push({
            name,
            start: performance.now(),
            type: 'start'
        });
    }
    
    /**
     * Ukončit měření section
     * @param {string} name - Název sekce
     */
    endSection(name) {
        if (!this.enabled) return;
        const end = performance.now();
        
        // Najít odpovídající start marker
        for (let i = this.markers.length - 1; i >= 0; i--) {
            if (this.markers[i].name === name && this.markers[i].type === 'start') {
                const duration = end - this.markers[i].start;
                this.markers[i].duration = duration;
                this.markers[i].type = 'complete';
                
                // Update statistiky
                this._updateStats(name, duration);
                break;
            }
        }
    }
    
    /**
     * Ukončit frame a spočítat celkový čas
     */
    endFrame(currentTime) {
        if (!this.enabled) return;
        
        const frameTime = performance.now() - this.currentFrame.start;
        this.stats.frameCount++;
        this.stats.totalFrameTime += frameTime;
        
        // Log statistiky periodicky
        if (currentTime - this.lastLogTime > this.logInterval) {
            this.logStats();
            this.lastLogTime = currentTime;
        }
    }
    
    /**
     * Update statistiky pro danou sekci
     * @private
     */
    _updateStats(name, duration) {
        let stat;
        
        if (name === 'foodUpdate') {
            stat = this.stats.foodUpdate;
        } else if (name === 'performanceMonitor') {
            stat = this.stats.performanceMonitor;
        } else if (name.startsWith('layer:')) {
            const layerName = name.substring(6);
            if (!this.stats.layers.has(layerName)) {
                this.stats.layers.set(layerName, { total: 0, count: 0, max: 0 });
            }
            stat = this.stats.layers.get(layerName);
        } else {
            stat = this.stats.other;
        }
        
        stat.total += duration;
        stat.count++;
        if (duration > stat.max) {
            stat.max = duration;
        }
    }
    
    /**
     * Logovat statistiky do konzole
     */
    logStats() {
        if (this.stats.frameCount === 0) return;
        
        const avgFrameTime = this.stats.totalFrameTime / this.stats.frameCount;
        const fps = 1000 / avgFrameTime;
        
        console.group(`🔍 Performance Profile (${this.stats.frameCount} frames)`);
        console.log(`📊 Average Frame Time: ${avgFrameTime.toFixed(2)}ms (${fps.toFixed(1)} FPS)`);
        
        // Food update
        if (this.stats.foodUpdate.count > 0) {
            const avg = this.stats.foodUpdate.total / this.stats.foodUpdate.count;
            const pct = (avg / avgFrameTime * 100).toFixed(1);
            console.log(`🍔 Food Update: ${avg.toFixed(2)}ms avg, ${this.stats.foodUpdate.max.toFixed(2)}ms max (${pct}%)`);
        }
        
        // Layers
        if (this.stats.layers.size > 0) {
            console.log('📦 Layers:');
            const sortedLayers = Array.from(this.stats.layers.entries())
                .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count));
            
            sortedLayers.forEach(([name, stat]) => {
                const avg = stat.total / stat.count;
                const pct = (avg / avgFrameTime * 100).toFixed(1);
                console.log(`  - ${name}: ${avg.toFixed(2)}ms avg, ${stat.max.toFixed(2)}ms max (${pct}%)`);
            });
        }
        
        // Performance monitor
        if (this.stats.performanceMonitor.count > 0) {
            const avg = this.stats.performanceMonitor.total / this.stats.performanceMonitor.count;
            const pct = (avg / avgFrameTime * 100).toFixed(1);
            console.log(`📈 Perf Monitor: ${avg.toFixed(2)}ms avg, ${this.stats.performanceMonitor.max.toFixed(2)}ms max (${pct}%)`);
        }
        
        // Other
        if (this.stats.other.count > 0) {
            const avg = this.stats.other.total / this.stats.other.count;
            const pct = (avg / avgFrameTime * 100).toFixed(1);
            console.log(`⚙️ Other: ${avg.toFixed(2)}ms avg, ${this.stats.other.max.toFixed(2)}ms max (${pct}%)`);
        }
        
        console.groupEnd();
        
        // Reset statistiky
        this.resetStats();
    }
    
    /**
     * Reset statistiky
     */
    resetStats() {
        this.stats.frameCount = 0;
        this.stats.totalFrameTime = 0;
        this.stats.foodUpdate = { total: 0, count: 0, max: 0 };
        this.stats.layers.clear();
        this.stats.performanceMonitor = { total: 0, count: 0, max: 0 };
        this.stats.other = { total: 0, count: 0, max: 0 };
    }
    
    /**
     * Enable/disable profiling
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.resetStats();
        }
    }
    
    /**
     * Get sections data in format compatible with MasterRenderer
     * @returns {Object} Sections with avg/max timing
     */
    get sections() {
        const result = {};
        
        // Food update
        if (this.stats.foodUpdate.count > 0) {
            result.foodUpdate = {
                avg: this.stats.foodUpdate.total / this.stats.foodUpdate.count,
                max: this.stats.foodUpdate.max
            };
        }
        
        // Layers (convert Map to object with "layer:Name" keys)
        this.stats.layers.forEach((stat, name) => {
            result[`layer:${name}`] = {
                avg: stat.total / stat.count,
                max: stat.max
            };
        });
        
        // Performance monitor
        if (this.stats.performanceMonitor.count > 0) {
            result.performanceMonitor = {
                avg: this.stats.performanceMonitor.total / this.stats.performanceMonitor.count,
                max: this.stats.performanceMonitor.max
            };
        }
        
        return result;
    }
}
