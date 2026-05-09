import { DebugPanel } from '../canvas/utils/DebugPanel.js';
import { getDeviceProfile } from '../canvas/utils/DeviceProfile.js';

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
        this.debug = options.debug || false;

        // 2D canvas is throttled — fish AI doesn't need full display rate.
        // With both canvases rendering every frame (no throttle), 100% of Commits are
        // heavy (both textures, high variance p90=6.81ms), causing Chrome's frame scheduler
        // to drop into a conservative 3-slot/37ms cadence (27fps). The throttle keeps
        // WebGL-only 'easy' frames that stabilise the compositor pacing.
        this.canvas2dInterval = 1000 / (options.canvas2dFPS || 45);
        this.lastCanvas2dTime = 0;

        // 5-level degradation ladder:
        //   0 = FULL:            WebGL (full budget) + Canvas (full entities)
        //   1 = WEBGL_LITE:      WebGL (50% particle budget) + Canvas full
        //   2 = CANVAS_GRADIENT: WebGL off + Canvas full + CSS gradient visible
        //   3 = CANVAS_REDUCED:  No WebGL + Canvas at reduced quality (fewer fish, no decorative icons)
        //   4 = GRADIENT_ONLY:   All animations stopped — CSS gradient only
        this.tier = 0;
        this.lowFpsSince = null;
        this.LOW_FPS_THRESHOLD        = 28;   // FPS threshold for levels 0 and 1
        this.LOW_FPS_THRESHOLD_CANVAS = 22;   // FPS threshold for level 2
        this.LOW_FPS_THRESHOLD_FINAL  = 15;   // FPS threshold for level 3
        this.LOW_FPS_DURATION         = 5000; // ms sustained below threshold before stepping down
        // WebGL shader compilation + JS parse can spike load-time FPS for 10-15s.
        // Degradation is inhibited during this warmup window to prevent false triggers.
        this._warmupDuration = 12000; // ms after start() before degradation is allowed
        this._warmupUntil = 0;       // set in start()
        // Page hidden tracking — enables one conservative step-up after ≥60s in background
        this._hiddenSince = 0;
        this.RECOVERY_HIDDEN_MIN = 60000; // 60 s hidden → allow step up on restore

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
        // On context loss jump directly to CANVAS_GRADIENT — no need to wait for FPS timer
        renderer.onContextLost = () => {
            if (this.tier < 2) {
                console.warn('[MasterRenderer] WebGL context lost — jumping to level 2');
                this.lowFpsSince = null;
                this._disableWebGL();
            }
        };
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

        // Proactive settings based on device tier — applied from frame 1,
        // no waiting for the 5s FPS degradation timer.
        const { tier: deviceTier } = getDeviceProfile();
        if (deviceTier === 0) {
            // mobile-low: no WebGL (already tier=1), start canvas at reduced quality
            this._reduceCanvasQuality(0.6);
        } else if (deviceTier === 1) {
            // mobile-medium: WebGL running but cut particle budget immediately
            if (this.webglRenderer) {
                this.webglRenderer.reduceBudget(0.5);
                this.tier = 1; // mark as WEBGL_LITE from the start
            }
            this._reduceCanvasQuality(0.7);
        }
        // device tiers 2 and 3: full quality, let adaptive system take over if needed

        this.isRunning = true;
        this.lastTime = performance.now();
        this.fpsUpdateTime = this.lastTime;
        this.frameCount = 0;
        this._warmupUntil = this.lastTime + this._warmupDuration;
        this.debugPanel = new DebugPanel();
        this.rafId = requestAnimationFrame(this.render);

        // Pause the loop when the tab is hidden, resume when visible again.
        // Prevents wasting CPU/GPU on frames the user will never see and avoids
        // a large deltaTime spike on resume that would cause physics explosions.
        if (!this._visibilityListenerAdded) {
            this._onVisibilityChange = () => {
                if (document.hidden) {
                    this._hiddenSince = performance.now();
                    if (this.isRunning) {
                        this._pausedByVisibility = true;
                        this.stop();
                    }
                } else if (this._pausedByVisibility) {
                    this._pausedByVisibility = false;
                    const hiddenDuration = performance.now() - (this._hiddenSince || 0);
                    // Conservative step-up: only if hidden long enough and tier is recoverable.
                    // Levels 0–2 stay put (WebGL can't be revived without reinit).
                    // Level 4 → 3: re-enable canvas after a long background pause.
                    if (hiddenDuration >= this.RECOVERY_HIDDEN_MIN && this.tier >= 3) {
                        this._stepUp();
                    }
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
        
        // Clamp deltaTime: after a GC storm or tab-wake the raw delta can be 1000ms+,
        // which causes physics objects to teleport. 100ms cap = max one 10fps "slip" frame.
        const rawDelta = currentTime - this.lastTime;
        const deltaTime = Math.min(rawDelta, 100);
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

            // Degradation: sustained low FPS steps down one tier at a time.
            // Skip during warmup — shader compilation & JS parse push initial FPS low.
            if (this.tier < 4 && currentTime >= this._warmupUntil) {
                const threshold = this.tier <= 1
                    ? this.LOW_FPS_THRESHOLD
                    : this.tier === 2
                        ? this.LOW_FPS_THRESHOLD_CANVAS
                        : this.LOW_FPS_THRESHOLD_FINAL;

                if (this.currentFPS < threshold) {
                    if (this.lowFpsSince === null) this.lowFpsSince = currentTime;
                    if (currentTime - this.lowFpsSince >= this.LOW_FPS_DURATION) {
                        this.lowFpsSince = null;
                        this._stepDown();
                    }
                } else {
                    this.lowFpsSince = null;
                }
            }

            // Log average FPS to console every 5 seconds (debug builds only)
            if (currentTime - this.fpsLogTime >= 5000) {
                if (this.debug) console.log(`FPS: ${this.currentFPS}`);
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
     * Step down one degradation level.
     * Called automatically by updateFPSDisplay when sustained FPS threshold is missed.
     */
    _stepDown() {
        const next = this.tier + 1;
        if (next > 4) return;

        if (next === 1) {
            // WEBGL_LITE: cut particle budgets by 50%, WebGL stays running
            if (this.webglRenderer) this.webglRenderer.reduceBudget(0.5);
            this.tier = 1;
            console.warn('[MasterRenderer] Level 1 (WEBGL_LITE): particle budget halved');
        } else if (next === 2) {
            // CANVAS_GRADIENT: kill WebGL, CSS gradient visible, canvas still running
            this._disableWebGL();
        } else if (next === 3) {
            // CANVAS_REDUCED: push canvas quality to 0.4 (fewer fish, no decorative icons)
            this._reduceCanvasQuality(0.4);
            this.tier = 3;
            console.warn('[MasterRenderer] Level 3 (CANVAS_REDUCED): quality forced to 0.4');
        } else if (next === 4) {
            // GRADIENT_ONLY: stop canvas entirely, only CSS gradient remains
            this._stopCanvas();
            this.tier = 4;
            console.warn('[MasterRenderer] Level 4 (GRADIENT_ONLY): all animations stopped');
        }
    }

    /**
     * Step up one level after a long background pause.
     * Only safe path: 4 → 3 (re-enable canvas at reduced quality).
     * WebGL cannot be re-enabled without a full reinit (page reload required).
     */
    _stepUp() {
        if (this.tier === 4) {
            this._resumeCanvas();
            this.tier = 3;
            console.log('[MasterRenderer] Recovery: Level 3 (canvas resumed after background)');
        }
    }

    /**
     * Disable WebGL and transition to CANVAS_GRADIENT (level 2).
     */
    _disableWebGL() {
        if (this.webglRenderer) {
            this.webglRenderer.canvas.style.display = 'none';
            this.webglRenderer = null;
        }
        document.body.classList.remove('has-webgl');
        this.tier = 2;
        console.warn('[MasterRenderer] Level 2 (CANVAS_GRADIENT): WebGL off — CSS gradient active');
    }

    /**
     * Force canvas quality to a specific value.
     * @param {number} quality - 0.3–1.0
     */
    _reduceCanvasQuality(quality) {
        if (this.canvasManager && this.canvasManager.performanceMonitor) {
            const mon = this.canvasManager.performanceMonitor;
            const clamped = Math.max(mon.qualitySettings?.min ?? 0.3, quality);
            mon.qualitySettings.current = clamped;
            mon.notifyQualityChange(clamped);
        }
    }

    /**
     * Stop canvas animation entirely (level 4) and clear the canvas.
     */
    _stopCanvas() {
        if (this.canvasManager) {
            if (this.canvasManager.ctx) {
                this.canvasManager.ctx.clearRect(0, 0, this.canvasManager.width, this.canvasManager.height);
            }
            if (this.canvasManager.canvas) {
                this.canvasManager.canvas.style.display = 'none';
            }
        }
    }

    /**
     * Re-show canvas after recovery from level 4.
     */
    _resumeCanvas() {
        if (this.canvasManager && this.canvasManager.canvas) {
            this.canvasManager.canvas.style.display = '';
        }
    }

    // ── Legacy aliases — kept for any external callers ───────────────────────────────────
    /** @deprecated Use _disableWebGL() */
    disableWebGL() { this._disableWebGL(); }
    /** @deprecated Use _reduceCanvasQuality() */
    reduceCanvasQuality() {
        const cur = this.canvasManager?.performanceMonitor?.qualitySettings?.current ?? 1.0;
        this._reduceCanvasQuality(Math.max(0.3, cur - 0.2));
    }

    /**
     * Get current FPS
     * @returns {number}
     */
    getFPS() {
        return this.currentFPS;
    }
}
