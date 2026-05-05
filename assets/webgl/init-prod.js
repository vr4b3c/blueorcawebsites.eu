import { WebGLOceanRenderer } from './index.js';

const canvas = document.getElementById('webgl-ocean-background');

if (canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    const renderer = new WebGLOceanRenderer(canvas, {
        enableGradient: true,
        enableRays: true,
        enableBubbles: true,
        enablePlankton: true,
        profiling: false
    });

    try {
        renderer.init();
        console.log('WebGL Ocean Renderer initialized (awaiting MasterRenderer)');
    } catch (error) {
        console.warn('WebGL2 not available, falling back to CSS background:', error.message);
    }

    window.webglOceanRenderer = renderer;
}
