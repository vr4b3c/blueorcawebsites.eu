/**
 * Canvas Init
 *
 * Replaces the old integration helper. Include this module to initialize
 * the canvas background system with MasterRenderer integration.
 *
 * USAGE:
 * <script type="module" src="canvas/init.js"></script>
 */

import { 
    createCanvasBackground,
    FishLayer,
    DasFishLayer,
    JellyfishLayer
} from './index.js';

import { MasterRenderer } from '../core/MasterRenderer.js';
import { getDeviceProfile } from './utils/DeviceProfile.js';

function isRenderDebugEnabled() {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug-render') === '1';
}

function supportsCanvasFilters() {
    const probe = document.createElement('canvas');
    const ctx = probe.getContext('2d');
    if (!ctx) return false;

    const testFilter = 'brightness(1.05)';
    ctx.filter = 'none';
    ctx.filter = testFilter;
    return ctx.filter === testFilter;
}

export function initCanvasBackground() {

    const renderDebugEnabled = isRenderDebugEnabled();

    const { entityBudget: budget } = getDeviceProfile();
    const preferLiteCanvasEffects = window.blueOrcaRenderBootstrap?.preferLiteCanvasEffects === true;
    const allowHighCostEffects = !preferLiteCanvasEffects && budget.canvas2dFPS >= 40 && supportsCanvasFilters();

    const manager = createCanvasBackground({
        zIndex: 0,
        showStats: renderDebugEnabled,
        targetFPS: 60,
        debug: renderDebugEnabled,
        errorHandling: false, // Disable error handling for max performance
        profilePerformance: false, // Disabled: triggers CpuProfiler overhead every session
        skipDefaultLayers: true,
        // Layer configurations - optional overrides of DEFAULT_CONFIG
        foodConfig: {
            // count: 6,        // Number of food particles (FoodLayer.DEFAULT_CONFIG)
            // size: 5,         // Size of food particles
            // fallSpeed: 0.25, // Fall speed
            // spread: 30,      // Horizontal spread
            // shrinkRate: 0.05 // Shrink rate in px/second
        },
        fishConfig: {
            schoolDensity: budget.schoolDensity,
            // schoolCount: 6,      // Number of schools — set null to use density-based auto-scaling
            // size: 1.2,           // Size multiplier (0.5-2x)
            // avoidRadius: 100,    // Radius to avoid mouse cursor
            // showDebug: false     // Debug visualization
        },
        curiousFishConfig: {
            allowHighCostEffects,
            // speed: 5.0,          // Fish movement speed (CuriousFishLayer.DEFAULT_CONFIG)
            // maxSpeed: 2.0,       // Maximum speed
            // size: 30,            // Initial fish size
            // maxFishSize: 150,    // Maximum fish size
            // followDistance: 60   // Distance to follow cursor
        }
    });

    // All visual layers (gradient, bubbles, plankton, seabed, light rays)
    // are handled by WebGL canvas - this canvas only handles AI entities

    const fishLayer = new FishLayer(manager.config.fishConfig || {});
    manager.addLayer('fish', fishLayer);

    const dasFishLayer = new DasFishLayer({ allowHighCostEffects });
    manager.addLayer('das', dasFishLayer);

    const jellyfishLayer = new JellyfishLayer({ allowHighCostEffects });
    manager.addLayer('jellyfish', jellyfishLayer);

    // Create MasterRenderer to coordinate both WebGL and Canvas rendering.
    // canvas2dFPS is device-tier-aware — lower values on weak devices reduce
    // CPU load while keeping WebGL visuals smooth.
    const masterRenderer = new MasterRenderer({ canvas2dFPS: budget.canvas2dFPS, debug: renderDebugEnabled });
    
    // Register WebGL renderer if it exists
    if (window.webglOceanRenderer) {
        masterRenderer.registerWebGLRenderer(window.webglOceanRenderer);
    }
    
    // Start Canvas manager first so its animationId exists, then register with
    // MasterRenderer which cancels that loop — preventing dual rAF loops.
    manager.start();
    masterRenderer.registerCanvasManager(manager);

    // Bridge quality systems: when PerformanceMonitor adjusts Canvas 2D quality,
    // forward the same multiplier to WebGL particle layers so both subsystems
    // respond to the same FPS signal.
    manager.performanceMonitor.onQualityChange(q => {
        window.webglOceanRenderer?.setQuality(q);
    });
    
    // Start the unified render loop
    masterRenderer.start();
    
    // Export for global access
    window.blueOrcaCanvas = manager;
    window.blueOrcaMasterRenderer = masterRenderer;
    
    return manager;
}

if (typeof window !== 'undefined' && !window.blueOrcaCanvas) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initCanvasBackground();
        });
    } else {
        initCanvasBackground();
    }
}
