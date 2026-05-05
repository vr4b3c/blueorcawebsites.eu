import { DebugPanel } from '../canvas/utils/DebugPanel.js';

/**
 * Master Renderer - Koordinuje WebGL a 2D Canvas rendering
 * Používá jedinou requestAnimationFrame smyčku pro oba canvases
 * 
 * This eliminates the performance bottleneck of having two separate
 * requestAnimationFrame loops competing for CPU time.
 */
export class MasterRenderer {
    constructor() {
        this.webglRenderer = null;
        this.canvasManager = null;
        this.rafId = null;
        this.lastTime = 0;
        this.isRunning = false;
        
        // FPS tracking
        this.fpsUpdateTime = 0;
        this.frameCount = 0;
        this.currentFPS = 60;
        this.fpsLogTime = 0;

        // 2D canvas is throttled to 45fps — fish AI doesn't need 75fps.
        // With both canvases rendering every frame (no throttle), 100% of Commits are
        // heavy (both textures, high variance p90=6.81ms), causing Chrome's frame scheduler
        // to drop into a conservative 3-slot/37ms cadence (27fps). The throttle keeps ~37%
        // of frames as WebGL-only 'easy' frames that stabilise the compositor pacing.
        this.canvas2dInterval = 1000 / 45;
        this.lastCanvas2dTime = 0;

        // Debug panel — created on start()
        this.debugPanel = null;
        
        this.render = this.render.bind(this);
    }
    
    /**
     * Register WebGL renderer and disable its internal rAF loop
     * @param {WebGLOceanRenderer} renderer 
     */
    registerWebGLRenderer(renderer) {
        this.webglRenderer = renderer;
        // Zakázat vlastní rAF loop
        if (renderer.rafId) {
            cancelAnimationFrame(renderer.rafId);
            renderer.rafId = null;
        }
    }
    
    /**
     * Register Canvas Manager and disable its internal rAF loop
     * @param {CanvasManager} manager 
     */
    registerCanvasManager(manager) {
        this.canvasManager = manager;
        // Zakázat vlastní rAF loop
        if (manager.animationId) {
            cancelAnimationFrame(manager.animationId);
            manager.animationId = null;
        }
    }
    
    /**
     * Start unified render loop
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.fpsUpdateTime = this.lastTime;
        this.frameCount = 0;
        this.debugPanel = new DebugPanel();
        this.rafId = requestAnimationFrame(this.render);
    }
    
    /**
     * Stop unified render loop
     */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
    
    /**
     * Main unified render loop
     * Renders both WebGL and 2D Canvas in correct order with shared timing
     * @param {number} currentTime - Timestamp from requestAnimationFrame
     */
    render(currentTime) {
        if (!this.isRunning) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Measure render time for theoretical FPS
        const renderStart = performance.now();
        
        // Render WebGL background FIRST (z-index nejnižší) — full display rate
        if (this.webglRenderer && this.webglRenderer.gl) {
            this.webglRenderer.renderFrame(currentTime, deltaTime);
        }
        
        // Render 2D Canvas foreground — throttled to 45fps so WebGL-only frames provide
        // compositor breathing room and keep the frame schedule stable
        if (this.canvasManager && this.canvasManager.ctx) {
            if (currentTime - this.lastCanvas2dTime >= this.canvas2dInterval) {
                const canvas2dDelta = currentTime - this.lastCanvas2dTime;
                this.lastCanvas2dTime = currentTime;
                this.canvasManager.renderFrame(currentTime, canvas2dDelta);
            }
        }
        
        const renderEnd = performance.now();
        this.lastRenderTime = renderEnd - renderStart;
        
        // Update FPS display (moved from setInterval to rAF loop)
        this.updateFPSDisplay(currentTime, deltaTime);
        
        this.rafId = requestAnimationFrame(this.render);
    }
    
