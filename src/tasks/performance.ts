
//import { cleanUserTotalPerformance, getUserMining, getUserTotalPerformance } from "@/lib/userCache";
import Decimal from "decimal.js";
import prisma from "@/lib/prisma";
//import { getDirectSubordinates, getDirectSubordinatesWithBalance } from "@/lib/user";

/**
 * Upsert performance record for a user
 * @param userId User ID
 * @param performance Performance amount
 * @param year Year of the performance record
 * @param month Month of the performance record
 * @param day Day of the performance record
 */
// export async function upsertPerformance(address: string, performance: Decimal, subordinatesNum: number, year: number, month: number, day: number) {
//     const mining = await getUserMining(address)

//     await prisma.performance_history.upsert({
//         where: {
//             address_year_month_day: {
//                 address,
//                 year,
//                 month,
//                 day
//             }
//         },
//         update: {
//             performance: performance.toNumber(),
//             subordinates_num: subordinatesNum
//         },
//         create: {
//             address: address,
//             performance: performance,
//             token_staked_points: mining,
//             subordinates_num: subordinatesNum,
//             year,
//             month,
//             day
//         }
//     });
// }

/**
 * Rerank all users in bottom-up order, processing in batches
 */
// export async function performanceSnapshot(address: string, year: number, month: number, day: number) {
//     // Check if the performance record exists
//     const existingRecord = await prisma.performance_history.findUnique({
//         where: {
//             address_year_month_day: {
//                 address,
//                 year,
//                 month,
//                 day
//             }
//         }
//     });

//     if (existingRecord) {
//         return
//     }

//     // Calculate the total performance
//     const performance = await getUserTotalPerformance(address);
//     const subordinatesNum = await getDirectSubordinatesWithBalance(address);
//     await upsertPerformance(address, performance, subordinatesNum.length, year, month, day);

// }