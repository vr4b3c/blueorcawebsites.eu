/**
 * Canvas Background System - Main Entry Point
 * 
 * Modular canvas-based water effects system for Blue Orca.
 * Optimized for performance with ES6 modules architecture.
 * 
 * @module CanvasBackgroundSystem
 * @version 2.0.0
 */

import { CanvasManager } from './core/CanvasManager.js';
import { FoodLayer } from './layers/FoodLayer.js';
import { MathUtils } from './utils/MathUtils.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import { DebugPanel } from './utils/DebugPanel.js';
import { FishLayer } from './layers/FishLayer.js';
import { CuriousFishLayer } from './layers/CuriousFishLayer.js';

/**
 * Create and initialize canvas background manager
 * @param {Object} options - Configuration options
 * @returns {CanvasManager} Manager instance
 */
export function createCanvasBackground(options = {}) {
    const manager = new CanvasManager(options);
    
    // All visual layers (gradient, bubbles, plankton, etc.) handled by WebGL canvas
    // This canvas only handles AI entities (fish, shark) and HUD
    
    return manager;
}

/**
 * Export all modules for custom usage
 */
export {
    CanvasManager,
    FoodLayer,
    MathUtils,
    PerformanceMonitor,
    DebugPanel,
    FishLayer,
    CuriousFishLayer
};

// Log module load
console.log('Canvas Background System 2.0 loaded');
