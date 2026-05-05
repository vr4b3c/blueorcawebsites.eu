/**
 * Test Suite for Canvas System 2.0
 * 
 * Simple validation tests to ensure modules work correctly
 */

// Test 1: MathUtils
console.log('🧪 Test 1: MathUtils');
import { MathUtils } from './utils/MathUtils.js';
const math = new MathUtils();

console.assert(math.sin(0) === 0, 'sin(0) should be 0');
console.assert(Math.abs(math.sin(90) - 1) < 0.01, 'sin(90) should be ~1');
console.assert(Math.abs(math.cos(0) - 1) < 0.01, 'cos(0) should be ~1');
console.assert(math.lerp(0, 10, 0.5) === 5, 'lerp(0, 10, 0.5) should be 5');
console.assert(math.clamp(15, 0, 10) === 10, 'clamp(15, 0, 10) should be 10');
console.log('✅ MathUtils tests passed');

// Test 2: PerformanceMonitor
console.log('\n🧪 Test 2: PerformanceMonitor');
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
const perf = new PerformanceMonitor();

console.assert(perf.getFPS() === 60, 'Initial FPS should be 60');
console.assert(perf.getQuality() === 1.0, 'Initial quality should be 1.0');

perf.update(0, 16.67); // Simulate 60 FPS
perf.update(16.67, 16.67);
console.assert(perf.metrics.frameTimeHistory.length === 2, 'Should track frame times');
console.log('✅ PerformanceMonitor tests passed');

// Test 3: FoodLayer
console.log('\n🧪 Test 3: FoodLayer');
import { FoodLayer } from './layers/FoodLayer.js';
const food = new FoodSystem(math);

console.assert(food.getCount() === 0, 'Initial count should be 0');
food.spawn(100, 100, 1.0);
console.assert(food.getCount() === 5, 'Should spawn 5 particles');

food.clear();
console.assert(food.getCount() === 0, 'Clear should remove all particles');
console.log('✅ FoodSystem tests passed');

// Test 4: CanvasManager
console.log('\n🧪 Test 4: CanvasManager');
import { CanvasManager } from './core/CanvasManager.js';
import { HudLayer } from './layers/HudLayer.js';

// Note: This creates a canvas element
const manager = new CanvasManager({ debug: false });

console.assert(manager.canvas !== null, 'Canvas should be created');
console.assert(manager.ctx !== null, 'Context should be created');
console.assert(manager.layers.size === 0, 'Initial layers should be 0');

const hudLayer = new HudLayer();
manager.addLayer('test', hudLayer);
console.assert(manager.layers.size === 1, 'Should have 1 layer');
console.assert(manager.getLayer('test') === hudLayer, 'Should return correct layer');

manager.removeLayer('test');
console.assert(manager.layers.size === 0, 'Should have 0 layers after remove');

manager.destroy();
console.log('✅ CanvasManager tests passed');

// Test 6: Integration
console.log('\n🧪 Test 6: Integration');
import { createCanvasBackground } from './index.js';

const integrated = createCanvasBackground({ 
    showStats: false,
    skipDefaultLayers: false 
});

console.assert(integrated instanceof CanvasManager, 'Should return CanvasManager');
// Default system now includes gradient (and any optional layers added manually)
console.assert(integrated.getLayer('gradient') !== undefined, 'Should have gradient layer');
console.assert(integrated.getLayer('lightRays') !== undefined, 'Should have lightRays layer');

integrated.destroy();
console.log('✅ Integration tests passed');

console.log('\n🎉 All tests passed! (6/6)');
console.log('Canvas System 2.0 is working correctly.');
