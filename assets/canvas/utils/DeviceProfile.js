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
        swarmCount: 3,
        particlesPerSwarm: 8,
        fineCount: 60,
        microCount: 20,
        lightRayCount: 1,
        bubbleSourceWidthBase: 1400,
        schoolDensity: 650000,
        canvas2dFPS: 24,
        dprCap: 1.0,
    },
    // Tier 1 — mobile-medium
    {
        swarmCount: 6,
        particlesPerSwarm: 16,
        fineCount: 180,
        microCount: 60,
        lightRayCount: 2,
        bubbleSourceWidthBase: 1000,
        schoolDensity: 450000,
        canvas2dFPS: 28,
        dprCap: 1.0,
    },
    // Tier 2 — desktop-light
    {
        swarmCount: 20,
        particlesPerSwarm: 45,
        fineCount: 900,
        microCount: 300,
        lightRayCount: 4,
        bubbleSourceWidthBase: 550,
        schoolDensity: 175000,
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
        schoolDensity: 130000,
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
 * @property {boolean} isMobile
 * @property {boolean} isLowPower
 * @property {boolean} prefersReducedMotion
 * @property {boolean} saveData
 */

/** @type {DeviceProfile|null} */
let _cached = null;

function getViewportScaledBudget(baseBudget, area) {
    const scaledBudget = { ...baseBudget };

    if (area >= 7_000_000) {
        scaledBudget.swarmCount = Math.min(scaledBudget.swarmCount, 16);
        scaledBudget.particlesPerSwarm = Math.min(scaledBudget.particlesPerSwarm, 32);
        scaledBudget.fineCount = Math.min(scaledBudget.fineCount, 700);
        scaledBudget.microCount = Math.min(scaledBudget.microCount, 180);
        scaledBudget.lightRayCount = Math.min(scaledBudget.lightRayCount, 3);
        scaledBudget.bubbleSourceWidthBase = Math.max(scaledBudget.bubbleSourceWidthBase, 800);
        scaledBudget.schoolDensity = Math.max(scaledBudget.schoolDensity, 1_000_000);
        scaledBudget.canvas2dFPS = Math.min(scaledBudget.canvas2dFPS, 30);
        scaledBudget.dprCap = Math.min(scaledBudget.dprCap, 0.75);
    } else if (area >= 4_000_000) {
        scaledBudget.swarmCount = Math.min(scaledBudget.swarmCount, 20);
        scaledBudget.particlesPerSwarm = Math.min(scaledBudget.particlesPerSwarm, 36);
        scaledBudget.fineCount = Math.min(scaledBudget.fineCount, 900);
        scaledBudget.microCount = Math.min(scaledBudget.microCount, 250);
        scaledBudget.lightRayCount = Math.min(scaledBudget.lightRayCount, 4);
        scaledBudget.bubbleSourceWidthBase = Math.max(scaledBudget.bubbleSourceWidthBase, 650);
        scaledBudget.schoolDensity = Math.max(scaledBudget.schoolDensity, 800_000);
        scaledBudget.canvas2dFPS = Math.min(scaledBudget.canvas2dFPS, 35);
        scaledBudget.dprCap = Math.min(scaledBudget.dprCap, 0.85);
    } else if (area >= 2_500_000) {
        scaledBudget.swarmCount = Math.min(scaledBudget.swarmCount, 24);
        scaledBudget.particlesPerSwarm = Math.min(scaledBudget.particlesPerSwarm, 42);
        scaledBudget.fineCount = Math.min(scaledBudget.fineCount, 1100);
        scaledBudget.microCount = Math.min(scaledBudget.microCount, 320);
        scaledBudget.lightRayCount = Math.min(scaledBudget.lightRayCount, 4);
        scaledBudget.bubbleSourceWidthBase = Math.max(scaledBudget.bubbleSourceWidthBase, 520);
        scaledBudget.schoolDensity = Math.max(scaledBudget.schoolDensity, 550_000);
        scaledBudget.canvas2dFPS = Math.min(scaledBudget.canvas2dFPS, 40);
        scaledBudget.dprCap = Math.min(scaledBudget.dprCap, 1.0);
    }

    return scaledBudget;
}

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
    const memory = navigator.deviceMemory || 4;
    const connType = navigator.connection?.effectiveType ?? '';
    const saveData = navigator.connection?.saveData === true;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const isMobile = vw < 700 || (navigator.maxTouchPoints > 0 && Math.min(vw, vh) < 700);
    const slowConnection = connType === '2g' || connType === 'slow-2g';
    const constrainedPhone = isMobile && (cores <= 4 || dpr >= 2 || memory <= 4);
    const isLowPower = prefersReducedMotion || saveData || slowConnection || constrainedPhone || memory <= 2;

    let tier;

    if (
        area < 350_000 ||
        prefersReducedMotion ||
        saveData ||
        slowConnection ||
        constrainedPhone ||
        (cores <= 2 && dpr > 1.5)
    ) {
        tier = 0;
    } else if (isMobile || area < 700_000 || cores <= 2) {
        tier = 1;
    } else if (area < 1_500_000 || cores <= 4) {
        tier = 2;
    } else {
        tier = 3;
    }

    _cached = {
        tier,
        label: TIER_LABELS[tier],
        entityBudget: getViewportScaledBudget(BUDGETS[tier], area),
        isMobile,
        isLowPower,
        prefersReducedMotion,
        saveData,
    };

    return _cached;
}
