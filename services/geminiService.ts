
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import type { LearningPattern } from './learningService';
import type { AvailableSignal } from './signalsService';
import type { BtcHistoryEntry } from './btcHistoryService';


// Fix: Initialize GoogleGenAI with named apiKey parameter
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

/**
 * Sends a prompt to the Gemini model with the predefined system instruction.
 * @param prompt The user's message.
 * @param image Optional image data for multimodal prompts.
 * @returns A string containing the model's response, expected to be a JSON string.
 */
export const runChat = async (
    prompt: string,
    image?: { data: string; mimeType: string }
): Promise<string> => {
    try {
        let contents: any;

        if (image) {
            const imagePart = {
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.data,
                },
            };
            const textPart = {
                text: prompt,
            };
            contents = { parts: [textPart, imagePart] };
        } else {
            contents = prompt;
        }

        // Fix: Use ai.models.generateContent with correct parameters
        const response = await ai.models.generateContent({
            // Fix: Use gemini-2.5-flash model which supports vision
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            },
        });
        // Fix: Return text directly from the response
        return response.text;
    } catch (error) {
        console.error("Gemini API call failed in runChat:", error);
        // Fallback to a structured error message that the frontend can parse
        return JSON.stringify({
            type: 'text',
            payload: {
                text: "Sorry, I encountered an error connecting to the AI. Please try again."
            }
        });
    }
};

/**
 * Asks the Gemini model to generate current market narratives and commentary.
 * @returns A structured object with narratives and market mover comments.
 */
export const getMarketNarratives = async (): Promise<{ narratives: any[], market_movers_commentary: any[] }> => {
    try {
        const prompt = `Analyze the current crypto market based on real-time data. Identify 3-5 key emerging narratives driving price action. For each narrative, provide a title, a concise summary, the relevant pipeline stage (e.g., "Watchlist", "Signal", "Spot"), key indicators, a list of affected asset symbols, and a current ISO 8601 timestamp. Also, provide brief commentary for the top 3 market gainers and top 3 losers in the last 24 hours.`;

        const response = await ai.models.generateContent({
            // Fix: Use gemini-2.5-flash model
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        narratives: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    summary: { type: Type.STRING },
                                    pipeline_stage: { type: Type.STRING },
                                    key_indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    affected_assets: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    timestamp: { type: Type.STRING, description: "ISO 8601 timestamp" }
                                },
                                required: ["title", "summary", "pipeline_stage", "key_indicators", "affected_assets", "timestamp"]
                            }
                        },
                        market_movers_commentary: {
                             type: Type.ARRAY,
                             items: {
                                 type: Type.OBJECT,
                                 properties: {
                                     symbol: { type: Type.STRING },
                                     comment: { type: Type.STRING }
                                 },
                                 required: ["symbol", "comment"]
                             }
                        }
                    },
                    required: ["narratives", "market_movers_commentary"]
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Gemini API call failed in getMarketNarratives:", error);
        throw new Error("Failed to get market narratives from the AI.");
    }
};

/**
 * Asks the Gemini model to identify new, actionable trading patterns.
 * @returns A structured object containing a list of learning patterns.
 */
export const getLearningPatterns = async (): Promise<{ patterns: LearningPattern[] }> => {
    try {
        const prompt = `Analyze historical and real-time market data to identify 3-5 novel, actionable trading patterns. These can include Price Correlation, Sentiment Indicator, On-Chain Anomaly, Derivatives Signal, or Inter-Asset Lag. For each pattern, provide a unique ID (uuid format), title, description, category, confidence score (0-100), observation count, the trigger asset symbol, the affected asset symbol, and the resulting trade direction ('buy' or 'sell').`;

        const response = await ai.models.generateContent({
            // Fix: Use gemini-2.5-flash model
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        patterns: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    category: { type: Type.STRING },
                                    confidence: { type: Type.NUMBER },
                                    observation_count: { type: Type.INTEGER },
                                    trigger_asset: { type: Type.STRING },
                                    affected_asset: { type: Type.STRING },
                                    trade_direction: { type: Type.STRING, enum: ['buy', 'sell'] }
                                },
                                required: ["id", "title", "description", "category", "confidence", "observation_count", "trigger_asset", "affected_asset", "trade_direction"]
                            }
                        }
                    },
                    required: ["patterns"]
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Gemini API call failed in getLearningPatterns:", error);
        throw new Error("Failed to get learning patterns from the AI.");
    }
};


/**
 * Uses the Gemini model to perform a smart search on available signals.
 * @param query The user's natural language search query.
 * @param signals A list of available signals to search through.
 * @returns An array of signal IDs that match the query.
 */
