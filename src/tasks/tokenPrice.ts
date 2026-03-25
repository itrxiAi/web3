// import { TokenType, Transaction, TxFlowStatus, TxFlowType, TimeInterval } from "@prisma/client";
// import prisma from "@/lib/prisma";
// import decimal from "decimal.js";
// import { getLastCandleUpdate, getTokenPrice, updateCandleWithCurrentPrice } from "@/lib/tokenPriceCandle";

// // Base price and daily rise configuration
// const BASE_PRICE = 0.1; // Starting price
// const DAILY_RISE = 0.005; // Daily price increase
// const FLUCTUATION_RANGE = 0.002; // Maximum random fluctuation (up or down)

// /**
//  * Refreshes token price candles every minute using the current token price
//  * This function is meant to be called by a scheduled task
//  */
// export async function processTokenPrice() {
//   try {
//     const now = new Date();
    
//     // Get the current token price from getTokenPrice
//     const currentPrice = await getTokenPrice();
    
//     // Create intervals to update
//     const intervals = [
//       "FIVE_MIN",
//       "FIFTEEN_MIN",
//       "THIRTY_MIN",
//       "ONE_HOUR"
//     ] as TimeInterval[];
    
//     // For day/week candles, check when they were last updated
//     const lastDayUpdate = await getLastCandleUpdate("ONE_DAY" as TimeInterval);
//     const lastWeekUpdate = await getLastCandleUpdate("ONE_WEEK" as TimeInterval);
    
//     // Update day candle if it's been more than 1 hour since last update
//     if (!lastDayUpdate || (now.getTime() - lastDayUpdate.getTime() > 60 * 60 * 1000)) {
//       intervals.push("ONE_DAY" as TimeInterval);
//     }
    
//     // Update week candle if it's been more than 4 hours since last update
//     if (!lastWeekUpdate || (now.getTime() - lastWeekUpdate.getTime() > 4 * 60 * 60 * 1000)) {
//       intervals.push("ONE_WEEK" as TimeInterval);
//     }
    
//     // For each interval, create or update a candle
//     for (const interval of intervals) {
//       await updateCandleWithCurrentPrice(interval, now, currentPrice);
//     }
    
//     //console.log(`[${now.toISOString()}] Token price candles refreshed successfully with price ${currentPrice}`);
//   } catch (error) {
//     console.error(`[${new Date().toISOString()}] Error refreshing token price candles:`, error);
//   }
// }
