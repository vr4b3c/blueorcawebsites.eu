import { WaterGradientLayer } from './WaterGradientLayer.js';
import { LightRaysLayer } from './LightRaysLayer.js';
import { BubblesLayer } from './BubblesLayer.js';
import { PlanktonLayer } from './PlanktonLayer.js';

export class WebGLOceanRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.gl = null;
        this.rafId = null;
        this.startTime = 0;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 60;
        this.fpsUpdateTime = 0;
        this.lastProfileTimes = null;
        
        // Resize debouncing
        this.resizeTimeout = null;
        this.pendingResize = null;
        
        // Layer enable/disable flags
        this.options = {
            enableGradient: options.enableGradient !== false,
            enableRays: options.enableRays !== false,
            enableBubbles: options.enableBubbles !== false,
            enablePlankton: options.enablePlankton !== false,
            profiling: options.profiling || false,
            // Per-layer config overrides (entity counts, etc.)
            planktonConfig: options.planktonConfig || {},
            bubblesConfig: options.bubblesConfig || {},
            raysConfig: options.raysConfig || {},
            // DPR cap — set by DeviceProfile to prevent memory waste on hi-DPI mobile
            dprCap: options.dprCap || 1.5,
        };
        
        // Quality settings
        this.qualityMultiplier = 1.0;
        this.targetFPS = 50;
        this.lowFpsFrames = 0;
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        
        // Layer objects
        this.gradientLayer = null;
        this.raysLayer = null;
        this.bubblesLayer = null;
        this.planktonLayer = null;
    }
    
    init() {
        const gl = this.canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            desynchronized: false
        });
        
        if (!gl) {
            throw new Error('WebGL2 not supported');
        }
        
        this.gl = gl;
        
        gl.clearColor(0.02, 0.05, 0.1, 1.0);
        
        this.onResize(this.canvas.width, this.canvas.height);
        
        this.initLayers();
        
        window.addEventListener('resize', this.handleResize);
        
        return this;
    }
    
    initLayers() {
        const { width, height } = this.canvas;
        
        if (this.options.enableGradient) {
            this.gradientLayer = new WaterGradientLayer(this.gl);
            this.gradientLayer.init(width, height);
            this.gradientLayer.enabled = true;
        }
        
        if (this.options.enableRays) {
            this.raysLayer = new LightRaysLayer(this.gl, this.options.raysConfig);
            this.raysLayer.init(width, height);
            this.raysLayer.enabled = true;
        }
        
        if (this.options.enableBubbles) {
            this.bubblesLayer = new BubblesLayer(this.gl, this.options.bubblesConfig);
            this.bubblesLayer.init(width, height);
            this.bubblesLayer.enabled = true;
        }
        
        if (this.options.enablePlankton) {
            this.planktonLayer = new PlanktonLayer(this.gl, this.options.planktonConfig);
            this.planktonLayer.init(width, height);
            this.planktonLayer.enabled = true;
        }
    }
    
    handleResize() {
        clearTimeout(this.resizeTimeout);
        
        this.pendingResize = {
            dpr: Math.min(window.devicePixelRatio || 1, this.options.dprCap),
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        this.resizeTimeout = setTimeout(() => {
            this.applyResize();
        }, 150);
    }
    
    applyResize() {
        if (!this.pendingResize) return;

        const { dpr, width, height } = this.pendingResize;
        const canvasWidth = Math.floor(width * dpr);
        const canvasHeight = Math.floor(height * dpr);
        this.onResize(canvasWidth, canvasHeight);

        // Keep CSS display size in sync with the viewport (buffer is DPR-scaled internally)
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.pendingResize = null;
    }
    
    onResize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.gl) {
            this.gl.viewport(0, 0, width, height);
            
            if (this.gradientLayer) this.gradientLayer.onResize(width, height);
            if (this.raysLayer) this.raysLayer.onResize(width, height);
            if (this.bubblesLayer) this.bubblesLayer.onResize(width, height);
            if (this.planktonLayer) this.planktonLayer.onResize(width, height);
        }
    }
    
    start() {
        if (this.rafId) return;
        
        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;
        this.fpsUpdateTime = this.startTime;
        this.frameCount = 0;
        
        console.log('WebGL renderer ready (controlled by MasterRenderer)');
    }
    
    stop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
    
    renderFrame(currentTime, deltaTime) {
        this.lastFrameTime = currentTime;
        
        const profiling = this.options.profiling || false;
        const times = {};
        
        if (profiling) times.start = performance.now();
        
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        if (profiling) times.clear = performance.now();
        
        if (this.gradientLayer && this.gradientLayer.enabled) {
            this.gradientLayer.render(currentTime, deltaTime);
        }

        if (profiling) times.gradient = performance.now();

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        if (this.raysLayer && this.raysLayer.enabled) {
            this.raysLayer.render(currentTime, deltaTime);
        }

        if (profiling) times.rays = performance.now();

        if (this.bubblesLayer && this.bubblesLayer.enabled) {
            this.bubblesLayer.render(currentTime, deltaTime);
        }

        if (profiling) times.bubbles = performance.now();

        if (this.planktonLayer && this.planktonLayer.enabled) {
            this.planktonLayer.render(currentTime, deltaTime);
        }
        
        if (profiling) {
            times.plankton = performance.now();
            times.total = times.plankton - times.start;
            
            this.lastProfileTimes = {
                gradient: times.gradient - times.clear,
                rays: times.rays - times.gradient,
                bubbles: times.bubbles - times.rays,
                plankton: times.plankton - times.bubbles,
                total: times.total
            };
            
            if (!this._lastProfileLog || currentTime - this._lastProfileLog > 2000) {
                console.group('WebGL Performance Profile');
                console.log(`Total Frame: ${times.total.toFixed(2)}ms`);
                console.log(`Gradient: ${(times.gradient - times.clear).toFixed(2)}ms`);
                console.log(`Light Rays: ${(times.rays - times.gradient).toFixed(2)}ms`);
                console.log(`Bubbles: ${(times.bubbles - times.rays).toFixed(2)}ms`);
                console.log(`Plankton: ${(times.plankton - times.bubbles).toFixed(2)}ms`);
                console.groupEnd();
                this._lastProfileLog = currentTime;
            }
        }
        
        this.gl.disable(this.gl.BLEND);
        
        this.updateFPS(currentTime, deltaTime);
    }
    
    updateFPS(currentTime, deltaTime) {
        this.frameCount++;
        
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
            
            if (this.fps < this.targetFPS) {
                this.lowFpsFrames++;
                if (this.lowFpsFrames > 3 && this.qualityMultiplier > 0.5) {
                    this.qualityMultiplier *= 0.9;
                    this.applyQualitySettings();
                }
            } else {
                this.lowFpsFrames = 0;
                if (this.qualityMultiplier < 1.0) {
                    this.qualityMultiplier = Math.min(1.0, this.qualityMultiplier * 1.05);
                    this.applyQualitySettings();
                }
            }
        }
    }
    
    applyQualitySettings() {
        if (this.bubblesLayer) {
            this.bubblesLayer.setQuality(this.qualityMultiplier);
        }
        if (this.planktonLayer) {
            this.planktonLayer.setQuality(this.qualityMultiplier);
        }
    }
    
    setLayerEnabled(name, enabled) {
        switch (name) {
            case 'gradient':
                this.options.enableGradient = enabled;
                if (this.gradientLayer) {
                    if (typeof this.gradientLayer.toggle === 'function') {
                        this.gradientLayer.toggle(enabled);
                    } else {
                        this.gradientLayer.enabled = enabled;
                        if (enabled && !this.gradientLayer.program) this.gradientLayer.init(this.canvas.width, this.canvas.height);
                    }
                } else if (enabled && this.gl) {
                    this.gradientLayer = new WaterGradientLayer(this.gl);
                    this.gradientLayer.init(this.canvas.width, this.canvas.height);
                    this.gradientLayer.enabled = true;
                }
                break;
            case 'rays':
                this.options.enableRays = enabled;
                if (this.raysLayer) {
                    if (typeof this.raysLayer.toggle === 'function') {
                        this.raysLayer.toggle(enabled);
                    } else {
                        this.raysLayer.enabled = enabled;
                        if (enabled && !this.raysLayer.program) this.raysLayer.init(this.canvas.width, this.canvas.height);
                    }
                } else if (enabled && this.gl) {
                    this.raysLayer = new LightRaysLayer(this.gl, this.options.raysConfig);
                    this.raysLayer.init(this.canvas.width, this.canvas.height);
                    this.raysLayer.enabled = true;
                }
                break;
            case 'bubbles':
                this.options.enableBubbles = enabled;
                if (this.bubblesLayer) {
                    if (typeof this.bubblesLayer.toggle === 'function') {
                        this.bubblesLayer.toggle(enabled);
                    } else {
                        this.bubblesLayer.enabled = enabled;
                        if (enabled && !this.bubblesLayer.program) this.bubblesLayer.init(this.canvas.width, this.canvas.height);
                    }
                } else if (enabled && this.gl) {
                    this.bubblesLayer = new BubblesLayer(this.gl, this.options.bubblesConfig);
                    this.bubblesLayer.init(this.canvas.width, this.canvas.height);
                    this.bubblesLayer.enabled = true;
                }
                break;
            case 'plankton':
                this.options.enablePlankton = enabled;
                if (this.planktonLayer) {
                    if (typeof this.planktonLayer.toggle === 'function') {
                        this.planktonLayer.toggle(enabled);
                    } else {
                        this.planktonLayer.enabled = enabled;
                        if (enabled && !this.planktonLayer.program) this.planktonLayer.init(this.canvas.width, this.canvas.height);
                    }
                } else if (enabled && this.gl) {
                    this.planktonLayer = new PlanktonLayer(this.gl, this.options.planktonConfig);
                    this.planktonLayer.init(this.canvas.width, this.canvas.height);
                    this.planktonLayer.enabled = true;
                }
                break;
        }
    }
    
    getFPS() {
        return this.fps;
    }

    /**
     * Apply a quality multiplier to all particle layers.
     * Called by MasterRenderer to synchronise WebGL quality with the Canvas 2D
     * PerformanceMonitor so both subsystems respond to the same FPS signal.
     * @param {number} quality - 0.3–1.0
     */
    setQuality(quality) {
        this.qualityMultiplier = quality;
        if (this.bubblesLayer) this.bubblesLayer.setQuality(quality);
        if (this.planktonLayer) this.planktonLayer.setQuality(quality);
    }
    
    destroy() {
        this.stop();
        
        if (this.gradientLayer) this.gradientLayer.destroy();
        if (this.raysLayer) this.raysLayer.destroy();
        if (this.bubblesLayer) this.bubblesLayer.destroy();
        if (this.planktonLayer) this.planktonLayer.destroy();
        
        window.removeEventListener('resize', this.handleResize);
        
        this.gl = null;
    }
}
