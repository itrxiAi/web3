// import { DB_BATCH } from "@/constants";
// import { calculateDynamicReward, calculateStaticReward, processBalanceUpdate } from "@/lib/balance";
// import { getDividendRewardGalaxyRatio, getDividendRewardNodeRatio, getStakeCommunityDynamicRewardCapIncrement, getStakeGroupDynamicRewardCapIncrement } from "@/lib/config";
// import prisma from "@/lib/prisma";
// import { getDynamicIndex, getFeeDividend, getRewardCap, getStaticIndex, setDynamicIndex, setFeeDividend, setRewardCap, setStaticIndex } from "@/lib/taskCache";
// import { getTokenPrice } from "@/lib/tokenPriceCandle";
// import { getMaxPathDepth, getUsersAtDepth, getUsersByTypes } from "@/lib/user";
// import { truncate } from "@/utils/common";
// import { getDate, getUTCTodayStart, getUTCTomorrowStart, getUTCYesterdayStart } from "@/utils/dateUtils";
// import { TokenType, TxFlowStatus, TxFlowType, UserType } from "@prisma/client";
// import { Decimal } from "@prisma/client/runtime/library";

// /**
//  * Update dynamic rewards for all users at a specific level in the materialized path
//  * @param level The level in the materialized path
//  * @param batchSize Number of users to process in each batch
//  */
// export async function updateSuperiorDynamicRewardByDepth(utcYear: number, utcMonth: number, utcDay: number, depth: number, userId: number = 0, batchSize: number = DB_BATCH) {
//     let processedCount = 0;
//     let skip = 0;
//     const tokenPrice = await getTokenPrice()

//     while (true) {
//         // Get batch of users at the specified depth using getUsersAtDepth
//         const users = await getUsersAtDepth(depth, batchSize, skip, userId);

//         if (users.length === 0) {
//             break;
//         }

//         // Process each user in the batch sequentially
//         for (const user of users) {
//             const result = await calculateDynamicReward(user.id, tokenPrice, utcYear, utcMonth, utcDay);
//             if (result !== null) {
//                 processedCount++;
//             }
//             await setDynamicIndex(utcYear, utcMonth, utcDay, user.id, depth);
//         }
//         skip += batchSize;

//         if (users.length < batchSize) {
//             break;
//         }

//     }

//     return {
//         status: 'success',
//         processedCount
//     };
// }

// /**
//  * Update dynamic rewards for all users across all depths, processing level by level
//  * @param utcYear The UTC year
//  * @param utcMonth The UTC month (1-12)
//  * @param utcDay The UTC day (1-31)
//  * @param batchSize Number of users to process in each batch
//  */
// export async function updateDynamicRewards(utcYear: number, utcMonth: number, utcDay: number, batchSize: number = DB_BATCH) {
//     const startTime = performance.now();

//     console.log('[SuperiorReward] Starting batch update of all superior dynamic rewards');

//     // Get the maximum depth in the hierarchy using getMaxPathDepth
//     let maxDepth = await getMaxPathDepth();
//     let userId = 0;
//     console.log(`[SuperiorReward] Max hierarchy depth: ${maxDepth}`);
//     // Query from schedule_process
//     const index = await getDynamicIndex(utcYear, utcMonth, utcDay);
//     if (index) {
//         maxDepth = Number(index.depth);
//         userId = Number(index.index);
//     }

//     // Process each depth level, from deepest to shallowest
//     for (let depth = maxDepth; depth >= 0; depth--) {
//         if (depth !== maxDepth) {
//             userId = 0;
//         }
//         const result = await updateSuperiorDynamicRewardByDepth(utcYear, utcMonth, utcDay, depth, userId, batchSize);
//         console.log(`[SuperiorReward] Completed depth ${depth}, processed: ${result.processedCount} users`);
//     }

//     const endTime = performance.now();
//     const totalSeconds = (endTime - startTime) / 1000;
//     console.log(`[SuperiorReward] Completed in ${totalSeconds.toFixed(2)} seconds`);

//     return {
//         status: 'success',
//         message: 'Batch superior dynamic reward update completed'
//     };
// }

// /**
//  * Handle static reward by updating tx_flow status and processing balance update
//  */
// export async function handleStaticDynamicRewardBatch() {
//     let processedCount = 0;

//     while (true) {

