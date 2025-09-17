import type { Pattern } from './btcHistoryService';

const PATTERNS_STORAGE_KEY = 'jaxspot_saved_patterns';

class PatternHistoryService {
    private savedPatterns: Pattern[] = [];
    private listeners: (() => void)[] = [];

    constructor() {
        this.loadPatterns();
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
    }

    unsubscribe(listener: () => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    private loadPatterns() {
        try {
            const stored = localStorage.getItem(PATTERNS_STORAGE_KEY);
            if (stored) {
                this.savedPatterns = JSON.parse(stored);
            }
        } catch (error) {
            console.error("Failed to load saved patterns:", error);
            this.savedPatterns = [];
        }
    }

    private savePatterns() {
        try {
            localStorage.setItem(PATTERNS_STORAGE_KEY, JSON.stringify(this.savedPatterns));
        } catch (error) {
            console.error("Failed to save patterns:", error);
        }
    }

    getSavedPatterns(): Pattern[] {
        return [...this.savedPatterns];
    }

    savePattern(pattern: Pattern) {
        // Avoid duplicates by checking ID, or add if new
        const existingIndex = this.savedPatterns.findIndex(p => p.id === pattern.id);
        if (existingIndex > -1) {
            this.savedPatterns[existingIndex] = pattern;
        } else {
            this.savedPatterns.unshift(pattern);
        }
        this.savePatterns();
        this.notifyListeners();
    }
    
    deletePattern(patternId: string) {
        this.savedPatterns = this.savedPatterns.filter(p => p.id !== patternId);
        this.savePatterns();
        this.notifyListeners();
    }
}

export const patternHistoryService = new PatternHistoryService();
