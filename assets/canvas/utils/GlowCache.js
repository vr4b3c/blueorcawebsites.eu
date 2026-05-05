/**
 * GlowCache — pre-rendered radial glow textures.
 *
 * Replaces per-frame ctx.shadowBlur (GPU-expensive) with a single
 * ctx.drawImage of a pre-baked OffscreenCanvas. The texture is scaled
 * to match the fish's current size, so one canvas per color is enough.
 *
 * Usage (inside ctx.save() / translate(fishX,fishY) / rotate() block,
 * BEFORE drawing the fish image so the glow sits behind it):
 *
 *   import { drawGlow } from '../utils/GlowCache.js';
 *   drawGlow(ctx, fish.currentSize, 'blue');   // centered at ctx origin
 *   ctx.drawImage(fishImage, ...);
 */

// Reference size used when pre-rendering. Textures are scaled at draw time.
const REF_SIZE = 80;

// blur radius as a fraction of fish size (matches old shadowBlur = size * 0.6)
const BLUR_RATIO = 0.6;

// total glow radius = fish_radius + blur_radius = REF_SIZE * (1 + BLUR_RATIO)
const TOTAL_RADIUS = REF_SIZE * (1 + BLUR_RATIO); // 128

// fish edge expressed as fraction of TOTAL_RADIUS (gradient coordinate 0–1)
const FISH_FRAC = REF_SIZE / TOTAL_RADIUS; // ≈ 0.625

const _cache = {};
let _ready = false;

/**
 * @param {number} r   red   0-255
 * @param {number} g   green 0-255
 * @param {number} b   blue  0-255
 * @param {number} a   peak alpha 0-1 (applied at gradient stops inside the fish radius)
 * @returns {OffscreenCanvas}
 */
function _build(r, g, b, a) {
    const dim = Math.ceil(TOTAL_RADIUS * 2) + 8; // a few pixels of safety margin
    const oc = new OffscreenCanvas(dim, dim);
    const ctx = oc.getContext('2d');
    const cx = dim / 2;
    const cy = dim / 2;

    // Radial gradient: solid colour out to the fish edge, then fades to 0.
    // The fish image is drawn on top and covers the solid inner disk,
    // so only the soft outer ring is visible.
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TOTAL_RADIUS);
    grad.addColorStop(0,          `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(FISH_FRAC,  `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(1,          `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, TOTAL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    return oc;
}

function _init() {
    if (_ready) return;
    _ready = true;
    _cache.pink     = _build(255, 105, 180, 0.55); // hasPinkGlow
    _cache.blue     = _build(100, 200, 255, 0.55); // hasBlueGlow (babies / young)
    _cache.softblue = _build(100, 200, 255, 0.35); // default curiousfish glow
}

/**
 * Draw the glow halo centered at (0, 0) in the current context transform.
 * Must be called BEFORE drawing the fish image (glow renders behind it).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size  fish.currentSize (radius in px)
 * @param {'pink'|'blue'|'softblue'} key
 */
export function drawGlow(ctx, size, key) {
    _init();
    const tex = _cache[key];
    if (!tex) return;
    const scale = size / REF_SIZE;
    const w = tex.width * scale;
    const h = tex.height * scale;
    ctx.drawImage(tex, -w / 2, -h / 2, w, h);
}
