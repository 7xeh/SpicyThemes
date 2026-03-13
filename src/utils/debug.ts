import { storage } from './storage';

let debugMode: boolean = storage.get('debug-mode') === 'true';

const PREFIX = '[SpicyThemes]';

export function isDebugEnabled(): boolean {
    return debugMode;
}

export function setDebugMode(enabled: boolean): void {
    debugMode = enabled;
    storage.set('debug-mode', enabled.toString());
    if (enabled) {
        console.log(`${PREFIX} Debug mode enabled`);
    }
}

export function debug(...args: unknown[]): void {
    if (debugMode) {
        console.log(PREFIX, ...args);
    }
}

export function info(...args: unknown[]): void {
    console.log(PREFIX, ...args);
}

export function warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
}

export function error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
}
