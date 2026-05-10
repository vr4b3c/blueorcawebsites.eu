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
    CuriousFishLayer,
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

function getCanvasRuntimeBudget(baseBudget) {
    const viewportArea = window.innerWidth * window.innerHeight;
    const webglStatus = window.blueOrcaRenderBootstrap?.webglStatus;
    const preferLiteCanvasEffects = window.blueOrcaRenderBootstrap?.preferLiteCanvasEffects === true;
    const canvasOnlyMode = webglStatus !== 'active';

    const runtimeBudget = {
        canvas2dFPS: baseBudget.canvas2dFPS,
        schoolDensity: baseBudget.schoolDensity,
        jellyfishSchoolDensity: 600,
        resolutionScale: 1,
        allowHighCostEffects: !preferLiteCanvasEffects && baseBudget.canvas2dFPS >= 40 && supportsCanvasFilters(),
    };

    if (!canvasOnlyMode) {
        return runtimeBudget;
    }

    runtimeBudget.allowHighCostEffects = false;

    if (viewportArea >= 4_000_000) {
        runtimeBudget.canvas2dFPS = Math.min(baseBudget.canvas2dFPS, 30);
        runtimeBudget.schoolDensity = Math.max(baseBudget.schoolDensity, 1_200_000);
        runtimeBudget.jellyfishSchoolDensity = 1_400;
        runtimeBudget.resolutionScale = 0.67;
    } else if (viewportArea >= 2_500_000) {
        runtimeBudget.canvas2dFPS = Math.min(baseBudget.canvas2dFPS, 35);
        runtimeBudget.schoolDensity = Math.max(baseBudget.schoolDensity, 900_000);
        runtimeBudget.jellyfishSchoolDensity = 1_000;
        runtimeBudget.resolutionScale = 0.8;
    } else if (viewportArea >= 1_500_000) {
        runtimeBudget.canvas2dFPS = Math.min(baseBudget.canvas2dFPS, 40);
        runtimeBudget.schoolDensity = Math.max(baseBudget.schoolDensity, 650_000);
        runtimeBudget.jellyfishSchoolDensity = 850;
        runtimeBudget.resolutionScale = 0.9;
    }

    return runtimeBudget;
}

function scheduleCuriousFishPrewarm(manager) {
    if (typeof window === 'undefined') return;

    const prewarm = () => {
        if (manager.getLayer('curiousFish')) return;

        const curiousFishLayer = new CuriousFishLayer(manager.config.curiousFishConfig || {});
        manager.addLayer('curiousFish', curiousFishLayer);
        curiousFishLayer.enabled = false;
        curiousFishLayer.gameState = 'idle';
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(prewarm, { timeout: 1500 });
    } else {
        window.setTimeout(prewarm, 200);
    }
}

export function initCanvasBackground() {

    const renderDebugEnabled = isRenderDebugEnabled();

    const { entityBudget: budget } = getDeviceProfile();
    const canvasRuntimeBudget = getCanvasRuntimeBudget(budget);
    const allowHighCostEffects = canvasRuntimeBudget.allowHighCostEffects;

    const manager = createCanvasBackground({
        zIndex: 0,
        showStats: renderDebugEnabled,
        targetFPS: canvasRuntimeBudget.canvas2dFPS,
        debug: renderDebugEnabled,
        errorHandling: false, // Disable error handling for max performance
        profilePerformance: false, // Disabled: triggers CpuProfiler overhead every session
        resolutionScale: canvasRuntimeBudget.resolutionScale,
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
            schoolDensity: canvasRuntimeBudget.schoolDensity,
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

    const jellyfishLayer = new JellyfishLayer({
        allowHighCostEffects,
        schoolDensity: canvasRuntimeBudget.jellyfishSchoolDensity,
    });
    manager.addLayer('jellyfish', jellyfishLayer);

    // Create MasterRenderer to coordinate both WebGL and Canvas rendering.
    // canvas2dFPS is device-tier-aware — lower values on weak devices reduce
    // CPU load while keeping WebGL visuals smooth.
    const masterRenderer = new MasterRenderer({
        canvas2dFPS: canvasRuntimeBudget.canvas2dFPS,
        debug: renderDebugEnabled
    });
    
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

    // Prepare the interactive fish layer outside the first click task so
    // user input only activates an existing instance instead of constructing it.
    scheduleCuriousFishPrewarm(manager);
    
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
