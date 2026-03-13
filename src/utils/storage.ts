const STORAGE_PREFIX = "spicy-themes:";

function isLocalStorageAvailable(): boolean {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

export const storage = {
    get(key: string): string | null {
        try {
            if (!isLocalStorageAvailable()) return null;
            return localStorage.getItem(STORAGE_PREFIX + key);
        } catch (e) {
            console.error("[SpicyThemes] Storage get error:", e);
            return null;
        }
    },

    set(key: string, value: string): boolean {
        try {
            if (!isLocalStorageAvailable()) return false;
            localStorage.setItem(STORAGE_PREFIX + key, value);
            return true;
        } catch (e) {
            console.error("[SpicyThemes] Storage set error:", e);
            return false;
        }
    },

    remove(key: string): void {
        try {
            if (!isLocalStorageAvailable()) return;
            localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (e) {
            console.error("[SpicyThemes] Storage remove error:", e);
        }
    }
};
