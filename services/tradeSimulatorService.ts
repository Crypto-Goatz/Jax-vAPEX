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
  takeProfitPrice?: number;
  stopLossPrice?: number;
}

export type RiskTolerance = 'Conservative' | 'Moderate' | 'Aggressive';
export type InvestmentStyle = 'Scalping' | 'Day Trading' | 'Swing Trading';

export interface WalletSettings {
  riskTolerance: RiskTolerance;
  investmentStyle: InvestmentStyle;
  aiConfidence: number;
  webhookUrl: string;
  webhookEnabled: boolean;
}

const DEFAULT_SETTINGS: WalletSettings = {
  riskTolerance: 'Moderate',
  investmentStyle: 'Day Trading',
  aiConfidence: 75.0, // Start at a neutral 75%
  webhookUrl: '',
  webhookEnabled: false,
};

const BASE_TRADE_SIZE_USD = 1000;

// Define max trade durations based on style for cleaner logic
const MAX_TRADE_DURATION_HOURS: Record<InvestmentStyle, number> = {
  'Scalping': 1,       // 1 hour max
  'Day Trading': 24,   // 24 hours max
  'Swing Trading': 72, // 3 days max
};

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

    let confidenceChange: number;

    // Handle Time Limit trades first as a special case.
    // A small, fixed penalty is applied regardless of P/L, because timely execution failed.
    if (trade.closeReason === 'Time Limit') {
        confidenceChange = -0.2; // Small, fixed penalty for timing out.
        console.log(`AI Confidence: Applying fixed penalty for hitting trade time limit.`);
    } else {
        // For trades closed by TP or SL, the change is based on P/L.
        const pnlPercentage = (trade.pnl / trade.sizeUSD) * 100;
        confidenceChange = pnlPercentage * (pnlPercentage >= 0 ? 0.2 : 0.4); // Losses have a higher weight.

        switch (trade.closeReason) {
            case 'Take Profit':
                confidenceChange *= 1.75; // Reward successful TPs more.
                console.log(`AI Confidence: Applying larger reward for TP hit.`);
                break;
            case 'Stop Loss':
                confidenceChange *= 2.5; // Penalize SLs more.
                console.log(`AI Confidence: Applying larger penalty for SL hit.`);
                break;
        }

        // Further adjustments based on trade duration
        const tradeDurationMinutes = ((trade.closeTimestamp || Date.now()) - trade.openTimestamp) / (1000 * 60);
        let quickTradeThresholdMinutes: number;
        switch (this.settings.investmentStyle) {
            case 'Scalping': quickTradeThresholdMinutes = 15; break;
            case 'Swing Trading': quickTradeThresholdMinutes = 60 * 12; break; // 12 hours
            default: quickTradeThresholdMinutes = 60 * 2; break; // 2 hours for Day Trading
        }

        // Bonus for quick Take Profit
        if (trade.closeReason === 'Take Profit' && tradeDurationMinutes < quickTradeThresholdMinutes) {
            confidenceChange += 0.35;
            console.log(`AI Confidence: Applying bonus for quick TP.`);
        }

        // Larger penalty for quick Stop Loss
        if (trade.closeReason === 'Stop Loss' && tradeDurationMinutes < quickTradeThresholdMinutes) {
            confidenceChange -= 0.6;
            console.log(`AI Confidence: Applying penalty for quick SL.`);
        }
    }

    const newConfidence = this.settings.aiConfidence + confidenceChange;
    // Clamp confidence to a reasonable range (e.g., 50% to 95%)
    this.settings.aiConfidence = Math.max(50, Math.min(95, newConfidence));

    this.saveSettings();
    console.log(`AI confidence updated to ${this.settings.aiConfidence.toFixed(2)}% (change: ${confidenceChange.toFixed(2)}) after trade.`);
  }
  
  private async sendWebhook(payload: object) {
    if (!this.settings.webhookEnabled || !this.settings.webhookUrl) {
      return;
    }
    
    try {
      // Basic URL validation
      new URL(this.settings.webhookUrl);
    } catch (_) {
      console.error("Webhook Error: Invalid URL provided.");
      return;
    }

    console.log("Sending webhook to:", this.settings.webhookUrl);
    try {
      const response = await fetch(this.settings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`Webhook failed with status: ${response.status}`);
      } else {
        console.log("Webhook sent successfully.");
      }
    } catch (error) {
      console.error("Error sending webhook:", error);
    }
  }

  async testWebhook(): Promise<void> {
      const payload = {
          type: 'test',
          message: 'JaxSpot webhook test successful!',
          timestamp: new Date().toISOString()
      };
      await this.sendWebhook(payload);
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
    // 1. Determine style multiplier
    let styleMultiplier: number;
    switch (this.settings.investmentStyle) {
        case 'Scalping': styleMultiplier = 0.5; break;
        case 'Swing Trading': styleMultiplier = 1.5; break;
        default: styleMultiplier = 1.0; break; // Day Trading
    }

    // 2. Determine risk multiplier
    let riskMultiplier: number;
    switch (this.settings.riskTolerance) {
        case 'Conservative': riskMultiplier = 0.75; break;
        case 'Aggressive': riskMultiplier = 1.5; break;
        default: riskMultiplier = 1.0; break; // Moderate
    }
    
    // 3. Calculate base size adjusted for style and risk
    const baseSize = BASE_TRADE_SIZE_USD * styleMultiplier * riskMultiplier;
    
    // 4. Adjust size based on AI confidence (75% is the neutral baseline)
    const confidenceMultiplier = this.settings.aiConfidence / 100;
    const confidenceBaseline = 0.75;
    const sizeAdjustment = baseSize * (confidenceMultiplier - confidenceBaseline);
    const dynamicTradeSize = baseSize + sizeAdjustment;

    // 5. Create the new trade object
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
    
    // 6. Dynamically set initial TP/SL targets based on current settings
    const { takeProfitPrice, stopLossPrice } = this.getTakeProfitStopLoss(newTrade);
    newTrade.takeProfitPrice = takeProfitPrice;
    newTrade.stopLossPrice = stopLossPrice;

    // 7. Add to history, save, and notify
    this.trades.unshift(newTrade);
    this.saveTrades();
    this.sendWebhook({ type: 'trade_open', trade: newTrade });
    this.notifyListeners();
    console.log(`Executed ${direction} trade for ${coin.symbol} at $${coin.price} with size ${formatCurrency(dynamicTradeSize)} (Style: ${this.settings.investmentStyle}, Risk: ${this.settings.riskTolerance}, Confidence: ${this.settings.aiConfidence.toFixed(1)}%)`);
  }

  /**
   * Calculates the Take Profit and Stop Loss price targets for a trade.
   * These targets are dynamically determined based on the wallet's current
   * Risk Tolerance and Investment Style settings.
   * @param trade The trade to calculate targets for.
   * @returns An object containing the takeProfitPrice and stopLossPrice.
   */
  getTakeProfitStopLoss(trade: Trade): { takeProfitPrice: number, stopLossPrice: number } {
    const { riskTolerance, investmentStyle, aiConfidence } = this.settings;

    let takeProfitPercent: number;
    let stopLossPercent: number;

    switch (riskTolerance) {
      case 'Conservative': takeProfitPercent = 3; stopLossPercent = -1.5; break;
      case 'Aggressive': takeProfitPercent = 10; stopLossPercent = -5; break;
      default: takeProfitPercent = 5; stopLossPercent = -2.5; break;
    }

    switch (investmentStyle) {
      case 'Scalping': takeProfitPercent *= 0.5; stopLossPercent *= 0.5; break;
      case 'Swing Trading': takeProfitPercent *= 2; stopLossPercent *= 2; break;
      default: break; // Day Trading is default
    }

    // Adjust TP/SL based on AI confidence. Baseline is 75%.
    // A confidence of 50% results in a 0.5x multiplier (tighter stops/targets).
    // A confidence of 95% results in a 1.4x multiplier (wider stops/targets).
    const confidenceFactor = 1 + ((aiConfidence - 75) / 50);
    takeProfitPercent *= confidenceFactor;
    stopLossPercent *= confidenceFactor;

    let takeProfitPrice: number;
    let stopLossPrice: number;

    if (trade.direction === 'buy') {
      takeProfitPrice = trade.entryPrice * (1 + takeProfitPercent / 100);
      stopLossPrice = trade.entryPrice * (1 + stopLossPercent / 100);
    } else { // 'sell'
      takeProfitPrice = trade.entryPrice * (1 - takeProfitPercent / 100);
      stopLossPrice = trade.entryPrice * (1 - stopLossPercent / 100);
    }

    return { takeProfitPrice, stopLossPrice };
  }

  /**
   * Enhanced: Iterates through all open trades, updates their P/L, and checks for closure conditions.
   * A trade can be closed for one of three reasons:
   * 1. Take Profit: The price hits the dynamically calculated profit target.
   * 2. Stop Loss: The price hits the dynamically calculated loss limit.
   * 3. Time Limit: The trade has been open longer than the maximum duration allowed by the investment style.
   * @param livePrices An array of current crypto prices to update trades against.
   */
  updateOpenTrades(livePrices: CryptoPrice[]) {
    let updated = false;
    const priceMap = new Map(livePrices.map(p => [p.id, p.price]));
    const now = Date.now();

    this.trades.forEach(trade => {
      if (trade.status === 'open') {
        const currentPrice = priceMap.get(trade.coin.id);
        if (currentPrice !== undefined) {
          // Update P/L
          const priceChange = currentPrice - trade.entryPrice;
          const positionSize = trade.sizeUSD / trade.entryPrice;
          trade.pnl = trade.direction === 'buy' ? priceChange * positionSize : -priceChange * positionSize;
          updated = true;

          // --- Check for trade closure conditions ---
          const { takeProfitPrice, stopLossPrice } = this.getTakeProfitStopLoss(trade);
          const maxDurationHours = MAX_TRADE_DURATION_HOURS[this.settings.investmentStyle];
          const tradeDurationHours = (now - trade.openTimestamp) / (1000 * 60 * 60);

          let closeReason: Trade['closeReason'];

          // 1. Check for Take Profit / Stop Loss
          if (trade.direction === 'buy') {
            if (currentPrice >= takeProfitPrice) closeReason = 'Take Profit';
            else if (currentPrice <= stopLossPrice) closeReason = 'Stop Loss';
          } else { // 'sell'
            if (currentPrice <= takeProfitPrice) closeReason = 'Take Profit';
            else if (currentPrice >= stopLossPrice) closeReason = 'Stop Loss';
          }
          
          // 2. Check for Time Limit
          if (!closeReason && tradeDurationHours > maxDurationHours) {
            closeReason = 'Time Limit';
          }

          // 3. If a reason was found, close the trade
          if (closeReason) {
            trade.status = 'closed';
            trade.closePrice = currentPrice;
            trade.closeTimestamp = now;
            trade.closeReason = closeReason;
            // Capture the targets at the moment of closing
            trade.takeProfitPrice = takeProfitPrice;
            trade.stopLossPrice = stopLossPrice;
            console.log(`Auto-closing trade ${trade.id} for ${trade.coin.symbol}. Reason: ${closeReason}.`);
            this.sendWebhook({ type: 'trade_close', trade });
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
    if (value === null || value === undefined || !isFinite(value)) {
        return '$0.00';
    }
    const fractionDigits = (Math.abs(value) > 0 && Math.abs(value) < 1) ? 6 : 2;
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.max(2, fractionDigits)
    });
};


export const tradeSimulatorService = new TradeSimulatorService();