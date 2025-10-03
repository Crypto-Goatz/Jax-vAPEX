// services/scenarioService.ts

export interface Condition {
  type: 'price' | 'volatility' | 'whale' | 'sentiment';
  operator: 'gt' | 'lt';
  value: number;
  timeframe: '1h' | '24h' | '7d';
}

export interface Scenario {
    id: string;
    name: string;
    triggerCoinId: string;
    triggerCoinSymbol: string;
    condition: Condition;
    outcomeCoinId: string;
    outcomeCoinSymbol: string;
    outcomeType: 'price' | 'sentiment' | 'whale';
}

const SCENARIOS_STORAGE_KEY = 'jaxspot_saved_scenarios';

class ScenarioService {
    private savedScenarios: Scenario[] = [];
    private listeners: (() => void)[] = [];

    constructor() {
        this.loadScenarios();
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

    private loadScenarios() {
        try {
            const stored = localStorage.getItem(SCENARIOS_STORAGE_KEY);
            if (stored) {
                this.savedScenarios = JSON.parse(stored);
            }
        } catch (error) {
            console.error("Failed to load saved scenarios:", error);
            this.savedScenarios = [];
        }
    }

    private saveScenarios() {
        try {
            localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(this.savedScenarios));
        } catch (error) {
            console.error("Failed to save scenarios:", error);
        }
    }

    getSavedScenarios(): Scenario[] {
        return [...this.savedScenarios];
    }

    saveScenario(scenario: Scenario) {
        const existingIndex = this.savedScenarios.findIndex(s => s.id === scenario.id);
        if (existingIndex > -1) {
            this.savedScenarios[existingIndex] = scenario;
        } else {
            this.savedScenarios.unshift(scenario);
        }
        this.saveScenarios();
        this.notifyListeners();
    }
    
    deleteScenario(scenarioId: string) {
        this.savedScenarios = this.savedScenarios.filter(s => s.id !== scenarioId);
        this.saveScenarios();
        this.notifyListeners();
    }
}

export const scenarioService = new ScenarioService();
