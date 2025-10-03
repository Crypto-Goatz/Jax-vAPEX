// services/signalsService.ts
import { CryptoPrice, NewsSentiment } from './cryptoService';
// Fix: Import Experiment type to be used in activateSignalFromExperiment method.
import type { Experiment } from './learningService';

// NEW: Define a structured trigger condition
export interface TriggerCondition {
    metric: 'price_change_24h' | 'sentiment_score';
    operator: 'gt' | 'lt'; // greater than | less than
    threshold: number;
    source: 'trigger_asset' | 'affected_asset' | 'global';
}

export interface AvailableSignal {
    id: string;
    title: string;
    description: string;
    trigger_asset: string;
    affected_asset: string;
    trade_direction: 'buy' | 'sell';
    triggerCondition: TriggerCondition;
}

export interface SignalEvent {
    eventId: string;
    signal: AvailableSignal;
    triggeredPrice: number;
    triggeredAt: string;
    livePrice?: number; // <-- new field
}

type UpdateCallback = () => void;

class SignalsService {
    private activatedSignals: AvailableSignal[] = [];
    private signalEvents: SignalEvent[] = [];
    private subscribers: UpdateCallback[] = [];
    private allCoins: CryptoPrice[] = [];

    // Inject fresh coin data
    setAllCoins(coins: CryptoPrice[]) {
        this.allCoins = coins;
        this.refreshLivePrices();
    }

    // Merge live prices into signals & events
    private refreshLivePrices() {
        this.signalEvents = this.signalEvents.map(event => {
            const liveCoin = this.allCoins.find(
                c => c.symbol.toUpperCase() === event.signal.affected_asset.toUpperCase()
            );
            return { ...event, livePrice: liveCoin?.price };
        });
        this.notify();
    }

    getActivatedSignals(): AvailableSignal[] {
        return this.activatedSignals;
    }

    getSignalEvents(): SignalEvent[] {
        return this.signalEvents;
    }

    addActivatedSignal(signal: AvailableSignal) {
        this.activatedSignals.push(signal);
        this.notify();
    }

    // Fix: Implement activateSignalFromExperiment to handle promoting a successful experiment to an active signal.
    activateSignalFromExperiment(experiment: Experiment) {
        if (this.activatedSignals.some(s => s.id === experiment.id)) {
            console.warn(`Signal with ID ${experiment.id} is already activated.`);
            return;
        }
        
        // MOCK: Create a plausible trigger condition since it's not provided by the experiment.
        // In a real system, this would be derived from the pattern's analysis.
        // This example assumes the trigger is based on the trigger_asset's 24h price change.
        const mockTriggerCondition: TriggerCondition = {
            metric: 'price_change_24h',
            operator: 'gt',
            threshold: 5,
            source: 'trigger_asset',
        };

        const newSignal: AvailableSignal = {
            id: experiment.id,
            title: experiment.title,
            description: experiment.description,
            trigger_asset: experiment.trigger_asset,
            affected_asset: experiment.affected_asset,
            trade_direction: experiment.trade_direction,
            triggerCondition: mockTriggerCondition,
        };

        this.addActivatedSignal(newSignal);
        console.log(`Activated new signal: ${newSignal.title}`);
    }

    addSignalEvent(event: SignalEvent) {
        // Improvement: Add new events to the top of the list for better UX.
        this.signalEvents.unshift(event);
        if (this.signalEvents.length > 50) { // Cap the number of events to prevent memory issues.
            this.signalEvents.pop();
        }
        this.refreshLivePrices();
    }
    
    // ENHANCED: Checks for structured signal conditions against live price and sentiment data.
    checkForSignalTriggers(prices: CryptoPrice[], sentiment: NewsSentiment | null) {
        this.setAllCoins(prices); // Keep the service's coin data fresh for live updates.
        const priceMap = new Map(prices.map(p => [p.symbol.toUpperCase(), p]));

        this.activatedSignals.forEach(signal => {
            const { triggerCondition, trigger_asset, affected_asset, id: signalId } = signal;

            let conditionMet = false;
            let currentMetricValue: number | undefined;

            if (triggerCondition.metric === 'price_change_24h') {
                const assetSymbolToCheck = (triggerCondition.source === 'affected_asset' ? affected_asset : trigger_asset).toUpperCase();
                const triggerAssetData = priceMap.get(assetSymbolToCheck);
                if (triggerAssetData) {
                    currentMetricValue = triggerAssetData.change24h;
                    if (triggerCondition.operator === 'gt') {
                        conditionMet = currentMetricValue > triggerCondition.threshold;
                    } else { // 'lt'
                        conditionMet = currentMetricValue < triggerCondition.threshold;
                    }
                }
            } else if (triggerCondition.metric === 'sentiment_score') {
                if (sentiment) {
                    // Sentiment score is global (0-1), threshold is 0-100 for simplicity
                    currentMetricValue = sentiment.sentiment_score * 100;
                    if (triggerCondition.operator === 'gt') {
                        conditionMet = currentMetricValue > triggerCondition.threshold;
                    } else { // 'lt'
                        conditionMet = currentMetricValue < triggerCondition.threshold;
                    }
                }
            }
            
            if (conditionMet) {
                const affectedAssetData = priceMap.get(affected_asset.toUpperCase());
                if (!affectedAssetData) return;

                // Avoid re-triggering too frequently (1 hour cooldown)
                const lastEvent = this.signalEvents.find(e => e.signal.id === signalId);
                if (lastEvent && (Date.now() - new Date(lastEvent.triggeredAt).getTime()) < 60 * 60 * 1000) {
                    return;
                }

                const newEvent: SignalEvent = {
                    eventId: `${signalId}-${Date.now()}`,
                    signal: signal,
                    triggeredPrice: affectedAssetData.price,
                    triggeredAt: new Date().toISOString(),
                };

                this.addSignalEvent(newEvent);
                console.log(`--- SIGNAL TRIGGERED ---: ${signal.title} (Condition: ${triggerCondition.metric} on ${triggerCondition.source === 'global' ? 'Global' : triggerCondition.source === 'affected_asset' ? affected_asset : trigger_asset} ${triggerCondition.operator === 'gt' ? '>' : '<'} ${triggerCondition.threshold}, Value: ${currentMetricValue?.toFixed(2)})`);
            }
        });
    }

    subscribe(callback: UpdateCallback) {
        this.subscribers.push(callback);
    }

    unsubscribe(callback: UpdateCallback) {
        this.subscribers = this.subscribers.filter(cb => cb !== callback);
    }

    private notify() {
        this.subscribers.forEach(cb => cb());
    }
}

export const signalsService = new SignalsService();