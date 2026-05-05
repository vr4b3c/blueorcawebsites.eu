import { WebGLOceanRenderer } from './index.js';
import { getDeviceProfile } from '../canvas/utils/DeviceProfile.js';

const canvas = document.getElementById('webgl-ocean-background');

if (canvas) {
    const { tier, label, entityBudget: budget } = getDeviceProfile();

    // Tier 0 (mobile-low): skip WebGL entirely — CSS gradient fallback visible.
    // MasterRenderer will start at Tier 1 (Canvas only).
    if (tier === 0) {
        console.info(`[WebGL] Skipping WebGL on ${label} device — CSS fallback active`);
        window.webglOceanRenderer = null;
    } else {
        const dpr = Math.min(window.devicePixelRatio || 1, budget.dprCap);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';

        const renderer = new WebGLOceanRenderer(canvas, {
            enableGradient: true,
            enableRays: true,
            enableBubbles: true,
            enablePlankton: true,
            profiling: false,
            dprCap: budget.dprCap,
            raysConfig: {
                rayCount: budget.lightRayCount,
            },
            bubblesConfig: {
                sourceWidthBase: budget.bubbleSourceWidthBase,
            },
            planktonConfig: {
                swarmCount: budget.swarmCount,
                particlesPerSwarm: budget.particlesPerSwarm,
                fineCount: budget.fineCount,
                microCount: budget.microCount,
            },
        });

        try {
            renderer.init();
            console.log(`[WebGL] Ocean Renderer initialized (tier=${tier} ${label}, awaiting MasterRenderer)`);
        } catch (error) {
            console.warn('WebGL2 not available, falling back to CSS background:', error.message);
        }

        window.webglOceanRenderer = renderer;
    }
}
