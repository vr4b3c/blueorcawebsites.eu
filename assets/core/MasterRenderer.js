import { DebugPanel } from '../canvas/utils/DebugPanel.js';

/**
 * Master Renderer - Koordinuje WebGL a 2D Canvas rendering
 * Používá jedinou requestAnimationFrame smyčku pro oba canvases
 * 
 * This eliminates the performance bottleneck of having two separate
 * requestAnimationFrame loops competing for CPU time.
 */
export class MasterRenderer {
    /**
     * @param {Object} [options]
     * @param {number} [options.canvas2dFPS=45] - Target FPS for the 2D canvas throttle.
     *   Lower values on weak devices reduce CPU load while keeping WebGL smooth.
     */
    constructor(options = {}) {
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

        // 2D canvas is throttled — fish AI doesn't need full display rate.
        // With both canvases rendering every frame (no throttle), 100% of Commits are
        // heavy (both textures, high variance p90=6.81ms), causing Chrome's frame scheduler
        // to drop into a conservative 3-slot/37ms cadence (27fps). The throttle keeps
        // WebGL-only 'easy' frames that stabilise the compositor pacing.
        this.canvas2dInterval = 1000 / (options.canvas2dFPS || 45);
        this.lastCanvas2dTime = 0;

        // Performance tier: 0=Full (WebGL+Canvas), 1=Canvas only (WebGL off), 2=CSS only
        this.tier = 0;
        this.lowFpsSince = null;
        this.LOW_FPS_THRESHOLD = 28;   // FPS below this triggers degradation
        this.LOW_FPS_DURATION = 5000;  // ms sustained below threshold before dropping a tier

        // Debug panel — created on start()
        this.debugPanel = null;

        // Page Visibility API — pause/resume flags
        this._pausedByVisibility = false;
        this._visibilityListenerAdded = false;
        this._onVisibilityChange = null;
        
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
        // Sync tier with actually registered renderers
        if (!this.webglRenderer && this.tier === 0) this.tier = 1;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.fpsUpdateTime = this.lastTime;
        this.frameCount = 0;
        this.debugPanel = new DebugPanel();
        this.rafId = requestAnimationFrame(this.render);

        // Pause the loop when the tab is hidden, resume when visible again.
        // Prevents wasting CPU/GPU on frames the user will never see and avoids
        // a large deltaTime spike on resume that would cause physics explosions.
        if (!this._visibilityListenerAdded) {
            this._onVisibilityChange = () => {
                if (document.hidden) {
                    if (this.isRunning) {
                        this._pausedByVisibility = true;
                        this.stop();
                    }
                } else if (this._pausedByVisibility) {
                    this._pausedByVisibility = false;
                    // Reset lastTime so the first post-resume deltaTime is 0, not huge.
                    this.lastTime = performance.now();
                    this.lastCanvas2dTime = this.lastTime;
                    this.start();
                }
            };
            document.addEventListener('visibilitychange', this._onVisibilityChange);
            this._visibilityListenerAdded = true;
        }
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

            // Tier degradation: sustained low FPS triggers progressive fallback
            if (this.tier < 2) {
                if (this.currentFPS < this.LOW_FPS_THRESHOLD) {
                    if (this.lowFpsSince === null) this.lowFpsSince = currentTime;
                    if (currentTime - this.lowFpsSince >= this.LOW_FPS_DURATION) {
                        this.lowFpsSince = null;
                        if (this.tier === 0) this.disableWebGL();
                        else this.disableCanvas();
                    }
                } else {
                    this.lowFpsSince = null;
                }
            }

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
     * Tier 1: hide WebGL canvas, let CSS body gradient show through.
     * Triggered automatically when FPS < LOW_FPS_THRESHOLD for LOW_FPS_DURATION ms.
     */
    disableWebGL() {
        if (this.webglRenderer) {
            this.webglRenderer.canvas.style.display = 'none';
            this.webglRenderer = null;
        }
        this.tier = 1;
        console.warn('[MasterRenderer] Tier 1: WebGL disabled — CSS background active');
    }

    /**
     * Tier 2: destroy 2D canvas entirely. CSS background only.
     */
    disableCanvas() {
        if (this.canvasManager) {
            this.canvasManager.destroy();
            this.canvasManager = null;
        }
        this.tier = 2;
        console.warn('[MasterRenderer] Tier 2: Canvas disabled — CSS background only');
    }

    /**
     * Get current FPS
     * @returns {number}
     */
    getFPS() {
        return this.currentFPS;
    }
}