//         const txFlows = await prisma.tx_flow.findMany({
//             where: {
//                 type: {
//                     in: [TxFlowType.STAKE_STATIC_REWARD, TxFlowType.STAKE_STATIC_DIRECT_REWARD, TxFlowType.STAKE_DYNAMIC_REWARD, TxFlowType.STAKE_DYNAMIC_NODE_REWARD, TxFlowType.STAKE_DYNAMIC_INCUBATION_REWARD, TxFlowType.STAKE_DYNAMIC_NODE_INCUBATION_REWARD]
//                 },
//                 status: TxFlowStatus.PENDING,
//                 executed_at: {
//                     gte: getUTCTodayStart(),
//                     lt: getUTCTomorrowStart()
//                 }
//             },
//             take: DB_BATCH
//         });
//         if (txFlows.length === 0) {
//             return null;
//         }

//         // Process balance updates
//         txFlows.forEach(async txFlow => {
//             await prisma.$transaction(async (prisma) => {

//                 await processBalanceUpdate({
//                     address: txFlow.user_address,
//                     amount: txFlow.amount,
//                     tokenType: txFlow.token_type,
//                     type: txFlow.type
//                 }, prisma)

//                 // Update statuses
//                 await prisma.tx_flow.updateMany({
//                     where: { id: { in: txFlows.map(txFlow => txFlow.id) } },
//                     data: {
//                         status: TxFlowStatus.CONFIRMED,
//                     }
//                 });
//             });
//         });

//         if (!txFlows) break;
//         processedCount += txFlows.length;
//     }

//     return processedCount;
// }

// /**
//  * Calculate static rewards for all users in batches
//  * @param utcYear The UTC year
//  * @param utcMonth The UTC month (1-12)
//  * @param utcDay The UTC day (1-31)
//  * @param batchSize Number of users to process in each batch
//  */
// export async function calculateAllStaticRewards(utcYear: number, utcMonth: number, utcDay: number, batchSize: number = DB_BATCH) {
//     const startTime = performance.now();
//     console.log('[StaticReward] Starting batch calculation of static rewards');
//     let processedCount = 0;

//     const index = await getStaticIndex(utcYear, utcMonth, utcDay);
//     const tokenPrice = await getTokenPrice()

//     let lastUserId = 0;
//     if (index) {
//         lastUserId = index;
//     }

//     while (true) {
//         // Get batch of users with staked points
//         const users = await prisma.user_balance.findMany({
//             where: {
//                 AND: [
//                     { token_staked_points: { gt: 0 } },
//                     { stake_reward_cap: { gt: 0 } }
//                 ],
//                 user: {
//                     id: { gt: lastUserId }
//                 }
//             },
//             select: {
//                 address: true,
//                 token_staked_points: true,
//                 token_points: true,
//                 user: {
//                     select: {
//                         id: true
//                     }
//                 }
//             },
//             take: batchSize,
//             orderBy: {
//                 user: {
//                     id: 'asc'
//                 }
//             }
//         });

//         if (users.length !== 0) {
//             for (const user of users) {
//                 await calculateStaticReward(user.address, user.token_staked_points, tokenPrice, utcYear, utcMonth, utcDay);
//                 await setStaticIndex(utcYear, utcMonth, utcDay, user.user.id);
//             }
//             lastUserId = users[users.length - 1].user.id;
//         }

//         if (users.length < batchSize) {
//             break;
//         }
//     }

//     const endTime = performance.now();
//     console.log(`[StaticReward] Total time taken: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
//     return {
//         status: 'success',
//         processedCount,
//         message: 'Batch static reward calculation completed'
//     };
// }

// /**
//  * Handle airdrop reward batch
//  */
// // export async function handleAirdropRewardBatch(utcYear?: number, utcMonth?: number, utcDay?: number) {

// //     const executedAt = new Date();
// //     const year = utcYear ?? executedAt.getUTCFullYear();
// //     const month = utcMonth ?? executedAt.getUTCMonth() + 1;
// //     const day = utcDay ?? executedAt.getUTCDate();
// //     const started = await getAirdropStarted();
// //     if (!started) {
// //         console.log('Airdrop not started');
// //         return;
// //     }

// //     // Query all GROUP or COMMUNITY user
// //     const users = await prisma.user_info.findMany({
// //         where: {
// //             type: {
// //                 in: [UserType.GROUP, UserType.COMMUNITY]
// //             }
// //         }
// //     });

// //     // Query the count of airdrop tx_flow for each user
// //     const txFlows = await prisma.tx_flow.groupBy({
// //         by: ['user_address'],
// //         where: {
// //             type: TxFlowType.AIRDROP,
// //             user_address: {
// //                 in: users.map(user => user.address)
// //             }
// //         },
// //         _count: true
// //     });

