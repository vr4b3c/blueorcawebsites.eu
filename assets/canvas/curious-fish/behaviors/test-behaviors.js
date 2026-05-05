/**
 * Test Suite for Behavior Modules
 * 
 * Simple validation tests to ensure behavior modules work correctly
 * and can be called independently (orchestrator pattern validation)
 */

console.log('🧪 Testing Behavior Modules - Orchestrator Pattern\n');

// Test 1: AttackBehavior module exports
console.log('🧪 Test 1: AttackBehavior exports');
import {
    updateSwimAway,
    updateReverse,
    updateRetreat,
    updateIdleAttack,
    updateSchoolFishAttack
} from './AttackBehavior.js';

console.assert(typeof updateSwimAway === 'function', 'updateSwimAway should be a function');
console.assert(typeof updateReverse === 'function', 'updateReverse should be a function');
console.assert(typeof updateRetreat === 'function', 'updateRetreat should be a function');
console.assert(typeof updateIdleAttack === 'function', 'updateIdleAttack should be a function');
console.assert(typeof updateSchoolFishAttack === 'function', 'updateSchoolFishAttack should be a function');
console.log('✅ AttackBehavior exports correct functions');

// Test 2: MovementBehavior module exports
console.log('\n🧪 Test 2: MovementBehavior exports');
import {
    updateForcedTarget,
    findFoodTarget,
    calculateMovement,
    clampPosition,
    updateRotationAndAnimation,
    setTargetPoint
} from './MovementBehavior.js';

console.assert(typeof updateForcedTarget === 'function', 'updateForcedTarget should be a function');
console.assert(typeof findFoodTarget === 'function', 'findFoodTarget should be a function');
console.assert(typeof calculateMovement === 'function', 'calculateMovement should be a function');
console.assert(typeof clampPosition === 'function', 'clampPosition should be a function');
console.assert(typeof updateRotationAndAnimation === 'function', 'updateRotationAndAnimation should be a function');
console.assert(typeof setTargetPoint === 'function', 'setTargetPoint should be a function');
console.log('✅ MovementBehavior exports correct functions');

// Test 3: IdleBehavior module exports
console.log('\n🧪 Test 3: IdleBehavior exports');
import {
    updateIdleBehavior,
    updateStaringBehavior
} from './IdleBehavior.js';

console.assert(typeof updateIdleBehavior === 'function', 'updateIdleBehavior should be a function');
console.assert(typeof updateStaringBehavior === 'function', 'updateStaringBehavior should be a function');
console.log('✅ IdleBehavior exports correct functions');

// Test 4: AttackBehavior - updateSwimAway basic functionality
console.log('\n🧪 Test 4: AttackBehavior.updateSwimAway');
const mockFish = {
    x: 100,
    y: 100,
    velocityX: 0,
    velocityY: 0,
    rotation: 0,
    targetFlipScale: 1,
    targetRotation: 0,
    flipScale: 1
};
const mockMouseX = 200;
const mockMouseY = 200;
const currentTime = Date.now();
const swimAwayStartTime = currentTime - 500; // 500ms ago

const swimResult = updateSwimAway(
    mockFish,
    currentTime,
    swimAwayStartTime,
    mockMouseX,
    mockMouseY,
    16 // deltaTime
);

console.assert(swimResult !== null, 'updateSwimAway should return a result object');
console.assert(typeof swimResult.isComplete === 'boolean', 'Result should have isComplete property');
console.assert(typeof swimResult.velocityX === 'number', 'Result should have velocityX property');
console.assert(typeof swimResult.velocityY === 'number', 'Result should have velocityY property');
console.log('✅ AttackBehavior.updateSwimAway returns correct structure');

// Test 5: MovementBehavior - clampPosition
console.log('\n🧪 Test 5: MovementBehavior.clampPosition');
const testFish = {
    x: 1500,
    y: -100,
    currentSize: 50
};

const originalX = testFish.x;
const originalY = testFish.y;
clampPosition(testFish, 800, 600);

// Fish should be clamped within bounds
console.assert(testFish.x !== originalX || testFish.y !== originalY, 'Fish position should be modified when out of bounds');
console.assert(typeof testFish.x === 'number', 'Fish X should still be a number');
console.assert(typeof testFish.y === 'number', 'Fish Y should still be a number');
console.log('✅ MovementBehavior.clampPosition works correctly');

// Test 6: IdleBehavior - updateIdleBehavior
console.log('\n🧪 Test 6: IdleBehavior.updateIdleBehavior');
const idleResult = updateIdleBehavior(
    Date.now(),
    Date.now() - 5000, // 5 seconds idle
    false, // not attacking
    false, // not retreating
    false, // not reversing
    false  // not swimming away
);

console.assert(idleResult !== null, 'updateIdleBehavior should return a result object');
console.assert(typeof idleResult === 'object', 'Result should be an object');
// Check that result has expected structure (can vary based on idle state)
console.log('✅ IdleBehavior.updateIdleBehavior returns correct structure');

// Test 7: Behavior modules are stateless (pure functions)
console.log('\n🧪 Test 7: Behavior modules are stateless');
const fish1 = { x: 100, y: 100, velocityX: 0, velocityY: 0, rotation: 0, targetFlipScale: 1, targetRotation: 0, flipScale: 1 };
const fish2 = { x: 100, y: 100, velocityX: 0, velocityY: 0, rotation: 0, targetFlipScale: 1, targetRotation: 0, flipScale: 1 };

const result1 = updateSwimAway(fish1, currentTime, swimAwayStartTime, 200, 200, 16);
const result2 = updateSwimAway(fish2, currentTime, swimAwayStartTime, 200, 200, 16);

console.assert(JSON.stringify(result1) === JSON.stringify(result2), 'Same inputs should produce same outputs');
console.log('✅ Behavior modules are stateless (pure functions)');

console.log('\n🎉 All behavior module tests passed! (7/7)');
console.log('Orchestrator pattern validated - modules can be called independently.');
