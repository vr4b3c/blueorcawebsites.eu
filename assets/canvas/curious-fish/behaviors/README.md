# Behavior Modules Refactoring

## Overview
This directory contains extracted behavior modules for the Curious Fish system, implementing the **Orchestrator Pattern** to separate concerns and improve maintainability.

## Refactoring Summary
**Date**: 2026-01-29  
**Original File**: `canvas/layers/CuriousFishLayer.js` (~1772 lines)  
**Refactored File**: `canvas/layers/CuriousFishLayer.js` (1513 lines)  
**Lines Extracted**: ~259 lines to behavior modules

## Architecture

### Before Refactoring
CuriousFishLayer.js was a monolithic file containing:
- Inline death animation logic
- Inline mating/dance logic
- Inline attack logic (idle attacks, school fish attacks)
- Inline movement logic (following cursor, fleeing, food chasing)
- Inline idle behavior logic
- State management
- Rendering coordination

### After Refactoring
CuriousFishLayer.js now acts as an **Orchestrator** that:
- Manages state
- Calls behavior modules
- Handles rendering coordination

## Behavior Modules

### 1. AttackBehavior.js (358 lines)
Handles all attack-related behaviors:
- **updateSwimAway**: Swimming away after idle attacks (after 3 attacks)
- **updateReverse**: Reversing before idle attack
- **updateRetreat**: Retreating to original position after attack
- **updateIdleAttack**: Charging at cursor (idle attack behavior)
- **updateSchoolFishAttack**: Direct charge attack on school fish

### 2. MovementBehavior.js (445 lines)
Handles all movement-related behaviors:
- **updateForcedTarget**: Direct navigation to specific point
- **findFoodTarget**: Food detection in field of view
- **calculateMovement**: Movement towards target (cursor or food)
- **clampPosition**: Position clamping to canvas bounds
- **updateRotationAndAnimation**: Rotation and animation updates
- **setTargetPoint**: Set target point for fish movement

### 3. IdleBehavior.js (88 lines)
Handles idle behavior:
- **updateIdleBehavior**: Detect idle phases and spawn symbols
- **updateStaringBehavior**: Staring behavior for heart spawning

## Existing Modules (Already Extracted)

### scenarios/DeathScenario.js
Death animation and respawn logic:
- **initializeDeathAnimation**: Initialize death explosion
- **isDeathAnimationComplete**: Check if death animation complete
- **scriptDeath**: Finalize death - set game-over state
- **respawnAfterDeath**: Respawn curious fish after death

### scenarios/MatingScenario.js
Mating dance and reproduction logic:
- **initiateMatingDance**: Initialize mating dance
- **updateMatingDance**: Update mating dance state
- **completeMatingDance**: Complete mating dance
- **spawnBabyFish**: Spawn baby fish after mating

### phases/LifecyclePhases.js
Lifecycle phase management:
- **getCurrentPhaseConfig**: Get phase configuration
- **canPerformAction**: Check if action allowed
- **updateLifecyclePhase**: Update lifecycle phase

## Integration Pattern

All behavior modules export **functions** that:
1. Accept necessary context (fish, config, deltaTime, etc.)
2. Perform calculations AS-IS (no behavior changes)
3. Return results including mutation instructions

**Note on Purity**: While most functions are pure (no side effects), some functions return mutation objects that the orchestrator must apply. This hybrid approach maintains the original behavior while allowing for easier testing of the calculation logic. Functions that require mutations include:
- `findFoodTarget`: Returns `mutations` object with `targetedFood` and `foodUpdates`
- `updateSchoolFishAttack`: Returns `targetMutations` object for target fish updates

The orchestrator (CuriousFishLayer) applies these mutations to maintain state consistency.

### Example Usage

```javascript
// Attack behavior with target mutations
const attackResult = updateSchoolFishAttack(
    this.fish,
    this.targetSchoolFish,
    fishLayer,
    onVictory,
    onDefeat,
    spawnHeart,
    maxFishSize
);

// Apply target mutations
if (attackResult.targetMutations && this.targetSchoolFish) {
    Object.assign(this.targetSchoolFish, attackResult.targetMutations);
}
```

## Benefits

### 1. Separation of Concerns
- Each module has a single responsibility
- Business logic separated from orchestration
- Easier to test individual behaviors

### 2. Maintainability
- Smaller, focused files
- Clear module boundaries
- Easier to locate and fix bugs

### 3. Reusability
- Behavior modules can be reused by other fish types
- Pure functions are easy to test
- No hidden dependencies

### 4. Scalability
- Easy to add new behaviors
- Can extend modules without modifying orchestrator
- Clear extension points

## Constants

**FISH_SIZE_FACTORS** and **ICON_SPAWN_CONFIG** remain in CuriousFishLayer.js as they are configuration constants used across multiple modules.

## Testing Strategy

Behavior modules can be tested independently:
```javascript
import { updateIdleAttack } from './behaviors/AttackBehavior.js';

// Unit test
const result = updateIdleAttack(mockFish, 100, 100, Date.now(), 0, 3, 0, 0, FACTORS);
assert(result.velocityX !== undefined);
```

## Future Improvements

1. **Extract Constants**: Move FISH_SIZE_FACTORS and ICON_SPAWN_CONFIG to `constants.js`
2. **Add TypeScript**: Add type definitions for better IDE support
3. **Add Tests**: Unit tests for each behavior function
4. **Performance Monitoring**: Add performance metrics for behavior calls
5. **State Machine**: Consider implementing formal state machine for attack states

## Migration Notes

- **No behavior changes**: All logic extracted AS-IS
- **Same function signatures**: Consistent with existing DeathScenario/MatingScenario modules
- **Backward compatible**: External interfaces remain unchanged
- **Zero refactoring debt**: Clean orchestrator pattern implemented