    /**
     * Update FPS display (replaces setInterval approach)
     * @param {number} currentTime 
     */
    updateFPSDisplay(currentTime, deltaTime) {
        this.frameCount++;
        
        // Update FPS display každých 500ms
        if (currentTime - this.fpsUpdateTime >= 500) {
            this.currentFPS = Math.round((this.frameCount * 1000) / (currentTime - this.fpsUpdateTime));
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;

            // Log average FPS to console every 5 seconds
            if (currentTime - this.fpsLogTime >= 5000) {
                console.log(`FPS: ${this.currentFPS}`);
                this.fpsLogTime = currentTime;
            }
            
            // Calculate theoretical FPS from render time
            const theoreticalFPS = this.lastRenderTime > 0 ? Math.round(1000 / this.lastRenderTime) : 0;
            
            // Calculate real maximum FPS from total frame time (including browser overhead)
            const realMaxFPS = deltaTime > 0 ? Math.round(1000 / deltaTime) : 0;
            
            // Calculate idle time (browser overhead, VSync wait, compositor, etc.)
            const idleTime = deltaTime - this.lastRenderTime;
            
            // Collect stats from all sources
            const stats = {
                fps: this.currentFPS,
                theoreticalFPS: realMaxFPS, // Real max based on total frame time
                renderTime: this.lastRenderTime,
                totalFrameTime: deltaTime,
                idleTime: idleTime,
                layers: {},
                webgl: {},
                counts: {},
                quality: 1.0,
                resolution: ''
            };
            
            // Get Canvas 2D layer stats
            if (this.canvasManager) {
                const profiler = this.canvasManager.performanceProfiler;
                if (profiler && profiler.sections) {
                    // Map profiler sections to stats.layers with proper naming
                    // Sections are stored as "layer:FishLayer", "layer:CuriousFishLayer", etc.
                    stats.layers = {
                        FishLayer: profiler.sections['layer:FishLayer'],
                        CuriousFishLayer: profiler.sections['layer:CuriousFishLayer'],
                        HudLayer: profiler.sections['layer:HudLayer']
                    };
                    
                    // Get food stats from foodUpdate section
                    if (profiler.sections.foodUpdate) {
                        stats.food = {
                            time: profiler.sections.foodUpdate.avg
                        };
                    }
                }
                
                // Get counts
                const fishLayer = this.canvasManager.getLayer('fish');
                if (fishLayer && fishLayer.sharks) {
                    stats.counts.fish = fishLayer.sharks.length;
                }
                
                const foodLayer = this.canvasManager.foodLayer;
                if (foodLayer && foodLayer.getParticles) {
                    stats.counts.food = foodLayer.getParticles().length;
                }
                
                // Get quality
                const perfMon = this.canvasManager.performanceMonitor;
                if (perfMon) {
                    stats.quality = perfMon.qualityMultiplier || 1.0;
                }
                
                // Resolution
                stats.resolution = `${this.canvasManager.canvas.width}×${this.canvasManager.canvas.height}`;
            }
            
            // Get WebGL stats - extract from profiling times if available
            if (this.webglRenderer) {
                // WebGL layers timing (if profiling enabled)
                if (this.webglRenderer.lastProfileTimes) {
                    const times = this.webglRenderer.lastProfileTimes;
                    stats.webgl = {
                        gradient: times.gradient ? { time: times.gradient } : null,
                        rays: times.rays ? { time: times.rays } : null,
                        bubbles: times.bubbles ? { time: times.bubbles } : null,
                        plankton: times.plankton ? { time: times.plankton } : null
                    };
                }
                
                // Particle counts
                if (this.webglRenderer.bubblesLayer && this.webglRenderer.bubblesLayer.particleCount) {
                    stats.counts.bubbles = this.webglRenderer.bubblesLayer.particleCount;
                }
                if (this.webglRenderer.planktonLayer && this.webglRenderer.planktonLayer.particleCount) {
                    stats.counts.plankton = this.webglRenderer.planktonLayer.particleCount;
                }
            }
            
            // Update debug panel
            if (this.debugPanel) {
                this.debugPanel.update(stats);
            }
        }
    }
    
    /**
     * Get current FPS
     * @returns {number}
     */
    getFPS() {
        return this.currentFPS;
    }
}
