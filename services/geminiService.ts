import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        type: { 
            type: Type.STRING, 
            enum: ['idea', 'signal', 'health', 'text'],
        },
        payload: {
            type: Type.OBJECT,
            properties: {
                // Text
                text: { type: Type.STRING, nullable: true },
                // Idea
                symbol: { type: Type.STRING, nullable: true },
                strategy: { type: Type.STRING, nullable: true },
                entry_low: { type: Type.NUMBER, nullable: true },
                entry_high: { type: Type.NUMBER, nullable: true },
                stop: { type: Type.NUMBER, nullable: true },
                target1: { type: Type.NUMBER, nullable: true },
                target2: { type: Type.NUMBER, nullable: true },
                confidence: { type: Type.NUMBER, nullable: true },
                hold_minutes: { type: Type.NUMBER, nullable: true },
                rationale: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                // Signal
                ts: { type: Type.STRING, nullable: true },
                side: { type: Type.STRING, enum: ['long', 'short'], nullable: true },
                score: { type: Type.NUMBER, nullable: true },
                features_used: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                // Health
                ingest_ok: { type: Type.BOOLEAN, nullable: true },
                last_tick_ts: { type: Type.STRING, nullable: true },
                sources_ok: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
            }
        },
        context: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
                symbol: { type: Type.STRING, nullable: true },
                narrative: { type: Type.STRING, nullable: true },
                posts: {
                    type: Type.ARRAY,
                    nullable: true,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            platform: { type: Type.STRING, enum: ['X', 'Other'], nullable: true },
                            user: { type: Type.STRING, nullable: true },
                            handle: { type: Type.STRING, nullable: true },
                            content: { type: Type.STRING, nullable: true },
                            url: { type: Type.STRING, nullable: true },
                            avatarUrl: { type: Type.STRING, nullable: true },
                        }
                    }
                }
            }
        }
    },
    required: ['type', 'payload']
};


export async function runChat(prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            // Return a JSON structure for the error so the UI can handle it gracefully
            return JSON.stringify({
                type: 'text',
                payload: {
                    text: `Error: ${error.message}. Please check your API key and network connection.`
                }
            });
        }
        return JSON.stringify({
            type: 'text',
            payload: {
                text: "An unknown error occurred while contacting the AI model."
            }
        });
    }
}

// Schema for the Market Narratives Dashboard
const marketNarrativesSchema = {
  type: Type.OBJECT,
  properties: {
    narratives: {
      type: Type.ARRAY,
      description: 'A list of 3-4 current, distinct market narratives.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'A catchy headline for the narrative.' },
          summary: { type: Type.STRING, description: 'A 2-3 sentence summary explaining the narrative.' },
          pipeline_stage: { type: Type.STRING, enum: ['Watchlist', 'Signal', 'Spot', 'Hold', 'Exit'], description: 'The pipeline stage this narrative most relates to.' },
          timestamp: { type: Type.STRING, description: 'The ISO 8601 timestamp of when this narrative was identified.' },
          key_indicators: {
            type: Type.ARRAY,
            description: 'A list of 2-3 simulated data points supporting the narrative.',
            items: { type: Type.STRING },
          },
          affected_assets: {
            type: Type.ARRAY,
            description: 'A list of 3-5 crypto symbols (e.g., BTC, ETH) affected by this narrative.',
            items: { type: Type.STRING },
          },
        },
        required: ['title', 'summary', 'pipeline_stage', 'key_indicators', 'affected_assets', 'timestamp'],
      },
    },
    market_movers_commentary: {
        type: Type.ARRAY,
        description: "A list of short, plausible reasons for the top 5 gainers and top 5 losers' recent price action, often linking back to the generated narratives.",
        items: {
            type: Type.OBJECT,
            properties: {
                symbol: { type: Type.STRING, description: 'The crypto symbol (e.g., BTC).' },
                comment: { type: Type.STRING, description: 'A brief, one-sentence comment explaining the price movement.' },
            },
            required: ['symbol', 'comment'],
        }
    }
  },
  required: ['narratives', 'market_movers_commentary'],
};

export async function getMarketNarratives(): Promise<any> {
    const prompt = `You are a senior crypto market analyst AI. Your task is to synthesize information from a wide range of simulated data sources to identify the key narratives driving the market right now.

    Simulate the output of this 5-stage intelligence pipeline:
    - Stage 1 (Watchlist): Filtering top coins by market cap, volume, and TVL.
    - Stage 2 (Signal): Analyzing on-chain data (whale transfers), derivatives (funding rates), and social sentiment (Lunar score).
    - Stage 3 (Spot): Detecting buy signals from order book imbalances and liquidity surges.
    - Stage 4 (Hold): Monitoring news and momentum for ongoing trades.
    - Stage 5 (Exit): Identifying sell triggers from whale dumps or negative sentiment flips.

    Based on your simulated analysis of these stages, generate 3-4 distinct, currently active "market narratives". For each narrative, provide a title, a summary, the most relevant pipeline stage, key data indicators (be specific, e.g., "Whale inflows detected for LINK", "Funding rates for SOL flipping negative"), the assets it affects, and the current ISO 8601 timestamp for when the narrative was generated.

    Additionally, provide a brief, plausible "Jax-Comment" for a list of top market movers, linking their performance to these narratives where possible.

    Respond strictly with a JSON object matching the required schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: marketNarrativesSchema,
            }
        });
        const jsonString = response.text;
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error fetching Market Narratives from Gemini API:", error);
        throw new Error("Failed to fetch AI-generated market narratives.");
    }
}

// Schema for the Historical Events (Market Rewind)
const historicalEventsSchema = {
    type: Type.OBJECT,
    properties: {
        analysisSummary: {
            type: Type.STRING,
            description: "A 2-4 sentence narrative summary explaining the market sentiment and key drivers for the specified date, connecting the events to potential price action."
        },
        events: {
            type: Type.ARRAY,
            description: "A list of 3-5 significant, plausible events that occurred on or around the specified date.",
            items: {
                type: Type.OBJECT,
                properties: {
                    category: {
                        type: Type.STRING,
                        enum: ['News & Narrative', 'Economic', 'On-Chain & Technical', 'Social & Community'],
                        description: "The category of the event."
                    },
                    title: {
                        type: Type.STRING,
                        description: "A concise, headline-style title for the event."
                    },
                    description: {
                        type: Type.STRING,
                        description: "A one-sentence summary of the event's significance."
                    }
                },
                required: ['category', 'title', 'description']
            }
        }
    },
    required: ['analysisSummary', 'events']
};


export async function getHistoricalEvents(date: string): Promise<any> {
    const prompt = `You are JaxSpot, an expert crypto market historian. Your task is to analyze the market conditions for Bitcoin (BTC) on the specific date: ${date}.

    Based on your knowledge of historical events, generate a plausible and informative summary for that day.
    1.  Provide a 2-4 sentence "Analysis Summary" that captures the overall market sentiment and connects the day's events to the likely price action.
    2.  Generate a list of 3-5 of the most significant and relevant events that occurred on or around that date. These events should be things that could realistically impact the crypto market.
    3.  Categorize each event into one of four categories: 'News & Narrative', 'Economic', 'On-Chain & Technical', or 'Social & Community'.

    Respond strictly with a JSON object that matches the required schema. Ensure the events are diverse and reflect the multifaceted nature of the crypto market.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: historicalEventsSchema,
            }
        });
        const jsonString = response.text;
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error fetching Historical Events from Gemini API:", error);
        throw new Error("Failed to fetch AI-generated historical analysis.");
    }
}