// //     // Create a map of user addresses to their airdrop counts
// //     const txFlowMap = new Map(txFlows.map(flow => [flow.user_address, flow._count]));
// //     const times = await getAirdropTimes();

// //     // Filter out users who have less than 6 airdrop tx_flow
// //     const filteredUsers = users.filter(user => {
// //         const count = txFlowMap.get(user.address) || 0; // Treat undefined as 0
// //         return count < times;
// //     });

// //     console.log('Filtered users:', filteredUsers.length);
// //     const timestamp = new Date(Date.UTC(year, month - 1, day));


// //     // For each user, create airdrop tx_flow
// //     for (const user of filteredUsers) {
// //         if (!user.type) continue;
// //         await prisma.tx_flow.create({
// //             data: {
// //                 user_address: user.address,
// //                 amount: await getAirdropReward(user.type),
// //                 type: TxFlowType.AIRDROP,
// //                 token_type: TokenType.Token,
// //                 status: TxFlowStatus.PENDING,
// //                 executed_at: timestamp
// //             }
// //         });
// //     }

// // }

// async function getFees(year: number, month: number, day: number) {
//     const endDate = getDate(year, month, day);
//     const startDate = new Date(endDate.getTime());
//     startDate.setUTCDate(startDate.getUTCDate() - 1);

//     console.log(`[DividendReward] Getting fees for ${year}-${month}-${day}, start: ${startDate}, end: ${endDate}`);
    
//     // Query all OUT transactions and sum up the amount_fee and tx_fee, grouped by token type
//     const results = await prisma.transaction.groupBy({
//         by: ['token_type'],
//         where: {
//             type: TxFlowType.OUT,
//             status: TxFlowStatus.CONFIRMED,
//             created_at: {
//                 gte: startDate,
//                 lt: endDate
//             }
//         },
//         _sum: {
//             amount_fee: true,
//             tx_fee: true
//         }
//     });

//     // Initialize fee variables with default values of 0
//     let usdtAmountFee = new Decimal(0);
//     let tokenAmountFee = new Decimal(0);

//     // Process results for each token type
//     for (const result of results) {
//         const tokenType = result.token_type;
//         const amountFee = result._sum.amount_fee || new Decimal(0);

//         // Assign values based on token type
//         if (tokenType === TokenType.USDT) {
//             usdtAmountFee = amountFee;
//         } else if (tokenType === TokenType.TXT) {
//             tokenAmountFee = amountFee;
//         }
//     }

//     // Return the specific fee values
//     return {
//         usdtAmountFee,
//         tokenAmountFee
//     };
// }

// export async function handleDynamicRewardCap(year: number, month: number, day: number) {
//     console.log('[DynamicRewardCap] Starting dynamic reward cap batch processing');
//     const startTime = performance.now();
//     const rewardCap = await getRewardCap(year, month, day);
//     if (rewardCap) {
//         console.log(`[DividendReward] Reward cap already exists for ${year}-${month}-${day}`);
//         return;
//     }
//     await setRewardCap(year, month, day, 0);

//     // Get all users who are in group or community type
//     const targetUsers = await getUsersByTypes([UserType.GROUP, UserType.COMMUNITY]);
//     console.log(`[DynamicRewardCap] Found ${targetUsers.length} users in group or community type`);

//     // Get increment values from config
//     const groupIncrement = await getStakeGroupDynamicRewardCapIncrement();
//     const communityIncrement = await getStakeCommunityDynamicRewardCapIncrement();

//     // Update dynamic reward cap for each user based on their type
//     let updatedCount = 0;
//     for (const user of targetUsers) {
//         try {
//             // Determine increment amount based on user type
//             const incrementAmount = user.type === UserType.GROUP
//                 ? groupIncrement.toNumber()
//                 : communityIncrement.toNumber();

//             // Update user's dynamic reward cap
//             await prisma.user_balance.update({
//                 where: { address: user.address },
//                 data: {
//                     stake_dynamic_reward_cap: {
//                         increment: incrementAmount
//                     }
//                 }
//             });
//             updatedCount++;
//         } catch (error) {
//             console.error(`[DynamicRewardCap] Error updating cap for user ${user.address}:`, error);
//         }
//     }

//     const endTime = performance.now();
//     console.log(`[DynamicRewardCap] Updated dynamic reward cap for ${updatedCount} users in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

//     return {
//         status: 'success',
//         updatedCount,
//         message: `Updated dynamic reward cap for ${updatedCount} users in group or community type`
//     };
// }

