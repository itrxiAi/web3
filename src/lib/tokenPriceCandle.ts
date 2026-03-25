// import decimal from "decimal.js";
// import prisma from "@/lib/prisma";
// import { TimeInterval } from "@prisma/client";

// // Interface for candle data (matches our Prisma schema)
// export interface CandleData {
//   id?: number;
//   interval: TimeInterval;
//   timestamp: Date;
//   open_price: string;
//   close_price: string;
//   high_price: string;
//   low_price: string;
//   volume: string;
//   created_at?: Date;
//   updated_at?: Date;
// }

// /**
//  * Get candles for a specific interval and time range
//  * @param interval The time interval for the candles
//  * @param startTime The start time for the range
//  * @param endTime The end time for the range
//  */
// // export async function getCandles(interval: TimeInterval, startTime: Date, endTime: Date) {
// //   try {
// //     // Get candles from the database
// //     const candles = await prisma.token_price_candle.findMany({
// //       where: {
// //         interval,
// //         timestamp: {
// //           gte: startTime,
// //           lte: endTime
// //         }
// //       },
// //       orderBy: {
// //         timestamp: 'asc'
// //       }
// //     });
    
// //     // Just return whatever candles we found, even if empty
// //     // We no longer generate candles here since that's handled by processTokenPrice
    
// //     return candles;
// //   } catch (error) {
// //     console.error(`Error getting candles for ${interval}:`, error);
// //     throw error;
// //   }
// // }

// // Cache for token prices to avoid recalculating within the same minute
// interface TokenPriceCache {
//     timestamp: Date;
//     price: decimal;
// }

// // In-memory cache for the token price
// let tokenPriceCache: TokenPriceCache | null = null;

// /**
//  * Get the token price
//  * @param startDate Optional custom start date
//  * @param now Optional custom current date
//  * @returns TOKEN price calculated based on time elapsed since start date with daily rise and hourly fluctuation
//  */
// export async function getTokenPrice(startDate?: Date, now?: Date): Promise<decimal> {
//     // Set default value for now if not provided
//     if (!now) {
//         now = new Date();
//     }

//     // Base price and configuration
//     const BASE_PRICE = 1; // Starting price

//     // Fixed start date - December 8, 2025 (UTC)
//     if (!startDate) {
//         startDate = new Date(Date.UTC(2025, 11, 8, 0, 0, 0)); // Month is 0-indexed (11 = December)
//     }
    
//     // If timestamp is before start date, return base price (1)
//     if (now.getTime() < startDate.getTime()) {
//         return new decimal(BASE_PRICE);
//     }
    
//     // Define growth rates with their effective dates
//     // Each entry contains: { effectiveDate: Date, dailyRise: number }
//     const growthRates = [
//         { effectiveDate: new Date(Date.UTC(2025, 11, 8, 0, 0, 0)), dailyRise: 3.7 },    // Initial rate on Dec 8, 2025 (UTC)
//         { effectiveDate: new Date(Date.UTC(2025, 11, 8, 10, 0, 0)), dailyRise: 0.005 },   // Rate after Dec 9, 2025 (UTC)
//         { effectiveDate: new Date(Date.UTC(2025, 11, 9, 0, 0, 0)), dailyRise: 0.05 },   // Rate after Dec 9, 2025 (UTC)
//         { effectiveDate: new Date(Date.UTC(2025, 11, 11, 16, 0, 0)), dailyRise: 0.15 },   // Rate after Dec 9, 2025 (UTC)
//         { effectiveDate: new Date(Date.UTC(2025, 11, 19, 3, 0, 0)), dailyRise: 0.02 },   // Rate after Dec 9, 2025 (UTC)

//         // Add more rates as needed with future dates
//     ];
    
//     // Round down to the nearest minute to create a cache key (in UTC)
//     const minuteTimestamp = new Date(
//         Date.UTC(
//             now.getUTCFullYear(),
//             now.getUTCMonth(),
//             now.getUTCDate(),
//             now.getUTCHours(),
//             now.getUTCMinutes(),
//             0,
//             0
//         )
//     );
    
//     // Check if we have a cached price for this minute
//     if (tokenPriceCache && 
//         tokenPriceCache.timestamp.getTime() === minuteTimestamp.getTime()) {
//         return tokenPriceCache.price;
//     }

