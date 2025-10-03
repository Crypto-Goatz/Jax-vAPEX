import { BehaviorSubject } from 'rxjs';

// --- TYPE DEFINITIONS ---

export type DataSourceKey =
  | 'news'
  | 'mergedMaster'
  | 'pipeline'
  | 'okx'
  | 'lunarSocial'
  | 'defiLlama'
  | 'coinGlass'
  | 'coinbase'
  | 'historicalArchive';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface DataSourceStatus {
  status: SyncStatus;
  lastSync: Date | null;
  error: string | null;
  data: any[];
  rowCount: number;
}

export interface DataSource {
  key: DataSourceKey;
  name: string;
  gid: string;
  url: string;
  cacheDuration: number; // in minutes
}

// --- DATA SOURCE DEFINITIONS ---

const BASE_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSc5lzT8YRDvyb1vqo0NiDD6xvp5tbffuPToSSi_P-a-F8J_AA0nrkpWzXii_1b_hbKydqdmOnRST0p/pub?output=csv';

export const DATA_SOURCES: Record<DataSourceKey, DataSource> = {
  news: {
    key: 'news',
    name: 'News Data',
    gid: '1040724763',
    url: `${BASE_URL}&gid=1040724763`,
    cacheDuration: 15,
  },
  mergedMaster: {
    key: 'mergedMaster',
    name: 'Merged Master Prices',
    gid: '916799667',
    url: `${BASE_URL}&gid=916799667`,
    cacheDuration: 5,
  },
  pipeline: {
    key: 'pipeline',
    name: 'AI Pipeline Signals',
    gid: '771486824',
    url: `${BASE_URL}&gid=771486824`,
    cacheDuration: 15,
  },
  okx: {
    key: 'okx',
    name: 'OKX Exchange Data',
    gid: '725556211',
    url: `${BASE_URL}&gid=725556211`,
    cacheDuration: 15,
  },
  lunarSocial: {
    key: 'lunarSocial',
    name: 'LunarCrush Social Data',
    gid: '1299027952',
    url: `${BASE_URL}&gid=1299027952`,
    cacheDuration: 30,
  },
  defiLlama: {
    key: 'defiLlama',
    name: 'DeFi Llama TVL',
    gid: '2020417128',
    url: `${BASE_URL}&gid=2020417128`,
    cacheDuration: 30,
  },
  coinGlass: {
    key: 'coinGlass',
    name: 'CoinGlass Derivatives',
    gid: '1685990500',
    url: `${BASE_URL}&gid=1685990500`,
    cacheDuration: 30,
  },
  coinbase: {
    key: 'coinbase',
    name: 'Coinbase Exchange Data',
    gid: '1023011239',
    url: `${BASE_URL}&gid=1023011239`,
    cacheDuration: 15,
  },
  historicalArchive: {
    key: 'historicalArchive',
    name: 'Historical Archive',
    gid: '1218330071',
    url: `${BASE_URL}&gid=1218330071`,
    cacheDuration: 1440, // 24 hours
  },
};

// --- CSV PARSING UTILITY ---
const parseCsv = (csvText: string): any[] => {
  const rows = csvText.trim().split(/\r?\n/);
  if (rows.length < 2) return [];

  const headers = rows.shift()!.split(',').map(h => h.trim());

  return rows.map(row => {
    const values = row.split(',');
    const obj: any = {};
    headers.forEach((header, index) => {
      const value = values[index]?.trim() ?? '';
      if (!isNaN(Number(value)) && value !== '') {
        obj[header] = Number(value);
      } else {
        obj[header] = value;
      }
    });
    return obj;
  });
};

// --- SERVICE CLASS ---
class GoogleSheetService {
  private statusSubject: BehaviorSubject<Record<DataSourceKey, DataSourceStatus>>;
  private statuses: Record<DataSourceKey, DataSourceStatus>;

  constructor() {
    const initialStatuses = {} as Record<DataSourceKey, DataSourceStatus>;
    for (const key in DATA_SOURCES) {
      initialStatuses[key as DataSourceKey] = {
        status: 'idle',
        lastSync: null,
        error: null,
        data: [],
        rowCount: 0,
      };
    }
    this.statuses = initialStatuses;
    this.statusSubject = new BehaviorSubject(this.statuses);
  }

  public getStatusUpdates() {
    return this.statusSubject.asObservable();
  }

  public getStatuses() {
    return this.statuses;
  }

  public async fetchData<T>(key: DataSourceKey, forceRefresh = false): Promise<T[]> {
    const source = DATA_SOURCES[key];
    const status = this.statuses[key];

    const now = new Date();
    const cacheExpiry = new Date(
      (status.lastSync?.getTime() || 0) + source.cacheDuration * 60 * 1000
    );

    if (!forceRefresh && status.status === 'synced' && now < cacheExpiry) {
      return status.data as T[];
    }

    this.updateStatus(key, { status: 'syncing', error: null });

    try {
      // 🔑 FIX: direct fetch, no proxy
      const response = await fetch(source.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const csvText = await response.text();
      const data = parseCsv(csvText);

      this.updateStatus(key, {
        status: 'synced',
        lastSync: new Date(),
        data: data,
        rowCount: data.length,
      });

      return data as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error(`Error syncing data source "${source.name}":`, errorMessage);
      this.updateStatus(key, { status: 'error', error: errorMessage });
      throw error;
    }
  }

  public async syncAll() {
    const allPromises = Object.keys(DATA_SOURCES).map(key =>
      this.fetchData(key as DataSourceKey, true).catch(() => null)
    );
    await Promise.all(allPromises);
  }

  private updateStatus(key: DataSourceKey, updates: Partial<DataSourceStatus>) {
    this.statuses = {
      ...this.statuses,
      [key]: {
        ...this.statuses[key],
        ...updates,
      },
    };
    this.statusSubject.next(this.statuses);
  }
}

// Export a singleton instance
export const googleSheetService = new GoogleSheetService();
