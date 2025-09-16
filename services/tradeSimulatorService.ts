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
  aiConfidence: 75.0,
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
  
  private async sendWebhook(payload: object) {
    if (!this.settings.webhookEnabled || !this.settings.webhookUrl) {
      return;
    }
    
    try {
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
    let styleMultiplier: number;
    switch (this.settings.investmentStyle) {
        case 'Scalping': styleMultiplier = 0.5; break;
        case 'Swing Trading': styleMultiplier = 1.5; break;
        default: styleMultiplier = 1.0; break;
    }
    
    let riskMultiplier: number;
    switch (this.settings.riskTolerance) {
        case 'Conservative': riskMultiplier = 0.75; break;
        case 'Aggressive': riskMultiplier = 1.5; break;
        default: riskMultiplier = 1.0; break;
    }
    
    const tradeSize = BASE_TRADE_SIZE_USD * styleMultiplier * riskMultiplier;

    const newTrade: Trade = {
      id: `${coin.id}-${new Date().getTime()}`,
      coin: { ...coin },
      direction,
      entryPrice: coin.price,
      sizeUSD: tradeSize,
      openTimestamp: Date.now(),
      closeTimestamp: null,
      closePrice: null,
      pnl: 0,
      status: 'open',
    };
    
    const { takeProfitPrice, stopLossPrice } = this.getTakeProfitStopLoss(newTrade);
    newTrade.takeProfitPrice = takeProfitPrice;
    newTrade.stopLossPrice = stopLossPrice;

    this.trades.unshift(newTrade);
    this.saveTrades();
    this.sendWebhook({ type: 'trade_open', trade: newTrade });
    this.notifyListeners();
    console.log(`Executed ${direction} trade for ${coin.symbol} at $${coin.price} with size ${formatCurrency(tradeSize)} (Style: ${this.settings.investmentStyle}, Risk: ${this.settings.riskTolerance})`);
  }

  getTakeProfitStopLoss(trade: Trade): { takeProfitPrice: number, stopLossPrice: number } {
    const { riskTolerance, investmentStyle } = this.settings;

    let takeProfitPercent: number;
    let stopLossPercent: number;

    switch (riskTolerance) {
      case 'Conservative': takeProfitPercent = 2.5; stopLossPercent = -1.0; break; // Tighter SL for conservative
      case 'Aggressive': takeProfitPercent = 10; stopLossPercent = -5; break;
      default: takeProfitPercent = 5; stopLossPercent = -2.5; break; // Moderate
    }

    switch (investmentStyle) {
      case 'Scalping': takeProfitPercent *= 0.4; stopLossPercent *= 0.5; break; // Tighter TP/SL for scalps
      case 'Swing Trading': takeProfitPercent *= 2; stopLossPercent *= 1.5; break;
      default: break;
    }

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

  updateOpenTrades(livePrices: CryptoPrice[]) {
    let updated = false;
    const priceMap = new Map(livePrices.map(p => [p.id, p.price]));
    const now = Date.now();

    this.trades.forEach(trade => {
      if (trade.status === 'open') {
        const currentPrice = priceMap.get(trade.coin.id);
        if (currentPrice !== undefined) {
          const priceChange = currentPrice - trade.entryPrice;
          const positionSize = trade.sizeUSD / trade.entryPrice;
          trade.pnl = trade.direction === 'buy' ? priceChange * positionSize : -priceChange * positionSize;
          updated = true;

          const { takeProfitPrice, stopLossPrice } = this.getTakeProfitStopLoss(trade);
          const maxDurationHours = MAX_TRADE_DURATION_HOURS[this.settings.investmentStyle];
          const tradeDurationHours = (now - trade.openTimestamp) / (1000 * 60 * 60);

          let closeReason: Trade['closeReason'];

          if (trade.direction === 'buy') {
            if (currentPrice >= takeProfitPrice) closeReason = 'Take Profit';
            else if (currentPrice <= stopLossPrice) closeReason = 'Stop Loss';
          } else { // 'sell'
            if (currentPrice <= takeProfitPrice) closeReason = 'Take Profit';
            else if (currentPrice >= stopLossPrice) closeReason = 'Stop Loss';
          }
          
          if (!closeReason && tradeDurationHours > maxDurationHours) {
            closeReason = 'Time Limit';
          }

          if (closeReason) {
            trade.status = 'closed';
            trade.closePrice = currentPrice;
            trade.closeTimestamp = now;
            trade.closeReason = closeReason;
            trade.takeProfitPrice = takeProfitPrice;
            trade.stopLossPrice = stopLossPrice;
            console.log(`Auto-closing trade ${trade.id} for ${trade.coin.symbol}. Reason: ${closeReason}.`);
            this.sendWebhook({ type: 'trade_close', trade });
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