//     // Check if this is historical data by comparing with the latest candle in the database
//     try {
//         // First get the latest 5-minute candle timestamp
//         const latestCandle = await prisma.token_price_candle.findFirst({
//             where: {
//                 interval: "FIVE_MIN"
//             },
//             orderBy: {
//                 timestamp: 'desc'
//             },
//             select: {
//                 timestamp: true
//             }
//         });
        
//         // If we have candles in the database and the requested timestamp is not newer than the latest candle
//         if (latestCandle && minuteTimestamp.getTime() <= latestCandle.timestamp.getTime()) {
//             // Calculate the exact 5-minute interval start time that this timestamp belongs to
//             const fiveMinIntervalStart = new Date(minuteTimestamp);
//             fiveMinIntervalStart.setMinutes(Math.floor(fiveMinIntervalStart.getMinutes() / 5) * 5);
//             fiveMinIntervalStart.setSeconds(0);
//             fiveMinIntervalStart.setMilliseconds(0);
            
//             // Find the exact 5-minute candle that this timestamp belongs to
//             const candle = await prisma.token_price_candle.findFirst({
//                 where: {
//                     interval: "FIVE_MIN",
//                     timestamp: fiveMinIntervalStart // Find the exact candle for this 5-min interval
//                 },
//                 take: 1
//             });
            
//             if (candle) {
//                 //console.log(`Found historical price for ${minuteTimestamp.toISOString()} in database: ${candle.close_price}`);
//                 return new decimal(candle.close_price);
//             }
//         }
//     } catch (error) {
//         console.error(`Error fetching historical price from database:`, error);
//         // Continue with calculation if database lookup fails
//     }
    
//     // If no cache hit, calculate the price
    
//     // Generate a highly random fluctuation range using complex seed and multiple mathematical functions
    
//     // Create multiple seeds with different prime number multipliers for more chaos
//     const baseSeed = minuteTimestamp.getFullYear() * 1000000 + 
//                    (minuteTimestamp.getMonth() + 1) * 10000 + 
//                    minuteTimestamp.getDate() * 100 + 
//                    minuteTimestamp.getHours();
    
//     // Use multiple prime numbers and different functions to create more randomness
//     const seed1 = baseSeed * 0.7531 + 9973; // Prime number offset
//     const seed2 = baseSeed * 1.1369 + 7919; // Different prime number
//     const seed3 = baseSeed * 0.3299 + 6271; // Another prime
    
//     // Mix different trigonometric functions for more chaotic behavior
//     const random1 = Math.abs(Math.sin(seed1) * Math.cos(seed2 * 0.5));
//     const random2 = Math.abs(Math.tan(seed3 * 0.1) % 1); // Use modulo to contain tan's range
//     const random3 = Math.abs(Math.sin(seed1 * seed2) * Math.cos(seed3));
    
//     // Combine the randoms in a non-linear way
//     const combinedRandom = (random1 * 0.4 + random2 * 0.3 + random3 * 0.3) % 1;
    
//     // Scale to desired range (0.00001 to 0.00003) - much smaller fluctuation
//     const MIN_RANGE = 0.00001;
//     const MAX_RANGE = 0.00003;
//     const hourlyRandom = MIN_RANGE + combinedRandom * (MAX_RANGE - MIN_RANGE);
    
//     const FLUCTUATION_RANGE = hourlyRandom; // Highly randomized but very small fluctuation range
  
    
//     // Calculate base price using the growth rates array
//     let basePrice = new decimal(BASE_PRICE);
    
//     // Sort growth rates by date to ensure proper order
//     const sortedRates = [...growthRates].sort((a, b) => 
//         a.effectiveDate.getTime() - b.effectiveDate.getTime());
    
//     // Find which rate applies to the current date
//     let applicableRate = sortedRates[0].dailyRise; // Default to first rate
//     for (let i = sortedRates.length - 1; i >= 0; i--) {
//         if (now.getTime() >= sortedRates[i].effectiveDate.getTime()) {
//             applicableRate = sortedRates[i].dailyRise;
//             break;
//         }
//     }
    
//     // Calculate days since start (as a decimal including partial days)
//     const millisecondsSinceStart = now.getTime() - startDate.getTime();
//     const daysSinceStart = millisecondsSinceStart / (24 * 60 * 60 * 1000);
    
//     // Calculate the price based on elapsed time since start date
//     // We'll process each time segment with its applicable rate
    
//     // Start with the base price
//     let currentPrice = new decimal(BASE_PRICE);
//     let currentTime = new Date(startDate.getTime());
    