export const getSmartSignalSearch = async (query: string, signals: AvailableSignal[]): Promise<string[]> => {
    try {
        const prompt = `
        From the following list of available signals, return a JSON array of signal IDs that are most relevant to the user's search query.
        User Query: "${query}"

        Available Signals:
        ${JSON.stringify(signals, null, 2)}

        Analyze the query's intent (e.g., specific assets, market conditions, signal types) and match it against the signal titles, descriptions, and assets. Return only the array of matching IDs. If no signals match, return an empty array.
        `;

        const response = await ai.models.generateContent({
            // Fix: Use gemini-2.5-flash model
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Gemini API call failed in getSmartSignalSearch:", error);
        throw new Error("Failed to perform smart search with the AI.");
    }
};

/**
 * Asks the Gemini model to refine a failed trading pattern.
 * @param pattern The failed learning pattern.
 * @param pnl The resulting P/L from the failed experiment.
 * @returns A string containing the AI's suggestion for a refined pattern.
 */
export const getRefinedPattern = async (pattern: LearningPattern, pnl: number): Promise<string> => {
    try {
        const prompt = `
        As an expert AI trading strategist, analyze the following trading pattern that failed when tested.
        The experiment resulted in a P/L of ${pnl.toFixed(2)} USD.

        Failed Pattern Details:
        - Title: "${pattern.title}"
        - Category: ${pattern.category}
        - Hypothesis: "${pattern.description}"
        - Trigger Asset: ${pattern.trigger_asset}
        - Affected Asset: ${pattern.affected_asset}
        - Direction: ${pattern.trade_direction}
        - AI Confidence: ${pattern.confidence}%

        Your task is to propose a refined, more robust version of this pattern.
        1.  Identify potential flaws. Was it too simple? Did it miss a key confirmation indicator (e.g., volume, volatility, another asset's movement)?
        2.  Suggest 1-2 specific, additional conditions to add to the hypothesis to improve its accuracy. Examples: "AND BTC volume is above the 24h average" or "AND DXY is trending downwards".
        3.  Provide a new, improved "description" for the refined pattern.
        4.  Keep the response concise and actionable.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;

    } catch (error) {
        console.error("Gemini API call failed in getRefinedPattern:", error);
        return "Could not get a refined pattern from the AI due to an error.";
    }
};

/**
 * Asks the Gemini model to analyze a slice of historical BTC data to find patterns.
 * @param dataSlice A slice of historical data.
 * @param selectedDate The target date of the major event.
 * @param eventType The type of event that occurred on the target date.
 * @returns A string containing the AI's analysis in markdown format.
 */
export const analyzeBtcPatterns = async (dataSlice: BtcHistoryEntry[], selectedDate: string, eventType: string): Promise<string> => {
    try {
        const formattedData = dataSlice.map(d => 
            `Date: ${d.date}, Price: ${d.price.toFixed(2)}, Change: ${d.dailyChange.toFixed(2)}%, Volatility: ${d.volatility.toFixed(2)}%, Event: ${d.eventType}, Intensity: ${d.intensityScore}`
        ).join('\n');
        
        const prompt = `
        You are an expert crypto market analyst. I will provide you with a slice of historical Bitcoin data.
        Your task is to analyze this data to find patterns or precursors leading up to the significant market event on ${selectedDate}.

        The event on ${selectedDate} was: "${eventType}".

        Historical Data Slice:
        ---
        ${formattedData}
        ---

        Based on the data provided, please answer the following:
        1.  **Pattern Identification:** In the 3-7 days before ${selectedDate}, were there any notable trends in volatility, price action, or smaller events that might have predicted the main event?
        2.  **Contextual Analysis:** Provide a brief, insightful narrative explaining how these preceding factors could have contributed to the event on ${selectedDate}.
        3.  **Key Takeaway:** Summarize your finding into a single, actionable takeaway for a trader.

        Keep your analysis concise and focused only on the data provided. Respond in simple markdown format, using '**' for bolding.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;

    } catch (error) {
        console.error("Gemini API call failed in analyzeBtcPatterns:", error);
        return "Sorry, the AI analysis failed. Please try again later.";
    }
};

/**
 * Asks the Gemini model to simulate an "If This, Then That" scenario.
 * @param rule The IFTTT rule defined by the user.
 * @returns A structured object containing a list of matching historical patterns.
 */
export const simulateSignalCondition = async (rule: object): Promise<{ results: any[] }> => {
    try {
        const prompt = `
        You are JAX, an expert crypto market analyst AI.
        A user has defined the following 'If This, Then That' market scenario:
        ${JSON.stringify(rule, null, 2)}

        Your task is to search your extensive historical market data (prices, on-chain, sentiment, etc.) to find all instances that match the "IF" condition.
        For those instances, analyze the "THEN" asset to answer the user's "ask".
        
        Group your findings into distinct, named patterns or signals. For each pattern you identify, provide the following details.
        Return a JSON object with a single key "results" containing an array of these patterns.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        results: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    patternName: { type: Type.STRING, description: "A concise name for the identified pattern, e.g., 'Bullish Contagion' or 'Post-Spike Consolidation'." },
                                    outcomeDescription: { type: Type.STRING, description: "A clear, human-readable summary of the most likely outcome based on the user's 'ask'. Include relevant metrics (e.g., price change, sentiment score, USD value) and timeframe. Example: 'Average gain of +8.21% over the next 3 days.' OR 'Whale wallets show an average accumulation of $1.5M over the next 48 hours.'" },
                                    historicalOccurrences: { type: Type.INTEGER, description: "The number of times this exact pattern was observed in the historical data." },
                                    confidenceScore: { type: Type.NUMBER, description: "Your confidence in this outcome occurring again, from 0 to 100." }
                                },
                                required: ["patternName", "outcomeDescription", "historicalOccurrences", "confidenceScore"]
                            }
                        }
                    },
                    required: ["results"]
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Gemini API call failed in simulateSignalCondition:", error);
        throw new Error("Failed to get simulation results from the AI.");
    }
};
