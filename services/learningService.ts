import { CryptoPrice } from "./cryptoService";
import { tradeSimulatorService } from "./tradeSimulatorService";
import { getRefinedPattern, getRefinedPatternSuggestion } from './geminiService';

export interface LearningPattern {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  observation_count: number;
  trigger_asset: string;
  affected_asset: string;
  trade_direction: 'buy' | 'sell';
}

export interface Experiment extends LearningPattern {
    status: 'pending' | 'running' | 'completed';
    result?: {
        pnl: number | null;
        tradeId: string;
    };
    approvedTimestamp: number;
}

export interface LogEntry {
    id: string;
    timestamp: number;
    message: string;
    type: 'success' | 'failure' | 'info';
    experimentId?: string;
}

const EXPERIMENTS_STORAGE_KEY = 'jaxspot_experiments';
const LOGS_STORAGE_KEY = 'jaxspot_activity_logs';

class LearningService {
    private experiments: Experiment[] = [];
    private logs: LogEntry[] = [];
    private listeners: (() => void)[] = [];

    constructor() {
        this.loadExperiments();
        this.loadLogs();
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

    // --- State Management ---
    private loadExperiments() {
        try {
            const stored = localStorage.getItem(EXPERIMENTS_STORAGE_KEY);
            if (stored) this.experiments = JSON.parse(stored);
        } catch (error) { console.error("Failed to load experiments:", error); }
    }

    private saveExperiments() {
        try {
            localStorage.setItem(EXPERIMENTS_STORAGE_KEY, JSON.stringify(this.experiments));
        } catch (error) { console.error("Failed to save experiments:", error); }
    }

    private loadLogs() {
        try {
            const stored = localStorage.getItem(LOGS_STORAGE_KEY);
            if (stored) this.logs = JSON.parse(stored);
        } catch (error) { console.error("Failed to load logs:", error); }
    }

    private saveLogs() {
        try {
            localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.logs));
        } catch (error) { console.error("Failed to save logs:", error); }
    }
    
    // --- Logging ---
    private addLog(message: string, type: LogEntry['type'], experimentId?: string) {
        const newLog: LogEntry = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            message,
            type,
            experimentId
        };
        this.logs.unshift(newLog);
        if (this.logs.length > 100) { // Keep log size manageable
            this.logs.pop();
        }
        this.saveLogs();
        this.notifyListeners(); // Notify about log update
    }

    getLogs(): LogEntry[] {
        return this.logs;
    }

    // --- Experiment Management ---
    getExperiments(): Experiment[] {
        return [...this.experiments].sort((a, b) => b.approvedTimestamp - a.approvedTimestamp);
    }
    
    isPatternInExperiments(patternId: string): boolean {
        return this.experiments.some(exp => exp.id === patternId);
    }

    approvePattern(pattern: LearningPattern, allCoins: CryptoPrice[]) {
        if (this.isPatternInExperiments(pattern.id)) {
            console.warn(`Pattern ${pattern.id} is already in experiments.`);
            return;
        }

        const newExperiment: Experiment = {
            ...pattern,
            status: 'pending',
            approvedTimestamp: Date.now(),
        };

        this.experiments.unshift(newExperiment);
        this.addLog(`Pattern "${pattern.title}" approved for testing.`, 'info', newExperiment.id);
        this.saveExperiments();
        this.notifyListeners();
        
        this.runExperiment(newExperiment, allCoins);
    }
    
    async recycleExperiment(experimentId: string): Promise<void> {
        const experimentIndex = this.experiments.findIndex(exp => exp.id === experimentId);
        if (experimentIndex === -1) return;
        
        const experimentToRecycle = this.experiments[experimentIndex];
        const pnl = experimentToRecycle.result?.pnl ?? 0;
        
        this.addLog(`Experiment "${experimentToRecycle.title}" sent to R&D for refinement.`, 'info', experimentId);
        
        // Remove from active experiments list
        this.experiments.splice(experimentIndex, 1);
        this.saveExperiments();
        this.notifyListeners();

        // Asynchronously ask AI to refine it
        console.log(`Asking AI to refine failed pattern: ${experimentToRecycle.title}`);
        const suggestion = await getRefinedPattern(experimentToRecycle, pnl);
        console.log(`%c--- AI REFINEMENT SUGGESTION ---\n${suggestion}\n---------------------------------`, "color: #a855f7; font-weight: bold;");
        this.addLog(`AI proposed refinement for "${experimentToRecycle.title}". Check console for details.`, 'info', experimentId);
    }

    async recyclePattern(pattern: LearningPattern): Promise<void> {
        this.addLog(`Pattern "${pattern.title}" sent back to AI for immediate refinement.`, 'info');
        
        // Asynchronously ask AI to refine it
        console.log(`Asking AI to refine potential pattern: ${pattern.title}`);
        const suggestion = await getRefinedPatternSuggestion(pattern);
        
        console.log(`%c--- AI REFINEMENT SUGGESTION ---\n${suggestion}\n---------------------------------`, "color: #a855f7; font-weight: bold;");
        this.addLog(`AI proposed refinement for "${pattern.title}". Check console for details.`, 'info');
    }
    
    resumeExperiment(experimentId: string, allCoins: CryptoPrice[]) {
        const experiment = this.experiments.find(exp => exp.id === experimentId);
        if (!experiment || experiment.status !== 'completed') {
            console.warn(`Cannot resume experiment ${experimentId}. It is not completed or does not exist.`);
            return;
        }

        // Reset the experiment state
        experiment.status = 'pending';
        experiment.result = undefined;
        experiment.approvedTimestamp = Date.now(); // Move it to the top of the list

        this.addLog(`Resuming experiment "${experiment.title}".`, 'info', experiment.id);
        this.saveExperiments();
        this.notifyListeners();

        this.runExperiment(experiment, allCoins);
    }

    private runExperiment(experiment: Experiment, allCoins: CryptoPrice[]) {
        const coinToTrade = allCoins.find(c => c.symbol.toUpperCase() === experiment.affected_asset.toUpperCase());
        
        if (!coinToTrade) {
            const errorMsg = `Cannot run experiment ${experiment.id}: Asset ${experiment.affected_asset} not found.`;
            console.error(errorMsg);
            this.addLog(errorMsg, 'failure', experiment.id);
            experiment.status = 'completed'; // Mark as failed
            this.saveExperiments();
            this.notifyListeners();
            return;
        }

        experiment.status = 'running';
        this.saveExperiments();
        this.notifyListeners();

        console.log(`Running experiment: ${experiment.title}`);
        tradeSimulatorService.executeTrade(coinToTrade, experiment.trade_direction);
        const trades = tradeSimulatorService.getAllTrades();
        const newTrade = trades.find(t => t.coin.symbol === coinToTrade.symbol && t.status === 'open' && !this.experiments.some(e => e.result?.tradeId === t.id));

        if (!newTrade) {
            const errorMsg = `Failed to find newly created trade for experiment "${experiment.title}".`;
            console.error(errorMsg);
            experiment.status = 'completed';
            experiment.result = { pnl: null, tradeId: 'not-found' };
            this.addLog(errorMsg, 'failure', experiment.id);
            this.saveExperiments();
            this.notifyListeners();
            return;
        }
        
        experiment.result = { pnl: null, tradeId: newTrade.id };
        
        const checkInterval = setInterval(() => {
            const trade = tradeSimulatorService.getAllTrades().find(t => t.id === newTrade.id);
            if (trade && trade.status === 'closed') {
                clearInterval(checkInterval);
                const pnl = trade.pnl ?? 0;
                const resultType = pnl >= 0 ? 'success' : 'failure';
                const message = `Experiment "${experiment.title}" completed. PNL: ${formatCurrency(pnl)}.`;
                console.log(message);
                
                this.addLog(message, resultType, experiment.id);
                experiment.status = 'completed';
                if (experiment.result) experiment.result.pnl = pnl;
                
                this.saveExperiments();
                this.notifyListeners();
            }
        }, 5000);
    }
}

// Helper to format currency for logs
const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const learningService = new LearningService();