//     // Process each rate period
//     for (let i = 0; i < sortedRates.length; i++) {
//         const currentRate = sortedRates[i];
        
//         // Determine the end of this rate period
//         const rateEndTime = i < sortedRates.length - 1 ?
//             new Date(sortedRates[i + 1].effectiveDate.getTime()) : // Next rate start time
//             new Date(now.getTime() + 1); // If this is the last rate, use a time after 'now'
        
//         // If this rate period is entirely in the future, skip it
//         if (currentTime.getTime() >= now.getTime()) {
//             break;
//         }
        
//         // If this rate period is entirely in the past, apply it fully
//         if (rateEndTime.getTime() <= now.getTime()) {
//             // Calculate duration in days
//             const durationDays = (rateEndTime.getTime() - currentTime.getTime()) / (24 * 60 * 60 * 1000);
//             // Apply full rate for this period
//             currentPrice = currentPrice.plus(new decimal(currentRate.dailyRise).times(durationDays));
//             // Move to the next period
//             currentTime = new Date(rateEndTime.getTime());
//         } else {
//             // This rate period includes the current time
//             // Apply rate proportionally up to now
//             const partialDurationDays = (now.getTime() - currentTime.getTime()) / (24 * 60 * 60 * 1000);
//             currentPrice = currentPrice.plus(new decimal(currentRate.dailyRise).times(partialDurationDays));
//             break; // We've reached the current time
//         }
//     }
    
//     console.log(`Calculated price: ${currentPrice} at ${now.toISOString()}`);
//     basePrice = currentPrice;
    
//     // No need for additional hourly component as we've already calculated the price
//     // including partial days in the previous step
//     const basePriceToday = basePrice;
            
//     // Generate a deterministic random fluctuation based on the minute timestamp with additional entropy
//     // This ensures we get different prices for different minutes with more variation
//     const minuteSeed = `${minuteTimestamp.getFullYear()}-${minuteTimestamp.getMonth()+1}-${minuteTimestamp.getDate()}-${minuteTimestamp.getHours()}-${minuteTimestamp.getMinutes()}-${(now.getTime() - startDate.getTime()).toString()}`;
    
//     // Add a secondary seed component based on the date components multiplied together
//     const secondarySeed = (minuteTimestamp.getDate() * (minuteTimestamp.getMonth()+1) * minuteTimestamp.getMinutes() * (minuteTimestamp.getHours()+1)).toString();
    
//     // Combine both seeds for more entropy
//     const combinedSeed = hashCode(minuteSeed + secondarySeed) * hashCode(secondarySeed);
    
//     // Use multiple normalization steps for better distribution
//     const pseudoRandom = new decimal(Math.abs(combinedSeed % 10000007)).dividedBy(10000007).abs(); // Normalize to 0-1 with prime modulo
//     const fluctuation = pseudoRandom.times(2).minus(1).times(FLUCTUATION_RANGE); // Convert to -FLUCTUATION_RANGE to +FLUCTUATION_RANGE
    
//     // Apply the fluctuation to today's base price
//     const finalPrice = basePriceToday.times(new decimal(1).plus(fluctuation));
    
//     // Round to 6 decimal places for consistency
//     const roundedPrice = finalPrice.toDecimalPlaces(6);

//     console.log(`Calculating new token price for ${minuteTimestamp.toISOString()}, price: ${roundedPrice}, fluctuation:${fluctuation}, hourly range:${FLUCTUATION_RANGE.toFixed(6)}`);

    
//     // Only store in cache if the timestamp is larger than the one already in cache
//     // or if there's no cache yet
//     if (!tokenPriceCache || minuteTimestamp.getTime() > tokenPriceCache.timestamp.getTime()) {
//         tokenPriceCache = {
//             timestamp: minuteTimestamp,
//             price: roundedPrice
//         };
//     }
    
//     return roundedPrice;
// }

// /**
//  * Simple string hash function to generate deterministic random numbers
//  */
// function hashCode(str: string): number {
//     let hash = 0;
//     for (let i = 0; i < str.length; i++) {
//         const char = str.charCodeAt(i);
//         hash = ((hash << 5) - hash) + char;
//         hash = hash & hash; // Convert to 32bit integer
//     }
//     return hash;
// }

