
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
}

// These types are based on the OpenAPI spec and can be used for potential future structured data rendering.
export interface Idea {
  symbol: string;
  strategy: string;
  entry_low: number;
  entry_high: number;
  stop: number;
  target1: number;
  target2: number;
  confidence: number;
  hold_minutes: number;
  rationale: string[];
}

export interface Signal {
  ts: string;
  strategy: string;
  side: 'long' | 'short';
  score: number;
  features_used: string[];
  rationale: string[];
}

export interface Health {
    ingest_ok: boolean;
    last_tick_ts: string;
    sources_ok: string[];
}