// /**
//  * Handle dividend reward batch
//  * This function queries all OUT transactions and sums up the amount_fee and tx_fee
//  * to calculate the total dividend amount available for distribution
//  */
// export async function handleDividendRewardBatch(year: number, month: number, day: number) {
//     console.log('[DividendReward] Starting dividend reward batch processing');
//     // const executedAt = new Date();
//     // const year = executedAt.getUTCFullYear();
//     // const month = executedAt.getUTCMonth() + 1;
//     // const day = executedAt.getUTCDate();
//     const feeDividend = await getFeeDividend(year, month, day);
//     if (feeDividend) {
//         console.log(`[DividendReward] Fee dividend already exists for ${year}-${month}-${day}`);
//         return;
//     }
//     await setFeeDividend(year, month, day, 0);

//     // Get fee data using the getFees function
//     const { usdtAmountFee, tokenAmountFee } = await getFees(year, month, day);

//     // const systemInitRatio = await getDividendRewardSystemInitRatio();
//     // const communityInitRatio = await getDividendRewardCommunityInitRatio();
//     const nodeRatio = await getDividendRewardNodeRatio();
//     const galaxyRatio = await getDividendRewardGalaxyRatio();


//     const usdtNodeRewardTotal = usdtAmountFee.mul(nodeRatio);
//     const usdtGalaxyRewardTotal = usdtAmountFee.mul(galaxyRatio);
//     const tokenNodeRewardTotal = tokenAmountFee.mul(nodeRatio);
//     const tokenGalaxyRewardTotal = tokenAmountFee.mul(galaxyRatio);
//     // const systemInitRewardTotal = usdtRewardTotal.mul(systemInitRatio);
//     // const communityInitRewardTotal = usdtRewardTotal.mul(communityInitRatio);

//     const groupUsers = await getUsersByTypes([UserType.GROUP]);
//     const communityUsers = await getUsersByTypes([UserType.COMMUNITY]);
//     const galaxyUsers = (await getUsersByTypes([UserType.GALAXY])).filter(user => user.interest_active);

//     // const communityUsers = await getUsersByTypes([UserType.COMMUNITY_INIT]);
//     // const systemUsers = await getUsersByTypes([UserType.SYSTEM_INIT]);

//     const usdtGroupReward = truncate(usdtNodeRewardTotal.div(groupUsers.length));
//     const usdtCommunityReward = truncate(usdtNodeRewardTotal.div(communityUsers.length));
//     const usdtGalaxyReward = truncate(usdtGalaxyRewardTotal.div(galaxyUsers.length));
//     const tokenGroupReward = truncate(tokenNodeRewardTotal.div(groupUsers.length));
//     const tokenCommunityReward = truncate(tokenNodeRewardTotal.div(communityUsers.length));
//     const tokenGalaxyReward = truncate(tokenGalaxyRewardTotal.div(galaxyUsers.length));
//     // const systemInitReward = systemInitRewardTotal.div(systemUsers.length);
//     // const communityInitReward = communityInitRewardTotal.div(communityUsers.length);

