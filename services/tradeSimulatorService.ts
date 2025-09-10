import type { CryptoPrice } from './cryptoService';

export interface Trade {
  id: string;
  coin: CryptoPrice;
  direction: 'buy' | 'sell';
  entryPrice: number;
  sizeUSD: number; // The size of the position in USD at entry
  openTimestamp: number;
  closeTimestamp: number | null;
  closePrice: number | null;
  pnl: number | null; // Profit and Loss in USD
  status: 'open' | 'closed';
  closeReason?: 'Take Profit' | 'Stop Loss' | 'Time Limit';
}

export type RiskTolerance = 'Conservative' | 'Moderate' | 'Aggressive';
export type InvestmentStyle = 'Scalping' | 'Day Trading' | 'Swing Trading';

export interface WalletSettings {
  riskTolerance: RiskTolerance;
  investmentStyle: InvestmentStyle;
  aiConfidence: number;
}

const DEFAULT_SETTINGS: WalletSettings = {
  riskTolerance: 'Moderate',
  investmentStyle: 'Day Trading',
  aiConfidence: 75.0, // Start at a neutral 75%
};

const BASE_TRADE_SIZE_USD = 1000;

class TradeSimulatorService {
  private trades: Trade[] = [];
  private settings: WalletSettings = { ...DEFAULT_SETTINGS };
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadTrades();
    this.loadSettings();
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

  private loadTrades() {
    try {
      const storedTrades = localStorage.getItem('jaxspot_trades');
      if (storedTrades) {
        this.trades = JSON.parse(storedTrades);
      }
    } catch (error) {
      console.error("Failed to load trades from localStorage:", error);
      this.trades = [];
    }
  }

  private saveTrades() {
    try {
      localStorage.setItem('jaxspot_trades', JSON.stringify(this.trades));
    } catch (error) {
      console.error("Failed to save trades to localStorage:", error);
    }
  }

