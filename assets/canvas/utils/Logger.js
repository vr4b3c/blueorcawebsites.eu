/**
 * Logger utility with debug levels
 * Allows conditional logging based on environment/config
 */

export class Logger {
    constructor(namespace = 'BlueOrca', debugMode = false) {
        this.namespace = namespace;
        this.debugMode = debugMode;
    }
    
    log(...args) {
        if (this.debugMode) {
            console.log(`[${this.namespace}]`, ...args);
        }
    }
    
    warn(...args) {
        console.warn(`[${this.namespace}]`, ...args);
    }
    
    error(...args) {
        console.error(`[${this.namespace}]`, ...args);
    }
    
    info(...args) {
        if (this.debugMode) {
            console.info(`[${this.namespace}]`, ...args);
        }
    }
}

// Create global logger instances
export const logger = new Logger('BlueOrca', false); // Production
export const debugLogger = new Logger('BlueOrca:Debug', true); // Development
