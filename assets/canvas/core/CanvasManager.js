/**
 * Canvas Manager
 * 
 * Main controller for canvas rendering and layer management.
 * Handles canvas initialization, resize, rendering loop, and event handling.
 * 
 * @module CanvasManager
 */

import { MathUtils } from '../utils/MathUtils.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { PerformanceProfiler } from '../utils/PerformanceProfiler.js';
import { FoodLayer } from '../layers/FoodLayer.js';
import { CuriousFishLayer } from '../layers/CuriousFishLayer.js';

export class CanvasManager {
    constructor(options = {}) {
        // Canvas elements
        this.canvas = null;
        this.ctx = null;
        
        // Layer management
        this.layers = new Map();
        
        // Animation state
        this.animationId = null;
        this.isRunning = false;
        this.lastTime = 0;
        this.frameCounter = 0;
        
        // Utilities
        this.mathUtils = new MathUtils();
        this.performanceMonitor = new PerformanceMonitor({
            showStats: options.showStats !== false,
            targetFPS: options.targetFPS || 45
        });
        this.performanceProfiler = new PerformanceProfiler({
            enabled: options.profilePerformance || false,
            logInterval: 2000
        });
        
        // Food layer with optional config override from init
        this.foodLayer = new FoodLayer(this.mathUtils, options.foodConfig);
        
        // Configuration
        this.config = {
            zIndex: options.zIndex || 0,
            devicePixelRatio: window.devicePixelRatio || 1,
            debug: options.debug || false,
            errorHandling: options.errorHandling !== false, // Error handling enabled by default
            ...options
        };
        
        // Canvas dimensions (logical/CSS pixels)
        this.width = 0;
        this.height = 0;
        
        // Event handlers
        this.resizeTimeout = null;
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
        this.handleTouch = this.handleTouch.bind(this);
        
        // Setup quality change listener
        this.performanceMonitor.onQualityChange(quality => {
            this.applyQualityToLayers(quality);
        });
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize canvas and event listeners
     */
    init() {
        
        // Create canvas element
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'canvas-ocean-foreground';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: auto;
            z-index: ${this.config.zIndex};
        `;
        
        if (this.config.debug) {
            console.log('Canvas element created with z-index:', this.config.zIndex);
            console.log('Canvas pointer-events:', this.canvas.style.pointerEvents);
        }
        
        // Get context with performance hints
        this.ctx = this.canvas.getContext('2d', {
            alpha: true,
            desynchronized: true // Hint for better performance
        });
        
        // Add to DOM: insert immediately after the WebGL background canvas when present,
        // otherwise fall back to inserting at the document start.
        const webglAnchor = document.getElementById('webgl-ocean-background');
        if (webglAnchor && webglAnchor.parentNode) {
            webglAnchor.parentNode.insertBefore(this.canvas, webglAnchor.nextSibling);
            if (this.config.debug) console.log('Canvas element inserted after webgl-ocean-background');
        } else {
            document.body.insertBefore(this.canvas, document.body.firstChild);
            if (this.config.debug) console.log('Canvas element appended to DOM (no webgl anchor found)');
        }
        
        // Set initial size
        this.updateCanvasSize();
        
        // Setup event listeners
        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('click', this.handleClick);
        document.addEventListener('click', this.handleGlobalClick);
        // Touch: spawn food on tap (passive: false not needed — touchend doesn't scroll)
        document.addEventListener('touchend', this.handleTouch, { passive: true });
        
        if (this.config.debug) {
                console.log('Canvas element in DOM:', document.getElementById('canvas-ocean-foreground'));
            console.log('Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
        }
        
        // Play button removed — curious fish will be activated when user spawns food
        
    }
    
    /**
     * Update canvas size for viewport and device pixel ratio
     */
    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || this.config.devicePixelRatio || 1, 2.0);
        
        // Set actual canvas size (device pixels)
        const deviceW = Math.max(1, Math.round(rect.width * dpr));
        const deviceH = Math.max(1, Math.round(rect.height * dpr));
        this.canvas.width = deviceW;
        this.canvas.height = deviceH;
        
        // Apply device pixel ratio scaling
        try {
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } catch (e) {
            this.ctx.scale(dpr, dpr);
        }
        
        // Store logical dimensions (CSS pixels)
        this.width = rect.width;
        this.height = rect.height;
        
        if (this.config.debug) {
            console.log('updateCanvasSize', { 
                rectWidth: rect.width, 
                rectHeight: rect.height, 
                deviceW, 
                deviceH, 
                dpr 
            });
        }
    }
    
    /**
     * Handle window resize with debouncing
     */
    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateCanvasSize();
            
            // Notify all layers
            this.layers.forEach(layer => {
                if (layer.onResize) {
                    layer.onResize(this.width, this.height);
                }
            });
        }, 100);
    }
    
    /**
     * Handle canvas click event
     * @param {MouseEvent} e - Click event
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Prevent event from triggering global click handler (avoid double spawn)
        e.stopPropagation();

        // Always spawn food on EVERY click
        const quality = this.performanceMonitor.getQuality();
        this.foodLayer.spawn(x, y, quality);

        // Get or lazily create curious fish layer
        let curiousFishLayer = this.getLayer('curiousFish');
        if (!curiousFishLayer) {
            curiousFishLayer = new CuriousFishLayer();
            this.addLayer('curiousFish', curiousFishLayer);
        }
        if (!curiousFishLayer.enabled) {
            curiousFishLayer.enabled = true;
            curiousFishLayer.spawnFish();
            curiousFishLayer.gameState = 'playing';
            // Nudge immediately toward the food — normal findFoodTarget loop takes over from here
            curiousFishLayer.setTargetPoint(x, y, { immediate: true, speed: curiousFishLayer.config.maxSpeed });
        }

        // Check if clicking on a school fish
        const fishLayer = this.getLayer('fish');
        if (fishLayer && fishLayer.sharks) {
            for (let i = 0, len = fishLayer.sharks.length; i < len; i++) {
                const shark = fishLayer.sharks[i];
                if (shark.isDying) continue;

                const dx = x - shark.x;
                const dy = y - (shark.baseY || shark.y);
                if (dx * dx + dy * dy < shark.size * shark.size) {
                    const isSameSpecies = shark.image?.src?.includes('curiousfish');
                    if (isSameSpecies) {
                        // Always mate with same species
                        curiousFishLayer.startDance(shark);
                    } else {
                        // Always attack other species (with cooldown)
                        const timeSinceLastAttack = performance.now() - curiousFishLayer.lastAttackTime;
                        if (timeSinceLastAttack >= curiousFishLayer.attackCooldown) {
                            curiousFishLayer.targetSchoolFish = shark;
                            curiousFishLayer.isAttackingSchoolFish = true;
                            curiousFishLayer.lastAttackTime = performance.now();
                        }
                    }
                    return;
                }
            }
        }
    }
    
    /**
     * Handle global click event (fallback)
     * @param {MouseEvent} e - Click event
     */
    handleGlobalClick(e) {
        // Only trigger if not clicking on UI elements AND not on canvas
        // (canvas has its own click handler, prevent double-spawn)
        if (!e.target.closest('#pattern-switcher') && e.target !== this.canvas) {
            this.handleClick(e);
        }
    }

    /**
     * Handle touch tap — spawn food at the touch point.
     * Uses changedTouches so it fires on finger-lift (tap end), not drag.
     * @param {TouchEvent} e
     */
    handleTouch(e) {
        if (e.changedTouches.length === 0) return;
        // Ignore multi-touch gestures (pinch-to-zoom etc.)
        if (e.touches.length > 1) return;
        const touch = e.changedTouches[0];
        // Synthesise a minimal object compatible with handleClick
        this.handleClick({ clientX: touch.clientX, clientY: touch.clientY, stopPropagation: () => {} });
    }
    
    /**
     * Add a rendering layer
     * @param {string} name - Layer identifier
     * @param {Object} layer - Layer instance with render() method
     * @returns {CanvasManager} This instance for chaining
     */
    addLayer(name, layer) {
        this.layers.set(name, layer);
        
        // Initialize layer if needed
        if (layer.init) {
            layer.init(this.width, this.height, this);
        }
        
        return this;
    }
    
    /**
     * Remove a rendering layer
     * @param {string} name - Layer identifier
     * @returns {CanvasManager} This instance for chaining
     */
    removeLayer(name) {
        const layer = this.layers.get(name);
        if (layer && layer.destroy) {
            layer.destroy();
        }
        this.layers.delete(name);
        return this;
    }
    
    /**
     * Get a specific layer
     * @param {string} name - Layer identifier
     * @returns {Object|undefined} Layer instance
     */
    getLayer(name) {
        return this.layers.get(name);
    }
    
    /**
     * Apply quality setting to all layers
     * @private
     * @param {number} quality - Quality value (0.3-1.0)
     */
    applyQualityToLayers(quality) {
        this.layers.forEach(layer => {
            if (layer.setQuality) {
                layer.setQuality(quality);
            }
        });
    }
    
    /**
     * Render frame (called by MasterRenderer)
     * @param {number} currentTime - Current timestamp
     * @param {number} deltaTime - Time since last frame
     * @param {number} currentTime - Current timestamp
     * @param {number} deltaTime - Time since last frame
     */
    renderFrame(currentTime, deltaTime) {
        this.performanceProfiler.startFrame();
        
        // Update performance metrics
        this.performanceProfiler.startSection('performanceMonitor');
        this.performanceMonitor.update(currentTime, deltaTime);
        this.performanceProfiler.endSection('performanceMonitor');
        
        if (!this.ctx || !this.width || !this.height) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Reset food targeted flags
        this.foodLayer.resetTargetedFlags();
        
        // Update and render food system with quality multiplier
        this.performanceProfiler.startSection('foodUpdate');
        const quality = this.performanceMonitor.getQuality();
        this.foodLayer.update(this.ctx, deltaTime, this.width, this.height, quality);
        this.performanceProfiler.endSection('foodUpdate');
        
        // Render all layers (error handling only in debug mode for performance)
        if (this.config.errorHandling) {
            // Safe mode: individual error handling per layer
            this.layers.forEach(layer => {
                if (layer.enabled !== false) {
                    const layerName = layer.constructor?.name || 'unknown';
                    this.performanceProfiler.startSection(`layer:${layerName}`);
                    this.ctx.save();
                    try {
                        layer.render(this.ctx, currentTime, deltaTime, this.width, this.height);
                    } catch (error) {
                        console.error('Error rendering layer:', layerName, error);
                    }
                    this.ctx.restore();
                    this.performanceProfiler.endSection(`layer:${layerName}`);
                }
            });
        } else {
            // Performance mode: no per-layer error handling
            this.layers.forEach(layer => {
                if (layer.enabled !== false) {
                    const layerName = layer.constructor?.name || 'unknown';
                    this.performanceProfiler.startSection(`layer:${layerName}`);
                    this.ctx.save();
                    layer.render(this.ctx, currentTime, deltaTime, this.width, this.height);
                    this.ctx.restore();
                    this.performanceProfiler.endSection(`layer:${layerName}`);
                }
            });
        }
        
        this.frameCounter++;
        this.performanceProfiler.endFrame(currentTime);
    }
    
    /**
     * Start rendering loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
    }
    
    /**
     * Stop rendering loop
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
    }
    
    /**
     * Toggle performance stats display
     */
    togglePerformanceStats() {
        return this.performanceMonitor.toggleStats();
    }
    
    /**
     * Get food particles for layers that need them
     * @returns {Array} Array of food particles
     */
    getFoodParticles() {
        return this.foodLayer.getParticles();
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        this.canvas.removeEventListener('click', this.handleClick);
        document.removeEventListener('click', this.handleGlobalClick);
        document.removeEventListener('touchend', this.handleTouch);
        
        // Destroy all layers
        this.layers.forEach(layer => {
            if (layer.destroy) layer.destroy();
        });
        this.layers.clear();
        
        // Clear food system
        this.foodLayer.clear();
        
        // Remove canvas
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
    }
}