// /**
//  * Updates a candle for a specific interval using the current token price
//  * @param interval The time interval for the candle
//  * @param timestamp The current timestamp
//  * @param currentPrice The current token price
//  */
// export async function updateCandleWithCurrentPrice(interval: TimeInterval, timestamp: Date, currentPrice: decimal): Promise<void> {
//   try {
//     // Get the interval duration in milliseconds
//     const intervalDuration = getIntervalDuration(interval);
    
//     // Align timestamp to the beginning of the interval period
//     const timestampMs = timestamp.getTime();
//     let startTime: Date;
    
//     // Special handling for daily and weekly intervals
//     if (interval === "ONE_DAY" as TimeInterval) {
//       // For daily candles, align to midnight (00:00:00)
//       startTime = new Date(timestamp);
//       startTime.setHours(0, 0, 0, 0);
//     } else if (interval === "ONE_WEEK" as TimeInterval) {
//       // For weekly candles, align to Monday midnight
//       startTime = new Date(timestamp);
//       startTime.setHours(0, 0, 0, 0);
//       // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
//       const dayOfWeek = startTime.getDay();
//       // Calculate days to subtract to get to Monday
//       // If Sunday (0), go back 6 days; if Monday (1), go back 0 days; etc.
//       const daysToSubtract = (dayOfWeek + 6) % 7;
//       startTime.setDate(startTime.getDate() - daysToSubtract);
//     } else {
//       // For other intervals (5min, 15min, 30min, 1hour), use the standard calculation
//       const intervalStartMs = Math.floor(timestampMs / intervalDuration) * intervalDuration;
//       startTime = new Date(intervalStartMs);
//     }
    
//     // Check if a candle already exists for this timestamp
//     const existingCandle = await prisma.token_price_candle.findUnique({
//       where: {
//         interval_timestamp: {
//           interval,
//           timestamp: startTime
//         }
//       }
//     });
    
//     if (existingCandle) {
//       // Update existing candle
//       // For an existing candle, we update high, low, close, and volume
//       const high = Math.max(Number(existingCandle.high_price), Number(currentPrice));
//       const low = Math.min(Number(existingCandle.low_price), Number(currentPrice));
      
//       await prisma.token_price_candle.update({
//         where: {
//           id: existingCandle.id
//         },
//         data: {
//           close_price: currentPrice.toString(),
//           high_price: high.toString(),
//           low_price: low.toString(),
//           // Increment volume slightly for realism
//           volume: (Number(existingCandle.volume) + Math.random() * 100).toString()
//         }
//       });
//     } else {
//       // Create new candle
//       // For a new candle, open, high, low, and close are all the current price
//       await prisma.token_price_candle.create({
//         data: {
//           interval,
//           timestamp: startTime,
//           open_price: currentPrice.toString(),
//           close_price: currentPrice.toString(),
//           high_price: currentPrice.toString(),
//           low_price: currentPrice.toString(),
//           volume: (Math.random() * 1000).toString() // Random initial volume
//         }
//       });
//     }
//   } catch (error) {
//     console.error(`Error updating candle for ${interval} at ${timestamp}:`, error);
//     throw error;
//   }
// }

// /**
//  * Get the timestamp of the last updated candle for a specific interval
//  * @param interval The time interval to check
//  * @returns The timestamp of the last update or null if no candles exist
//  */
// export async function getLastCandleUpdate(interval: TimeInterval): Promise<Date | null> {
//   try {
//     // Find the most recent candle for this interval
//     const latestCandle = await prisma.token_price_candle.findFirst({
//       where: {
//         interval
//       },
//       orderBy: {
//         updated_at: 'desc'
//       }
//     });
    
//     return latestCandle ? latestCandle.updated_at : null;
//   } catch (error) {
//     console.error(`Error getting last candle update for ${interval}:`, error);
//     return null;
//   }
// }

// /**
//  * Get the duration of a time interval in milliseconds
//  * @param interval The time interval
//  */
// function getIntervalDuration(interval: TimeInterval): number {
//   switch (interval) {
//     case "FIVE_MIN":
//       return 5 * 60 * 1000;
//     case "FIFTEEN_MIN":
//       return 15 * 60 * 1000;
//     case "THIRTY_MIN":
//       return 30 * 60 * 1000;
//     case "ONE_HOUR":
//       return 60 * 60 * 1000;
//     case "ONE_DAY":
//       return 24 * 60 * 60 * 1000;
//     case "ONE_WEEK":
//       return 7 * 24 * 60 * 60 * 1000;
//     default:
//       throw new Error(`Invalid interval: ${interval}`);
//   }
// }