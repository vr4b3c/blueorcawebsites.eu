import { WebGLOceanRenderer } from './index.js';
import { getDeviceProfile } from '../canvas/utils/DeviceProfile.js';

const canvas = document.getElementById('webgl-ocean-background');
const bootstrapState = window.blueOrcaRenderBootstrap = {
    preferLiteCanvasEffects: false,
    webglStatus: 'unavailable'
};

window.webglOceanRenderer = null;

if (canvas) {
    const enableCssFallback = (message, error, options = {}) => {
        const { preferLiteCanvasEffects = false, webglStatus = 'fallback' } = options;

        canvas.style.display = 'none';
        document.body.classList.remove('has-webgl');
        window.webglOceanRenderer = null;
        bootstrapState.webglStatus = webglStatus;
        bootstrapState.preferLiteCanvasEffects = bootstrapState.preferLiteCanvasEffects || preferLiteCanvasEffects;

        if (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`[WebGL] ${message}: ${reason}`);
        } else {
            console.info(`[WebGL] ${message}`);
        }
    };

    const { tier, label, entityBudget: budget } = getDeviceProfile();

    // Tier 0 (mobile-low): skip WebGL entirely — CSS gradient fallback visible.
    // MasterRenderer will start at Tier 1 (Canvas only).
    if (tier === 0) {
        enableCssFallback(`Skipping WebGL on ${label} device — CSS fallback active`, null, {
            preferLiteCanvasEffects: true,
            webglStatus: 'skipped-low-tier'
        });
    } else {
        canvas.style.display = '';
        const dpr = Math.min(window.devicePixelRatio || 1, budget.dprCap);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';

        const renderer = new WebGLOceanRenderer(canvas, {
            enableGradient: true,
            enableRays: false,
            enableBubbles: true,
            enablePlankton: true,
            enableWaterSurface: false,
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
            if (renderer.isSoftwareRenderer()) {
                throw new Error('Software WebGL renderer detected');
            }
            // Force a silent pre-warm frame: drives Chrome's GPU process to compile all
            // shaders immediately at startup instead of deferring to the first visible
            // frame (which caused 15–18s GPU spikes observed in DevTools trace).
            renderer.renderFrame(0, 0);
            window.webglOceanRenderer = renderer;
            bootstrapState.webglStatus = 'active';
            bootstrapState.preferLiteCanvasEffects = false;
            console.log(`[WebGL] Ocean Renderer initialized (tier=${tier} ${label}, awaiting MasterRenderer)`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            enableCssFallback('WebGL init failed, falling back to CSS background', error, {
                preferLiteCanvasEffects: /software webgl renderer/i.test(message),
                webglStatus: /software webgl renderer/i.test(message) ? 'software-renderer' : 'init-failed'
            });
        }
    }
}
