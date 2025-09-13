import { Experiment } from './learningService';
import { CryptoPrice } from './cryptoService';

export interface AvailableSignal {
    id: string; // Same as experiment ID
    title: string;
    description: string;
    trigger_asset: string;
    affected_asset: string;
    trade_direction: 'buy' | 'sell';
}

export interface SignalEvent {
    eventId: string;
    signal: AvailableSignal;
    triggeredAt: number;
    triggeredPrice: number; // Price of the affected_asset at trigger time
}

const SIGNALS_STORAGE_KEY = 'jaxspot_activated_signals';
const EVENTS_STORAGE_KEY = 'jaxspot_signal_events';

class SignalsService {
    private activatedSignals: AvailableSignal[] = [];
    private signalEvents: SignalEvent[] = [];
    private listeners: (() => void)[] = [];
    private lastTriggerTimestamps: { [key: string]: number } = {};

    constructor() {
        this.loadState();
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

    private loadState() {
        try {
            const storedSignals = localStorage.getItem(SIGNALS_STORAGE_KEY);
            if (storedSignals) {
                this.activatedSignals = JSON.parse(storedSignals);
            }
            const storedEvents = localStorage.getItem(EVENTS_STORAGE_KEY);
            if (storedEvents) {
                // Limit to last 50 events to prevent localStorage bloat
                this.signalEvents = JSON.parse(storedEvents).slice(0, 50);
            }
        } catch (error) {
            console.error("Failed to load signals state:", error);
        }
    }

    private saveState() {
        try {
            localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(this.activatedSignals));
            localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(this.signalEvents));
        } catch (error) {
            console.error("Failed to save signals state:", error);
        }
    }
    
    getActivatedSignals(): AvailableSignal[] {
        return this.activatedSignals;
    }
    
    getSignalEvents(): SignalEvent[] {
        return [...this.signalEvents].sort((a, b) => b.triggeredAt - a.triggeredAt);
    }

    isSignalActivated(signalId: string): boolean {
        return this.activatedSignals.some(s => s.id === signalId);
    }

    activateSignalFromExperiment(experiment: Experiment) {
        if (this.isSignalActivated(experiment.id)) {
            console.warn(`Signal ${experiment.id} is already activated.`);
            return;
        }

        const newSignal: AvailableSignal = {
            id: experiment.id,
            title: experiment.title,
            description: experiment.description,
            trigger_asset: experiment.trigger_asset,
            affected_asset: experiment.affected_asset,
            trade_direction: experiment.trade_direction,
        };

        this.activatedSignals.unshift(newSignal);
        this.saveState();
        this.notifyListeners();
        console.log(`Signal "${newSignal.title}" has been activated.`);
    }

    // This is the simulation part called from App.tsx
    checkForSignalTriggers(allCoins: CryptoPrice[]) {
        if (this.activatedSignals.length === 0 || allCoins.length === 0) {
            return;
        }
        
        const now = Date.now();
        const priceMap = new Map(allCoins.map(c => [c.symbol.toUpperCase(), c]));

        this.activatedSignals.forEach(signal => {
            // Simple random trigger for simulation purposes
            // In a real system, this would be complex logic
            const triggerProbability = 0.01; // 1% chance per tick (every 5s)
            
            // Cooldown: Don't trigger the same signal more than once every 5 minutes
            const cooldown = 5 * 60 * 1000;
            const lastTriggered = this.lastTriggerTimestamps[signal.id] || 0;
            if (now - lastTriggered < cooldown) {
                return;
            }

            if (Math.random() < triggerProbability) {
                const affectedCoin = priceMap.get(signal.affected_asset.toUpperCase());
                if (affectedCoin) {
                    const newEvent: SignalEvent = {
                        eventId: `${signal.id}-${now}`,
                        signal: signal,
                        triggeredAt: now,
                        triggeredPrice: affectedCoin.price,
                    };
                    
                    this.signalEvents.unshift(newEvent);
                    // Keep the list from growing indefinitely
                    if (this.signalEvents.length > 50) {
                        this.signalEvents.pop();
                    }
                    this.lastTriggerTimestamps[signal.id] = now;
                    
                    this.saveState();
                    this.notifyListeners();
                    console.log(`SIMULATED TRIGGER for signal: "${signal.title}"`);
                }
            }
        });
    }
}

export const signalsService = new SignalsService();
