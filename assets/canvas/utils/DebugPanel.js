/**
 * DebugPanel - Advanced performance and statistics overlay
 * Shows detailed breakdown of render performance, layer stats, and system info
 */
export class DebugPanel {
    constructor() {
        this.visible = false;
        this.collapsed = false;
        this.element = null;
        this.lastKnownValues = {}; // Cache last known values to prevent blinking
        this.createPanel();
    }

    createPanel() {
        // Remove old panel if exists
        const existing = document.getElementById('debug-panel');
        if (existing) existing.remove();

        // Create panel container
        this.element = document.createElement('div');
        this.element.id = 'debug-panel';
        this.element.innerHTML = `
            <div class="debug-header" id="debug-header">
                <span class="debug-title">⚡ PERFORMANCE</span>
                <span class="debug-toggle" id="debug-toggle">−</span>
            </div>
            <div class="debug-content" id="debug-content">
                <div class="debug-section">
                    <div class="debug-row">
                        <span class="debug-label">FPS:</span>
                        <span class="debug-value" id="debug-fps">--</span>
                        <span class="debug-sublabel">/ <span id="debug-fps-max">--</span> max</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Render:</span>
                        <span class="debug-value" id="debug-render-time">--</span>
                        <span class="debug-sublabel">ms</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Total:</span>
                        <span class="debug-value-small" id="debug-total-time">--</span>
                        <span class="debug-sublabel">ms</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Idle:</span>
                        <span class="debug-value-small" id="debug-idle-time">--</span>
                        <span class="debug-sublabel">ms</span>
                    </div>
                </div>
                
                <div class="debug-separator">CANVAS 2D</div>
                <div class="debug-section">
                    <div class="debug-row-compact">
                        <span class="debug-layer">FishLayer</span>
                        <span class="debug-time" id="debug-fish-time">--</span>
                        <span class="debug-count" id="debug-fish-count">(--)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">CuriousFish</span>
                        <span class="debug-time" id="debug-curious-time">--</span>
                        <span class="debug-count" id="debug-curious-count">(1)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">HudLayer</span>
                        <span class="debug-time" id="debug-hud-time">--</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Food</span>
                        <span class="debug-time" id="debug-food-time">--</span>
                        <span class="debug-count" id="debug-food-count">(--)</span>
                    </div>
                </div>
                
                <div class="debug-separator">WEBGL</div>
                <div class="debug-section">
                    <div class="debug-row-compact">
                        <span class="debug-layer">Light Rays</span>
                        <span class="debug-time" id="debug-rays-time">--</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Bubbles</span>
                        <span class="debug-time" id="debug-bubbles-time">--</span>
                        <span class="debug-count" id="debug-bubbles-count">(--)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Plankton</span>
                        <span class="debug-time" id="debug-plankton-time">--</span>
                        <span class="debug-count" id="debug-plankton-count">(--)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Gradient</span>
                        <span class="debug-time" id="debug-gradient-time">--</span>
                    </div>
                </div>
                
                <div class="debug-separator">SYSTEM</div>
                <div class="debug-section">
                    <div class="debug-row">
                        <span class="debug-label">Quality:</span>
                        <span class="debug-value" id="debug-quality">100</span>
                        <span class="debug-sublabel">%</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Resolution:</span>
                        <span class="debug-value-small" id="debug-resolution">--</span>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();

        // Append to body
        document.body.appendChild(this.element);
        if (!this.visible) this.element.style.display = 'none';
        const toggle = document.getElementById('debug-toggle');
        const header = document.getElementById('debug-header');
        if (toggle && header) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => this.toggle());
        }
    }

    addStyles() {
        const styleId = 'debug-panel-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #debug-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 0;
                font-family: 'Monaco', 'Courier New', monospace;
                font-size: 11px;
                color: #fff;
                z-index: 10000;
                min-width: 240px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }
            
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px 8px 0 0;
            }
            
            .debug-title {
                font-weight: 600;
                font-size: 12px;
                letter-spacing: 0.5px;
            }
            
            .debug-toggle {
                font-size: 16px;
                line-height: 1;
                opacity: 0.6;
                transition: opacity 0.2s;
            }
            
            .debug-toggle:hover {
                opacity: 1;
            }
            
            .debug-content {
                padding: 8px 0;
                transition: max-height 0.3s, opacity 0.3s;
                overflow: hidden;
            }
            
            .debug-content.collapsed {
                max-height: 0 !important;
                opacity: 0;
                padding: 0;
            }
            
            .debug-section {
                padding: 6px 12px;
            }
            
            .debug-separator {
                font-size: 9px;
                font-weight: 600;
                color: #888;
                padding: 8px 12px 4px 12px;
                letter-spacing: 1px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                margin-top: 4px;
            }
            
            .debug-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 6px;
                gap: 6px;
            }
            
            .debug-row-compact {
                display: flex;
                align-items: baseline;
                margin-bottom: 4px;
                gap: 6px;
                font-size: 10px;
            }
            
            .debug-label {
                color: #888;
                min-width: 70px;
            }
            
            .debug-layer {
                color: #888;
                flex: 1;
                min-width: 90px;
            }
            
            .debug-value {
                color: #4ade80;
                font-weight: 600;
                font-size: 14px;
            }
            
            .debug-value.warning {
                color: #fbbf24;
            }
            
            .debug-value.error {
                color: #f87171;
            }
            
            .debug-value-small {
                color: #4ade80;
                font-size: 10px;
            }
            
            .debug-sublabel {
                color: #666;
                font-size: 10px;
            }
            
            .debug-time {
                color: #4ade80;
                font-weight: 500;
                min-width: 45px;
                text-align: right;
            }
            
            .debug-time.slow {
                color: #fbbf24;
            }
            
            .debug-time.very-slow {
                color: #f87171;
            }
            
            .debug-count {
                color: #666;
                font-size: 9px;
                min-width: 35px;
            }
        `;
        document.head.appendChild(style);
    }

