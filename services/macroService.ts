export interface MacroData {
    m2Supply: number; // In trillions
    inflationRate: number; // As a percentage
    interestRate: number; // As a percentage
}

export interface HistoricalMacroDataPoint {
  date: string; // 'YYYY-MM-DD'
  m2Supply: number; // In trillions
  inflationRate: number; // As a percentage
  interestRate: number; // As a percentage
}


// Mock historical data, simulating a FRED API call. Data is monthly.
const HISTORICAL_MACRO_DATA: HistoricalMacroDataPoint[] = [
    { date: '2021-01-01', m2Supply: 19.39, inflationRate: 1.4, interestRate: 0.25 },
    { date: '2021-02-01', m2Supply: 19.68, inflationRate: 1.7, interestRate: 0.25 },
    { date: '2021-03-01', m2Supply: 19.89, inflationRate: 2.6, interestRate: 0.25 },
    { date: '2021-04-01', m2Supply: 20.13, inflationRate: 4.2, interestRate: 0.25 },
    { date: '2021-05-01', m2Supply: 20.35, inflationRate: 5.0, interestRate: 0.25 },
    { date: '2021-06-01', m2Supply: 20.49, inflationRate: 5.4, interestRate: 0.25 },
    { date: '2021-07-01', m2Supply: 20.61, inflationRate: 5.4, interestRate: 0.25 },
    { date: '2021-08-01', m2Supply: 20.76, inflationRate: 5.3, interestRate: 0.25 },
    { date: '2021-09-01', m2Supply: 20.94, inflationRate: 5.4, interestRate: 0.25 },
    { date: '2021-10-01', m2Supply: 21.13, inflationRate: 6.2, interestRate: 0.25 },
    { date: '2021-11-01', m2Supply: 21.35, inflationRate: 6.8, interestRate: 0.25 },
    { date: '2021-12-01', m2Supply: 21.57, inflationRate: 7.0, interestRate: 0.25 },
    { date: '2022-01-01', m2Supply: 21.64, inflationRate: 7.5, interestRate: 0.25 },
    { date: '2022-02-01', m2Supply: 21.75, inflationRate: 7.9, interestRate: 0.25 },
    { date: '2022-03-01', m2Supply: 21.78, inflationRate: 8.5, interestRate: 0.50 },
    { date: '2022-04-01', m2Supply: 21.73, inflationRate: 8.3, interestRate: 0.50 },
    { date: '2022-05-01', m2Supply: 21.70, inflationRate: 8.6, interestRate: 1.00 },
    { date: '2022-06-01', m2Supply: 21.62, inflationRate: 9.1, interestRate: 1.75 },
    { date: '2022-07-01', m2Supply: 21.51, inflationRate: 8.5, interestRate: 2.50 },
    { date: '2022-08-01', m2Supply: 21.46, inflationRate: 8.3, interestRate: 2.50 },
    { date: '2022-09-01', m2Supply: 21.39, inflationRate: 8.2, interestRate: 3.25 },
    { date: '2022-10-01', m2Supply: 21.34, inflationRate: 7.7, interestRate: 4.00 },
    { date: '2022-11-01', m2Supply: 21.30, inflationRate: 7.1, interestRate: 4.50 },
    { date: '2022-12-01', m2Supply: 21.20, inflationRate: 6.5, interestRate: 4.50 },
    { date: '2023-01-01', m2Supply: 21.09, inflationRate: 6.4, interestRate: 4.75 },
    { date: '2023-02-01', m2Supply: 20.96, inflationRate: 6.0, interestRate: 4.75 },
    { date: '2023-03-01', m2Supply: 20.81, inflationRate: 5.0, interestRate: 5.00 },
    { date: '2023-04-01', m2Supply: 20.73, inflationRate: 4.9, interestRate: 5.25 },
    { date: '2023-05-01', m2Supply: 20.70, inflationRate: 4.0, interestRate: 5.25 },
    { date: '2023-06-01', m2Supply: 20.77, inflationRate: 3.0, interestRate: 5.25 },
    { date: '2023-07-01', m2Supply: 20.79, inflationRate: 3.2, interestRate: 5.50 },
    { date: '2023-08-01', m2Supply: 20.80, inflationRate: 3.7, interestRate: 5.50 },
    { date: '2023-09-01', m2Supply: 20.78, inflationRate: 3.7, interestRate: 5.50 },
    { date: '2023-10-01', m2Supply: 20.76, inflationRate: 3.2, interestRate: 5.50 },
    { date: '2023-11-01', m2Supply: 20.75, inflationRate: 3.1, interestRate: 5.50 },
    { date: '2023-12-01', m2Supply: 20.87, inflationRate: 3.4, interestRate: 5.50 },
];

// Mock service to provide static macro-economic data as requested.
class MacroService {
    private macroData: MacroData = {
        m2Supply: 20.87,
        inflationRate: 3.4,
        interestRate: 5.5,
    };

    public async getMacroData(): Promise<MacroData> {
        // In a real application, this would fetch from an API (e.g., FRED)
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(this.macroData);
            }, 250); // Simulate network latency
        });
    }

    public async getHistoricalMacroData(): Promise<HistoricalMacroDataPoint[]> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(HISTORICAL_MACRO_DATA);
            }, 300); // Simulate network latency
        });
    }
}

export const macroService = new MacroService();