/**
 * DeviceProfile — central device capability detection.
 *
 * Determines a performance tier (0–3) from viewport size, CPU cores,
 * device pixel ratio and network speed, then exposes a matching entity
 * budget consumed by every layer/renderer that creates particles or fish.
 *
 * Tier labels:
 *   0 — mobile-low      (old phones, slow connections)
 *   1 — mobile-medium   (mid-range phones / small tablets)
 *   2 — desktop-light   (low-end desktops / large tablets)
 *   3 — desktop-full    (modern desktops)
 */

/** @typedef {'mobile-low'|'mobile-medium'|'desktop-light'|'desktop-full'} TierLabel */

/**
 * @typedef {Object} EntityBudget
 * @property {number} swarmCount          - PlanktonLayer swarm count
 * @property {number} particlesPerSwarm   - PlanktonLayer particles per swarm
 * @property {number} fineCount           - PlanktonLayer fine particles
 * @property {number} microCount          - PlanktonLayer micro particles
 * @property {number} lightRayCount       - LightRaysLayer ray count
 * @property {number} bubbleSourceWidthBase - px of viewport per bubble source
 * @property {number} schoolDensity       - px² per fish school (FishLayer)
 * @property {number} canvas2dFPS         - Target FPS for 2D canvas throttle
 * @property {number} dprCap              - Maximum devicePixelRatio to use
 */

/** @type {EntityBudget[]} index = tier */
const BUDGETS = [
    // Tier 0 — mobile-low
    {
        swarmCount: 5,
        particlesPerSwarm: 15,
        fineCount: 150,
        microCount: 50,
        lightRayCount: 2,
        bubbleSourceWidthBase: 900,
        schoolDensity: 150000,
        canvas2dFPS: 30,
        dprCap: 1.0,
    },
    // Tier 1 — mobile-medium
    {
        swarmCount: 12,
        particlesPerSwarm: 30,
        fineCount: 400,
        microCount: 150,
        lightRayCount: 3,
        bubbleSourceWidthBase: 700,
        schoolDensity: 180000,
        canvas2dFPS: 35,
        dprCap: 1.25,
    },
    // Tier 2 — desktop-light
    {
        swarmCount: 20,
        particlesPerSwarm: 45,
        fineCount: 900,
        microCount: 300,
        lightRayCount: 4,
        bubbleSourceWidthBase: 550,
        schoolDensity: 220000,
        canvas2dFPS: 40,
        dprCap: 1.5,
    },
    // Tier 3 — desktop-full
    {
        swarmCount: 30,
        particlesPerSwarm: 50,
        fineCount: 1500,
        microCount: 500,
        lightRayCount: 5,
        bubbleSourceWidthBase: 400,
        schoolDensity: 250000,
        canvas2dFPS: 45,
        dprCap: 2.0,
    },
];

/** @type {TierLabel[]} */
const TIER_LABELS = ['mobile-low', 'mobile-medium', 'desktop-light', 'desktop-full'];

/**
 * @typedef {Object} DeviceProfile
 * @property {number} tier
 * @property {TierLabel} label
 * @property {EntityBudget} entityBudget
 */

/** @type {DeviceProfile|null} */
let _cached = null;

/**
 * Detect the device tier and return the corresponding profile.
 * Result is cached — multiple calls are free.
 *
 * @returns {DeviceProfile}
 */
export function getDeviceProfile() {
    if (_cached) return _cached;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const area = vw * vh;
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = window.devicePixelRatio || 1;
    const connType = navigator.connection?.effectiveType ?? '';

    let tier;

    if (
        area < 350_000 ||
        connType === '2g' ||
        connType === 'slow-2g' ||
        (cores <= 2 && dpr > 1.5)
    ) {
        tier = 0;
    } else if (area < 600_000 || cores <= 2) {
        tier = 1;
    } else if (area < 1_500_000 || cores <= 4) {
        tier = 2;
    } else {
        tier = 3;
    }

    _cached = {
        tier,
        label: TIER_LABELS[tier],
        entityBudget: BUDGETS[tier],
    };

    console.info(
        `[DeviceProfile] tier=${tier} (${_cached.label}) | ${vw}×${vh}px | cores=${cores} dpr=${dpr} conn=${connType || 'unknown'}`
    );

    return _cached;
}
