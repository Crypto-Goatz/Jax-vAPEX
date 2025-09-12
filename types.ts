
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string | Idea | Signal | Health;
}

export interface SocialPost {
  platform: 'X' | 'Other';
  user: string;
  handle: string;
  content: string;
  url: string;
  avatarUrl?: string;
}

export interface ChatContext {
  symbol?: string | null;
  narrative?: string | null;
  posts?: SocialPost[] | null;
}

// These types are based on the OpenAPI spec and can be used for potential future structured data rendering.
export interface Idea {
  type: 'idea';
  symbol?: string | null;
  strategy?: string | null;
  entry_low?: number | null;
  entry_high?: number | null;
  stop?: number | null;
  target1?: number | null;
  target2?: number | null;
  confidence?: number | null;
  hold_minutes?: number | null;
  rationale?: string[] | null;
}

export interface Signal {
  type: 'signal';
  ts?: string | null;
  strategy?: string | null;
  side?: 'long' | 'short' | null;
  score?: number | null;
  features_used?: string[] | null;
  rationale?: string[] | null;
}

export interface Health {
    type: 'health';
    ingest_ok?: boolean | null;
    last_tick_ts?: string | null;
    sources_ok?: string[] | null;
}