//     if (usdtGroupReward.gt(new Decimal(0))) {
//         for (const user of groupUsers) {
//             await prisma.$transaction(async (prisma) => {
//                 await prisma.tx_flow.create({
//                     data: {
//                         user_address: user.address,
//                         amount: usdtGroupReward,
//                         type: TxFlowType.FEE_DIVIDEND,
//                         token_type: TokenType.USDT,
//                         status: TxFlowStatus.PENDING,
//                         executed_at: new Date()
//                     }
//                 });
//                 //await processBalanceUpdate({ amount: groupReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//             });
//         }
//     }
//     if (tokenGroupReward.gt(new Decimal(0))) {
//         for (const user of groupUsers) {
//             await prisma.$transaction(async (prisma) => {
//                 await prisma.tx_flow.create({
//                     data: {
//                         user_address: user.address,
//                         amount: tokenGroupReward,
//                         type: TxFlowType.FEE_DIVIDEND_TOKEN,
//                         token_type: TokenType.TXT,
//                         status: TxFlowStatus.PENDING,
//                         executed_at: new Date()
//                     }
//                 });
//                 //await processBalanceUpdate({ amount: groupReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//             });
//         }
//     }
//     if (usdtCommunityReward.gt(new Decimal(0))) {
//         for (const user of communityUsers) {
//             await prisma.$transaction(async (prisma) => {
//                 await prisma.tx_flow.create({
//                     data: {
//                         user_address: user.address,
//                         amount: usdtCommunityReward,
//                         type: TxFlowType.FEE_DIVIDEND,
//                         token_type: TokenType.USDT,
//                         status: TxFlowStatus.PENDING,
//                         executed_at: new Date()
//                     }
//                 });
//                 //await processBalanceUpdate({ amount: communityReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//             });
//         }
//     }
//     if (tokenCommunityReward.gt(new Decimal(0))) {
//         for (const user of communityUsers) {
//             await prisma.$transaction(async (prisma) => {
//                 await prisma.tx_flow.create({
//                     data: {
//                         user_address: user.address,
//                         amount: tokenCommunityReward,
//                         type: TxFlowType.FEE_DIVIDEND_TOKEN,
//                         token_type: TokenType.TXT,
//                         status: TxFlowStatus.PENDING,
//                         executed_at: new Date()
//                     }
//                 });
//                 //await processBalanceUpdate({ amount: communityReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//             });
//         }
//     }
//     if (usdtGalaxyReward.gt(new Decimal(0))) {
//         for (const user of galaxyUsers) {
//             await prisma.$transaction(async (prisma) => {
//                 await prisma.tx_flow.create({
//                     data: {
//                         user_address: user.address,
//                         amount: usdtGalaxyReward,
//                         type: TxFlowType.FEE_DIVIDEND,
//                         token_type: TokenType.USDT,
//                         status: TxFlowStatus.PENDING,
//                         executed_at: new Date()
//                     }
//                 });
//                 //await processBalanceUpdate({ amount: communityReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//             });
//         }
//     }
//     if (tokenGalaxyReward.gt(new Decimal(0))) {
//         for (const user of galaxyUsers) {
//             await prisma.$transaction(async (prisma) => {
//                 await prisma.tx_flow.create({
//                     data: {
//                         user_address: user.address,
//                         amount: tokenGalaxyReward,
//                         type: TxFlowType.FEE_DIVIDEND_TOKEN,
//                         token_type: TokenType.TXT,
//                         status: TxFlowStatus.PENDING,
//                         executed_at: new Date()
//                     }
//                 });
//                 //await processBalanceUpdate({ amount: communityReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//             });
//         }
//     }
//     // for (const user of systemUsers) {
//     //     await prisma.$transaction(async (prisma) => {
//     //         await prisma.tx_flow.create({
//     //             data: {
//     //                 user_address: user.address,
//     //                 amount: systemInitReward,
//     //                 type: TxFlowType.FEE_DIVIDEND,
//     //                 token_type: TokenType.USDT,
//     //             status: TxFlowStatus.CONFIRMED,
//     //             executed_at: new Date()
//     //         }
//     //     });
//     //     await processBalanceUpdate({ amount: systemInitReward, type: TxFlowType.FEE_DIVIDEND, address: user.address, tokenType: TokenType.USDT }, prisma);
//     //     });
//     // }


// }

// /**
//  * Clean performance history data that is older than 7 days
//  * This function deletes records from the performance_history table
//  * based on the year, month, and day fields
//  */
// export async function cleanPerformanceHistory() {
//     console.log('[PerformanceHistory] Starting cleanup of old performance history data');
//     const startTime = performance.now();

//     // Calculate the date 7 days ago
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     // Extract year, month, day from the date 7 days ago
//     const cutoffYear = sevenDaysAgo.getUTCFullYear();
//     const cutoffMonth = sevenDaysAgo.getUTCMonth() + 1; // getUTCMonth() returns 0-11
//     const cutoffDay = sevenDaysAgo.getUTCDate();

//     console.log(`[PerformanceHistory] Deleting records before ${cutoffYear}-${cutoffMonth}-${cutoffDay}`);

//     // Delete records older than the cutoff date
//     // We need to handle the comparison properly across year/month boundaries
//     const result = await prisma.performance_history.deleteMany({
//         where: {
//             OR: [
//                 { year: { lt: cutoffYear } },
//                 {
//                     year: cutoffYear,
//                     month: { lt: cutoffMonth }
//                 },
//                 {
//                     year: cutoffYear,
//                     month: cutoffMonth,
//                     day: { lt: cutoffDay }
//                 }
//             ]
//         }
//     });

//     const endTime = performance.now();
//     console.log(`[PerformanceHistory] Cleanup completed. Deleted ${result.count} records in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

//     return {
//         status: 'success',
//         deletedCount: result.count,
//         message: `Deleted ${result.count} performance history records older than 7 days`
//     };
// }
