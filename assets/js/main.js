// Combined entry point — bundled at build time into assets/js/dist/app.js
// Import order matters: webgl sets window.webglOceanRenderer before canvas reads it.
import '../webgl/init-prod.js';
import '../canvas/init.js';
