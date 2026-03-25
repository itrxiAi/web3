import { DB_BATCH } from "@/constants";
//import { getMaxPathDepth, getUsersAtDepth } from "@/lib/user";
//import { cleanUserLevel, cleanUserMining, cleanUserTotalPerformance, getUserLevel } from "@/lib/userCache";
//import { performanceSnapshot, upsertPerformance } from "./performance";

/**
 * Re-rank a single user
 * @param address User's wallet address
 */
export async function reRankUser(address: string) {
  //await cleanUserLevel(address)
  //await getUserLevel(address)
}

/**
 * Rerank all users at a specific depth level
 */
// export async function reRankUsersAtDepth(year: number, month: number, day: number, depth: number, batchSize: number = DB_BATCH): Promise<{
//   status: string,
//   processedCount: number
// }> {
//   let processedCount = 0;
//   let skip = 0;

//   while (true) {
//     // Get batch of users at current depth
//     const userBatch = await getUsersAtDepth(depth, batchSize, skip);
//     if (userBatch.length === 0) break;

//     // Process each user in the batch
//     for (const user of userBatch) {
//       await cleanUserTotalPerformance(user.address)
//       await cleanUserMining(user.address)
//       await reRankUser(user.address)
//       await performanceSnapshot(user.address, year, month, day)
//       processedCount++;
//       /* if (user.previousLevel !== user.newLevel) {
//         processedCount++;
//         //console.log(`[ReRank] Updated level ${user.address} from ${user.previousLevel} to ${user.newLevel}`);
//       } */
//     }

//     skip += batchSize;
//   }
//   console.log(`[ReRank] Completed depth ${depth}, processed: ${processedCount} users`);

//   return {
//     status: 'success',
//     processedCount
//   };
// }


/**
 * Rerank all users in bottom-up order, processing in batches
 */
// export async function reRankAllUsers(year: number, month: number, day: number, batchSize: number = DB_BATCH) {
//   const startTime = performance.now();
//   console.log('[ReRank] Starting batch rerank of all users');

//   // Get the maximum depth in the hierarchy
//   const maxDepth = await getMaxPathDepth();
//   console.log(`[ReRank] Max hierarchy depth: ${maxDepth}`);

//   // Process each depth level, from deepest to shallowest
//   for (let depth = maxDepth; depth >= 0; depth--) {
//     await reRankUsersAtDepth(year, month, day, depth, batchSize);
//   }
//   const totalSeconds = (performance.now() - startTime) / 1000;

//   console.log(`[ReRank] Completed batch rerank in ${totalSeconds.toFixed(2)} seconds`);
//   return {
//     status: 'success',
//     message: 'Batch rerank completed'
//   };
// }