   private loadSettings() {
    try {
      const storedSettings = localStorage.getItem('jaxspot_wallet_settings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...parsedSettings
        };
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem('jaxspot_wallet_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }
  
  private updateAIConfidence(trade: Trade) {
      if (trade.pnl === null || trade.pnl === undefined) return;

      const pnlPercentage = (trade.pnl / trade.sizeUSD) * 100;
      // Losses have a larger impact on confidence than gains
      const baseChange = pnlPercentage * (pnlPercentage >= 0 ? 0.2 : 0.4);
      let finalChange = baseChange;

      // Adjust based on why the trade was closed
      switch (trade.closeReason) {
          case 'Take Profit':
              finalChange *= 1.5; // Reward successful TPs more
              break;
          case 'Stop Loss':
              finalChange *= 2.0; // Penalize SLs more heavily
              break;
      }

      const tradeDurationMinutes = ((trade.closeTimestamp || Date.now()) - trade.openTimestamp) / (1000 * 60);

      // Define "quick" based on the investment style
      let quickTradeThresholdMinutes: number;
      switch (this.settings.investmentStyle) {
          case 'Scalping': quickTradeThresholdMinutes = 15; break;
          case 'Swing Trading': quickTradeThresholdMinutes = 60 * 12; break; // 12 hours
          default: quickTradeThresholdMinutes = 60 * 2; break; // 2 hours for Day Trading
      }

      // Bonus for quick Take Profit
      if (trade.closeReason === 'Take Profit' && tradeDurationMinutes < quickTradeThresholdMinutes) {
          finalChange += 0.25;
          console.log(`AI Confidence: Bonus for quick TP hit.`);
      }

      // Penalty for quick Stop Loss
      if (trade.closeReason === 'Stop Loss' && tradeDurationMinutes < quickTradeThresholdMinutes) {
          finalChange -= 0.5;
          console.log(`AI Confidence: Penalty for quick SL hit.`);
      }

      const newConfidence = this.settings.aiConfidence + finalChange;
      // Clamp confidence to a reasonable range (e.g., 50% to 95%)
      this.settings.aiConfidence = Math.max(50, Math.min(95, newConfidence));

      this.saveSettings();
      console.log(`AI confidence updated to ${this.settings.aiConfidence.toFixed(2)}% (change: ${finalChange.toFixed(2)}) after trade.`);
  }

  getSettings(): WalletSettings {
    return this.settings;
  }

  updateSettings(newSettings: Partial<WalletSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.notifyListeners();
  }

  resetWallet() {
    this.trades = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveTrades();
    this.saveSettings();
    this.notifyListeners();
    console.log("Simulated wallet has been reset.");
  }


  executeTrade(coin: CryptoPrice, direction: 'buy' | 'sell') {
    const confidenceMultiplier = this.settings.aiConfidence / 100;
    const sizeAdjustment = BASE_TRADE_SIZE_USD * (confidenceMultiplier - 0.75);
    const dynamicTradeSize = BASE_TRADE_SIZE_USD + sizeAdjustment;

    const newTrade: Trade = {
      id: `${coin.id}-${new Date().getTime()}`,
      coin: { ...coin },
      direction,
      entryPrice: coin.price,
      sizeUSD: dynamicTradeSize,
      openTimestamp: Date.now(),
      closeTimestamp: null,
      closePrice: null,
      pnl: 0,
      status: 'open',
    };

    this.trades.unshift(newTrade);
    this.saveTrades();
    this.notifyListeners();
    console.log(`Executed ${direction} trade for ${coin.symbol} at $${coin.price} with size ${formatCurrency(dynamicTradeSize)} (Confidence: ${this.settings.aiConfidence.toFixed(1)}%)`);
  }

  updateOpenTrades(livePrices: CryptoPrice[]) {
    let updated = false;
    const priceMap = new Map(livePrices.map(p => [p.id, p.price]));
    const now = Date.now();
    const { riskTolerance, investmentStyle } = this.settings;


    this.trades.forEach(trade => {
      if (trade.status === 'open') {
        const currentPrice = priceMap.get(trade.coin.id);
        if (currentPrice !== undefined) {
          const priceChange = currentPrice - trade.entryPrice;
          const positionSize = trade.sizeUSD / trade.entryPrice;
          let pnl: number;

          if (trade.direction === 'buy') {
            pnl = priceChange * positionSize;
          } else { // 'sell'
            pnl = -priceChange * positionSize;
          }
          trade.pnl = pnl;
          updated = true;

          let takeProfitPercent: number;
          let stopLossPercent: number;
          let maxDurationHours: number;

          switch (riskTolerance) {
            case 'Conservative': takeProfitPercent = 3; stopLossPercent = -1.5; break;
            case 'Aggressive': takeProfitPercent = 10; stopLossPercent = -5; break;
            default: takeProfitPercent = 5; stopLossPercent = -2.5; break;
          }

          switch (investmentStyle) {
            case 'Scalping': maxDurationHours = 1; takeProfitPercent *= 0.5; stopLossPercent *= 0.5; break;
            case 'Swing Trading': maxDurationHours = 72; takeProfitPercent *= 2; stopLossPercent *= 2; break;
            default: maxDurationHours = 24; break;
          }
          
          const pnlPercentage = (trade.pnl! / trade.sizeUSD) * 100;
          const tradeDurationHours = (now - trade.openTimestamp) / (1000 * 60 * 60);

          let closeReason: 'Take Profit' | 'Stop Loss' | 'Time Limit' | '' = '';
          if (pnlPercentage > takeProfitPercent) closeReason = 'Take Profit';
          else if (pnlPercentage < stopLossPercent) closeReason = 'Stop Loss';
          else if (tradeDurationHours > maxDurationHours) closeReason = 'Time Limit';


          if (closeReason) {
            trade.status = 'closed';
            trade.closePrice = currentPrice;
            trade.closeTimestamp = now;
            trade.closeReason = closeReason;
            console.log(`Auto-closing trade ${trade.id} for ${trade.coin.symbol}. Reason: ${closeReason}.`);
            this.updateAIConfidence(trade);
          }
        }
      }
    });

    if (updated) {
        this.saveTrades();
        this.notifyListeners();
    }
  }

  getAllTrades(): Trade[] {
      return this.trades;
  }
}

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};


export const tradeSimulatorService = new TradeSimulatorService();