    toggle() {
        this.collapsed = !this.collapsed;
        const content = document.getElementById('debug-content');
        const toggle = document.getElementById('debug-toggle');
        if (content && toggle) {
            content.classList.toggle('collapsed', this.collapsed);
            toggle.textContent = this.collapsed ? '+' : '−';
        }
    }

    update(stats) {
        if (!this.visible) return;

        // Main FPS
        const fpsEl = document.getElementById('debug-fps');
        const fpsMaxEl = document.getElementById('debug-fps-max');
        if (fpsEl && stats.fps !== undefined) {
            fpsEl.textContent = stats.fps;
            fpsEl.className = 'debug-value';
            if (stats.fps < 40) fpsEl.classList.add('error');
            else if (stats.fps < 55) fpsEl.classList.add('warning');
        }
        if (fpsMaxEl && stats.theoreticalFPS !== undefined) {
            fpsMaxEl.textContent = stats.theoreticalFPS;
        }

        // Render time
        const renderTimeEl = document.getElementById('debug-render-time');
        if (renderTimeEl && stats.renderTime !== undefined) {
            renderTimeEl.textContent = stats.renderTime.toFixed(2);
        }
        
        // Total frame time
        const totalTimeEl = document.getElementById('debug-total-time');
        if (totalTimeEl && stats.totalFrameTime !== undefined) {
            totalTimeEl.textContent = stats.totalFrameTime.toFixed(2);
        }
        
        // Idle time (browser overhead)
        const idleTimeEl = document.getElementById('debug-idle-time');
        if (idleTimeEl && stats.idleTime !== undefined) {
            idleTimeEl.textContent = stats.idleTime.toFixed(2);
        }

        // Canvas 2D layers
        this.updateLayerTime('fish', stats.layers?.FishLayer);
        this.updateLayerTime('curious', stats.layers?.CuriousFishLayer);
        this.updateLayerTime('hud', stats.layers?.HudLayer);
        this.updateLayerTime('food', stats.food);

        // WebGL layers
        this.updateLayerTime('rays', stats.webgl?.rays);
        this.updateLayerTime('bubbles', stats.webgl?.bubbles);
        this.updateLayerTime('plankton', stats.webgl?.plankton);
        this.updateLayerTime('gradient', stats.webgl?.gradient);

        // Counts
        this.updateCount('fish-count', stats.counts?.fish);
        this.updateCount('food-count', stats.counts?.food);
        this.updateCount('bubbles-count', stats.counts?.bubbles);
        this.updateCount('plankton-count', stats.counts?.plankton);

        // System
        const qualityEl = document.getElementById('debug-quality');
        if (qualityEl && stats.quality !== undefined) {
            qualityEl.textContent = Math.round(stats.quality * 100);
        }

        const resEl = document.getElementById('debug-resolution');
        if (resEl && stats.resolution) {
            resEl.textContent = stats.resolution;
        }
    }

    updateLayerTime(id, value) {
        const el = document.getElementById(`debug-${id}-time`);
        if (!el) return;

        // Extract time from various formats
        let time = 0;
        if (typeof value === 'number') {
            time = value;
        } else if (value && value.time !== undefined) {
            time = value.time;
        } else if (value && value.avg !== undefined) {
            time = value.avg;
        }
        
        // If we have a valid time, update and cache it
        if (time > 0) {
            this.lastKnownValues[id] = time;
            el.textContent = `${time.toFixed(2)}ms`;
            el.className = 'debug-time';
            
            if (time > 2) el.classList.add('very-slow');
            else if (time > 1) el.classList.add('slow');
        } else if (this.lastKnownValues[id] !== undefined) {
            // Use cached value if available
            const cachedTime = this.lastKnownValues[id];
            el.textContent = `${cachedTime.toFixed(2)}ms`;
            el.className = 'debug-time';
            
            if (cachedTime > 2) el.classList.add('very-slow');
            else if (cachedTime > 1) el.classList.add('slow');
        } else {
            // No data at all
            el.textContent = '-';
            el.className = 'debug-time';
        }
    }

    updateCount(id, value) {
        const el = document.getElementById(id);
        if (!el) return;

        if (value !== undefined && value !== null) {
            this.lastKnownValues[`count-${id}`] = value;
            el.textContent = `(${value})`;
        } else if (this.lastKnownValues[`count-${id}`] !== undefined) {
            // Use cached value
            el.textContent = `(${this.lastKnownValues[`count-${id}`]})`;
        } else {
            el.textContent = '(-)';
        }
    }

    show() {
        this.visible = true;
        if (this.element) this.element.style.display = 'block';
    }

    hide() {
        this.visible = false;
        if (this.element) this.element.style.display = 'none';
    }

    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        const styles = document.getElementById('debug-panel-styles');
        if (styles) styles.remove();
    }
}
