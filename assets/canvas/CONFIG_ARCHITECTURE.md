# Canvas Configuration Architecture

## Single Source of Truth Principle

All canvas layers follow **DRY (Don't Repeat Yourself)** principle with a clear configuration hierarchy:

```
Layer.DEFAULT_CONFIG (source of truth)
    ↓
init.js layerConfig (optional overrides)
    ↓
ice-switcher.js updateConfig() (runtime changes)
```

## Layer Configurations

### FoodLayer

All defaults defined in **one place only**: `FoodLayer.DEFAULT_CONFIG`

```javascript
// canvas/layers/FoodLayer.js
static DEFAULT_CONFIG = {
    count: 6,           // Number of particles
    size: 5,            // Base size in pixels
    fallSpeed: 0.25,    // Fall speed (pixels per frame at 60fps)
    spread: 30,         // Horizontal spawn spread
    shrinkRate: 0.05    // Shrink rate (pixels per second)
};
```

### FishLayer (School Fish)

```javascript
// canvas/layers/FishLayer.js
static DEFAULT_CONFIG = {
    schoolCount: 6,      // Number of schools
    size: 1.2,           // Size multiplier (0.5-2x)
    avoidRadius: 100,    // Radius to avoid mouse cursor
    showDebug: false     // Debug visualization
};
```

### CuriousFishLayer (Player Fish)

```javascript
// canvas/layers/CuriousFishLayer.js
static DEFAULT_CONFIG = {
    speed: 5.0,          // Fish movement speed
    maxSpeed: 2.0,       // Maximum speed
    size: 30,            // Initial fish size
    maxFishSize: 150,    // Maximum fish size
    followDistance: 60,  // Distance to follow cursor
    rotationSpeed: 0.03, // Rotation interpolation speed
    heartSpawnRate: 500, // Heart spawn interval (ms)
    imageSrc: 'assets/images/fish/curiousfish.png',
    showDebug: false,
    swimAwaySpeed: 3
};
```

### HudLayer

```javascript
// canvas/layers/HudLayer.js
static DEFAULT_CONFIG = {
    hudOpacity: 0,                 // Start hidden (animated in via ejectHud)
    hudTargetOffset: 0,            // Final position offset
    phaseTransitionDuration: 900,  // Phase transition animation (ms)
    phaseTransitionDelay: 1000,    // Delay before transition (ms)
    deathDuration: 3000,           // Death animation duration (ms)
    deathRestartDuration: 3000,    // Wait before restart (ms)
    gameCompleteDuration: 5000,    // Auto-restart after win (ms)
    ejectDuration: 400,            // HUD slide-in duration (ms)
    progressSpeed: 0.04            // Progress bar interpolation speed
};
```

## Override Hierarchy

### 1. Initialization Override (init.js)
Optional overrides when creating layers:

```javascript
const manager = createCanvasBackground({
    foodConfig: {
        count: 10,      // Override FoodLayer.DEFAULT_CONFIG
        size: 6
    },
    fishConfig: {
        schoolCount: 8  // Override FishLayer.DEFAULT_CONFIG
    }
});

// Layers created with config
const fishLayer = new FishLayer(manager.config.fishConfig);
const hudLayer = new HudLayer(manager.config.hudConfig);
```

### 2. Runtime Updates (ice-switcher.js)
Dynamic changes via public API or direct config:

```javascript
// FoodLayer - has updateConfig() method
manager.foodLayer.updateConfig({
    count: parseInt(foodCountInput.value),
    size: parseFloat(foodSizeInput.value)
});

// Other layers - direct config modification
const fishLayer = manager.getLayer('fish');
fishLayer.config.schoolCount = newValue;
```

## Implementation Details

### All Layers Follow Same Pattern:
```javascript
export class SomeLayer {
    static DEFAULT_CONFIG = { /* defaults */ };
    
    constructor(options = {}) {
        this.config = {
            ...SomeLayer.DEFAULT_CONFIG,
            ...options  // Override with provided config
        };
    }
}
```

### Layer-Specific Details:

**FoodLayer** - Has `updateConfig()` method for runtime changes
**FishLayer** - Config accessed via `layer.config`
**CuriousFishLayer** - Config accessed via `layer.config`  
**HudLayer** - Config properties initialized in constructor from config values

### CanvasManager.js
- Passes layer-specific configs through `options.layerConfig`
- Exposes `this.foodLayer` directly
- Other layers via `manager.getLayer('layerName')`

### init.js
- Optional config objects for each layer (`foodConfig`, `fishConfig`, `hudConfig`, etc.)
- Comments show all available parameters with their defaults
- Empty/missing config = use all defaults from Layer.DEFAULT_CONFIG

## Migration Notes

### ❌ Removed (deprecated)
```javascript
// OLD - multiple sources of truth
manager.foodConfig = {...};              // DELETED
manager.foodConfig.count = 10;           // DELETED
CanvasManager default foodConfig         // DELETED
```

### ✅ Current (single source)
```javascript
// NEW - one source of truth
FoodLayer.DEFAULT_CONFIG                // Static defaults
manager.foodLayer.updateConfig({...});  // Runtime updates
```

## Benefits

1. **No Duplication** - Config values defined in exactly ONE place
2. **Clear Hierarchy** - Defaults → Init Override → Runtime Update
3. **Defensive Copy** - External changes don't mutate internal state
4. **Easy Maintenance** - Change defaults in one file only
5. **Self-Documenting** - `DEFAULT_CONFIG` shows all available options

## Testing Changes

```javascript
// Check default values
console.log(FoodLayer.DEFAULT_CONFIG);

// Check applied config
console.log(manager.foodLayer.config);

// Update at runtime
manager.foodLayer.updateConfig({ count: 20 });
```
