// import { Prisma, TxFlowType, TokenType, TxFlowStatus, UserType, Transaction as Transaction } from '@prisma/client';
// import prisma from './prisma';
// //import { getDirectSubordinates, getDirectSubordinatesWithBalance, isActive, cleanUserMiningLevelPerformanceCache, getSubordinatesWithBalanceDepth, SubordinateInfo } from './user';
// import { outTransferTokens } from '../utils/chain';
// import * as crypto from 'crypto';
// import * as bs58 from 'bs58';
// import { DB_BATCH, DEV_ENV } from '@/constants';
// import { getUTCTodayEnd, getUTCTodayStart } from '@/utils/dateUtils';
// import decimal from 'decimal.js';
// import { getLevelRewardRatio, getStakeRewardRate, getHotWalletAddress, getEnvironment, getAssembleTargetAddress, getStakeDirectRewardRate, getEqualRewardRate, getWithdrawTokenFeeRatio, getDirectRewardDepthDiff, getRewardBurningThreshold, getMiningCapExpansionByLevel } from './config';
// import { ErrorCode } from './errors';
// /*  */import { getCurrentPrice } from '@/utils/lbank';
// import { truncateNumber } from '@/utils/common';
// import { getPerformanceHistory } from './performanceHistory';
// import { getUserDepth, getUserMining, getUserPath } from './userCache';
// import { getTokenPrice } from './tokenPriceCandle';

// type BalanceUpdateParams = {
//   address: string;
//   toAddress?: string;
//   amount: decimal;
//   type: TxFlowType;
//   tokenType: TokenType;
//   txHash?: string;
//   redeemAt?: Date;
//   level?: number;
// };

// type TxFlowCreateParams = {
//   address: string;
//   toAddress?: string;
//   amount: decimal;
//   type: TxFlowType;
//   tokenType: TokenType;
//   txHash?: string | null;
//   description?: string | null;
//   status?: TxFlowStatus;
//   executedAt?: Date;
// };

// /**
//  * Result of processRewardCap operation
//  */
// type ProcessRewardCapResult = {
//   success: boolean;
//   actualAmount: decimal;
//   message: string | null;
// };

// /**
//  * processRewardCap
//  * @param address User's wallet address
//  * @param amount Amount to subtract from reward cap
//  * @param tx Prisma transaction client
//  * @returns Result of the reward cap update operation
//  */
// // export async function processDynamicRewardCapBatch(address: string, dynamicR: decimal, incubationR: decimal, tokenPrice: decimal, year: number, month: number, day: number) {
// //   const executedAt = new Date(Date.UTC(year, month - 1, day));

// //   let needClean = false;
// //   const currentBalance = await prisma.user_balance.findUnique({
// //     where: { address }
// //   });

// //   // Validate that token_reward_cap is greater than the amount to be subtracted
// //   if (!currentBalance) {
// //     return {
// //       success: false
// //     };
// //   }
// //   await prisma.$transaction(async (tx) => {

// //     let totalRewardCap = new decimal(currentBalance.stake_reward_cap);
// //     //let currentDynamicRewardCap = new decimal(currentBalance.stake_dynamic_reward_cap);
// //     let insufficientRewardCap = false;
// //     //console.log(`processDynamicRewardCapBatch address:${address}, cap:${currentRewardCap}, nodeCap:${currentNodeRewardCap}, dynamicR:${dynamicR}, incubationR:${incubationR}, dynamicNodeR:${dynamicNodeR}, incubationNodeR:${incubationNodeR}`)

// //     if (totalRewardCap.lte(new decimal(0))) {
// //       return {
// //         success: false,
// //         actualAmount: new decimal(0),
// //         message: ErrorCode.INSUFFICIENT_REWARD_CAP
// //       };
// //     }

// //     let actualAmount = dynamicR

// //     if (totalRewardCap.gt(new decimal(0)) && actualAmount.gt(new decimal(0))) {
// //       if (totalRewardCap.lt(actualAmount)) {
// //         actualAmount = totalRewardCap
// //         insufficientRewardCap = true;
// //       }
// //       await tx.performance_history.update({
// //         where: {
// //           address_year_month_day: {
// //             address,
// //             year: executedAt.getUTCFullYear(),
// //             month: executedAt.getUTCMonth() + 1,
// //             day: executedAt.getUTCDate()
// //           }
// //         },
// //         data: {
// //           token_dynamic_reward: {
// //             increment: actualAmount
// //           }
// //         }
// //       })
// //       await tx.tx_flow.create({
// //         data: {
// //           type: TxFlowType.STAKE_DYNAMIC_REWARD,
// //           token_type: TokenType.TXT,
// //           tx_hash: null,
// //           status: TxFlowStatus.PENDING,
// //           user_address: address,
// //           description: JSON.stringify({
// //             usdtAmount: actualAmount
// //           }),
// //           amount: actualAmount.div(tokenPrice),
// //           executed_at: executedAt
// //         }
// //       });
// //       totalRewardCap = totalRewardCap.sub(actualAmount);
// //       // Subtract from currentDynamicRewardCap first, then from currentRewardCap if needed
// //       // if (currentDynamicRewardCap.gte(actualAmount)) {
// //       //   // If there's enough in dynamic reward cap, subtract only from there
// //       //   currentDynamicRewardCap = currentDynamicRewardCap.sub(actualAmount);
// //       // } else {
// //       //   // If dynamic reward cap is not enough, use all of it and subtract the rest from currentRewardCap
// //       //   const remainingAmount = actualAmount.sub(currentDynamicRewardCap);
// //       //   currentRewardCap = currentRewardCap.sub(remainingAmount);
// //       //   currentDynamicRewardCap = new decimal(0);
// //       // }
// //       // totalRewardCap = currentRewardCap.add(currentDynamicRewardCap);
// //     }

// //     actualAmount = incubationR

// //     if (totalRewardCap.gt(new decimal(0)) && actualAmount.gt(new decimal(0))) {
// //       if (totalRewardCap.lt(actualAmount)) {
// //         actualAmount = totalRewardCap
// //         insufficientRewardCap = true;
// //       }
// //       await tx.tx_flow.create({
// //         data: {
// //           type: TxFlowType.STAKE_DYNAMIC_INCUBATION_REWARD,
// //           token_type: TokenType.TXT,
// //           tx_hash: null,
// //           status: TxFlowStatus.PENDING,
// //           user_address: address,
// //           description: JSON.stringify({
// //             usdtAmount: actualAmount
// //           }),
// //           amount: actualAmount.div(tokenPrice),
// //           executed_at: executedAt
// //         }
// //       });
// //       totalRewardCap = totalRewardCap.sub(actualAmount);
// //       //currentRewardCap = currentRewardCap.sub(actualAmount)
// //       // Subtract from currentDynamicRewardCap first, then from currentRewardCap if needed
// //       // if (currentDynamicRewardCap.gte(actualAmount)) {
// //       //   // If there's enough in dynamic reward cap, subtract only from there
// //       //   currentDynamicRewardCap = currentDynamicRewardCap.sub(actualAmount);
// //       // } else {
// //       //   // If dynamic reward cap is not enough, use all of it and subtract the rest from currentRewardCap
// //       //   const remainingAmount = actualAmount.sub(currentDynamicRewardCap);
// //       //   currentRewardCap = currentRewardCap.sub(remainingAmount);
// //       //   currentDynamicRewardCap = new decimal(0);
// //       // }
// //       // totalRewardCap = currentRewardCap.add(currentDynamicRewardCap);
// //     }

// //     if (totalRewardCap.lte(new decimal(0))) {
// //       needClean = true;
// //     }

// //     // actualAmount = dynamicNodeR

// //     // if (currentNodeRewardCap.gt(new decimal(0)) && actualAmount.gt(new decimal(0))) {
// //     //   if (currentNodeRewardCap.lt(actualAmount)) {
// //     //     actualAmount = currentNodeRewardCap
// //     //     insufficientRewardCap = true;
// //     //   }
// //     //   await tx.tx_flow.create({
// //     //     data: {
// //     //       type: TxFlowType.STAKE_DYNAMIC_NODE_REWARD,
// //     //       token_type: TokenType.TXT,
// //     //       tx_hash: null,
// //     //       status: TxFlowStatus.PENDING,
// //     //       user_address: address,
// //     //       amount: actualAmount,
// //     //       executed_at: executedAt
// //     //     }
// //     //   });
// //     //   currentNodeRewardCap = currentNodeRewardCap.sub(actualAmount)
// //     // }

// //     // actualAmount = incubationNodeR

// //     // if (currentNodeRewardCap.gt(new decimal(0)) && actualAmount.gt(new decimal(0))) {
// //     //   if (currentNodeRewardCap.lt(actualAmount)) {
// //     //     actualAmount = currentNodeRewardCap
// //     //     insufficientRewardCap = true;
// //     //   }
// //     //   await tx.tx_flow.create({
// //     //     data: {
// //     //       type: TxFlowType.STAKE_DYNAMIC_NODE_INCUBATION_REWARD,
// //     //       token_type: TokenType.TXT,
// //     //       tx_hash: null,
// //     //       status: TxFlowStatus.PENDING,
// //     //       user_address: address,
// //     //       amount: actualAmount,
// //     //       executed_at: executedAt
// //     //     }
// //     //   });
// //     //   currentNodeRewardCap = currentNodeRewardCap.sub(actualAmount)
// //     // }
// //     // if (insufficientRewardCap) {
// //     //   console.log(`processDynamicRewardCapBatch insufficientRewardCap address:${address}, cap:${currentBalance.stake_reward_cap}, nodeCap:${currentBalance.token_node_dynamic_reward_cap}, dynamicR:${dynamicR}, incubationR:${incubationR}, dynamicNodeR:${dynamicNodeR}, incubationNodeR:${incubationNodeR}`)
// //     // }

// //     // if (specialMarketingR.gt(new decimal(0))) {
// //     //   await tx.tx_flow.create({
// //     //     data: {
// //     //       type: TxFlowType.MARKET_EXPENSE,
// //     //       token_type: TokenType.TXT,
// //     //       tx_hash: null,
// //     //       status: TxFlowStatus.PENDING,
// //     //       user_address: address,
// //     //       amount: specialMarketingR,
// //     //       executed_at: executedAt
// //     //     }
// //     //   });
// //     // }

// //     // if (specialSecurityR.gt(new decimal(0))) {
// //     //   await tx.tx_flow.create({
// //     //     data: {
// //     //       type: TxFlowType.SECURITY_FUND,
// //     //       token_type: TokenType.TXT,
// //     //       tx_hash: null,
// //     //       status: TxFlowStatus.PENDING,
// //     //       user_address: address,
// //     //       amount: specialSecurityR,
// //     //       executed_at: executedAt
// //     //     }
// //     //   });
// //     // }


// //     // Update user_balance table by subtracting the amount from token_reward_cap
// //     await tx.user_balance.update({
// //       where: { address },
// //       data: {
// //         stake_reward_cap: totalRewardCap,
// //       }
// //     });
// //   })

// //   if (needClean) {
// //     await cleanUserMiningLevelPerformanceCache(address);
// //   }

// //   return {
// //     success: true
// //   };
// // }

// /**
//  * processRewardCap
//  * @param address User's wallet address
//  * @param amount Amount to subtract from reward cap
//  * @param tx Prisma transaction client
//  * @returns Result of the reward cap update operation
//  */
// // export async function processRewardCap(address: string, amount: decimal, tx: Prisma.TransactionClient): Promise<ProcessRewardCapResult> {
// //   const currentBalance = await tx.user_balance.findUnique({
// //     where: { address }
// //   });

// //   // Validate that token_reward_cap is greater than the amount to be subtracted
// //   if (!currentBalance) {
// //     return {
// //       success: false,
// //       actualAmount: new decimal(0),
// //       message: ErrorCode.SERVER_ERROR
// //     };
// //   }

// //   const currentRewardCap = new decimal(currentBalance.stake_reward_cap);
// //   if (currentRewardCap.eq(new decimal(0))) {
// //     return {
// //       success: false,
// //       actualAmount: new decimal(0),
// //       message: ErrorCode.INSUFFICIENT_REWARD_CAP
// //     };
// //   }

// //   let actualAmount = amount
// //   let message = null

// //   if (currentRewardCap.gt(new decimal(0)) && currentRewardCap.lt(amount)) {
// //     actualAmount = currentRewardCap
// //     message = `Partial reward, expect:${amount}, actual:${actualAmount}`
// //   }

// //   // Update user_balance table by subtracting the amount from token_reward_cap
// //   await tx.user_balance.update({
// //     where: { address },
// //     data: {
// //       stake_reward_cap: { decrement: actualAmount }
// //     }
// //   });

// //   return {
// //     success: true,
// //     actualAmount,
// //     message
// //   };
// // }

// /**
//  * processNodeRewardCap
//  * @param address User's wallet address
//  * @param amount Amount to subtract from reward cap
//  * @param tx Prisma transaction client
//  * @returns Result of the reward cap update operation
//  */
// // export async function processDynamicRewardCap(address: string, amount: decimal, tx: Prisma.TransactionClient): Promise<ProcessRewardCapResult> {
// //   const currentBalance = await tx.user_balance.findUnique({
// //     where: { address }
// //   });

// //   // Validate that token_reward_cap is greater than the amount to be subtracted
// //   if (!currentBalance) {
// //     return {
// //       success: false,
// //       actualAmount: new decimal(0),
// //       message: ErrorCode.SERVER_ERROR
// //     };
// //   }

// //   const currentRewardCap = new decimal(currentBalance.stake_dynamic_reward_cap);
// //   if (currentRewardCap.eq(new decimal(0))) {
// //     return {
// //       success: false,
// //       actualAmount: new decimal(0),
// //       message: ErrorCode.INSUFFICIENT_REWARD_CAP
// //     };
// //   }

// //   let actualAmount = amount
// //   let message = null

// //   if (currentRewardCap.gt(new decimal(0)) && currentRewardCap.lt(amount)) {
// //     actualAmount = currentRewardCap
// //     message = `Partial node reward, expect:${amount}, actual:${actualAmount}`
// //   }

// //   // Update user_balance table by subtracting the amount from token_reward_cap
// //   await tx.user_balance.update({
// //     where: { address },
// //     data: {
// //       stake_dynamic_reward_cap: { decrement: actualAmount }
// //     }
// //   });

// //   return {
// //     success: true,
// //     actualAmount,
// //     message
// //   };
// // }

// /**
//  * processRewardCapAndFlow
//  * @param address User's wallet address
//  * @param amount Amount to subtract from reward cap
//  * @param tx Prisma transaction client
//  * @returns Result of the reward cap update operation
//  */
// // export async function processRewardCapAndFlow(
// //   address: string,
// //   amount: decimal,
// //   tx: Prisma.TransactionClient,
// //   data: Omit<Prisma.tx_flowCreateInput, 'user_address' | 'amount'>
// // ): Promise<ProcessRewardCapResult> {
// //   const capResult = await processRewardCap(address, amount, tx)

// //   if (capResult.message) {
// //     console.warn(`Process reward cap: ${capResult.message} address: ${address} amount: ${amount}`)
// //   }

// //   if (capResult.success) {
// //     await tx.tx_flow.create({
// //       data: {
// //         ...data,
// //         user_address: address,
// //         amount: capResult.actualAmount
// //       }
// //     });
// //   }

// //   return capResult;
// // }

// /**
//  * processRewardCapAndUpdateFlow
//  * @param address User's wallet address
//  * @param amount Amount to subtract from reward cap
//  * @param tx Prisma transaction client
//  * @param existingTxFlowId ID of the existing tx_flow to update
//  * @param updateData Data to update in the tx_flow record
//  * @returns Result of the reward cap update operation
//  */
// // export async function processRewardCapAndUpdateFlow(
// //   address: string,
// //   amount: decimal,
// //   tx: Prisma.TransactionClient,
// //   existingTxFlowId: number,
// //   updateData: Omit<Prisma.tx_flowUpdateInput, 'id'>
// // ): Promise<ProcessRewardCapResult> {
// //   const capResult = await processRewardCap(address, amount, tx)

// //   if (capResult.message) {
// //     console.warn(`Process reward cap: ${capResult.message} address: ${address} amount: ${amount}`)
// //   }

// //   if (capResult.success) {
// //     // If amount is specified in updateData, add the new amount to it
// //     if (updateData.amount) {
// //       const existingTxFlow = await tx.tx_flow.findUnique({
// //         where: { id: existingTxFlowId },
// //         select: { amount: true }
// //       });
// //       if (existingTxFlow) {
// //         updateData.amount = new decimal(existingTxFlow.amount).add(capResult.actualAmount);
// //       }
// //     }

// //     await tx.tx_flow.update({
// //       where: { id: existingTxFlowId },
// //       data: updateData
// //     });
// //   }

// //   return capResult;
// // }

// /**
//  * Process balance update based on transaction type
//  * @param params Balance update parameters including address, amount, and transaction type
//  * @param tx Prisma transaction client
//  * @returns Array of Prisma transactions for tx_flow and balance updates
//  * @throws Error if insufficient balance for decrement operations
//  */
// // export async function processBalanceUpdate(params: BalanceUpdateParams, tx: Prisma.TransactionClient) {
// //   const { address, amount, type, tokenType } = params;

// //   // Get current balance
// //   const currentBalance = await tx.user_balance.findUnique({
// //     where: { address }
// //   });

// //   if (!currentBalance) {
// //     throw new Error('No balance record found');
// //   }

// //   // Check if we have sufficient balance for decrement operations
// //   if (type === TxFlowType.OUT || type === TxFlowType.TRANSFER) {

// //     switch (type) {
// //       case TxFlowType.OUT:
// //       case TxFlowType.TRANSFER:
// //         if (tokenType === TokenType.TXT && currentBalance.token_points.lt(amount)) {
// //           throw new Error(`Insufficient ${tokenType} points, current balance: ${currentBalance.token_points}, required: ${amount}`);
// //         }
// //         if (tokenType === TokenType.USDT && currentBalance.usdt_points.lt(amount)) {
// //           throw new Error(`Insufficient ${tokenType} points, current balance: ${currentBalance.usdt_points}, required: ${amount}`);
// //         }
// //         break;
// //     }
// //   }

// //   // Determine balance updates based on transaction type
// //   const balanceUpdate: Prisma.user_balanceUpdateInput = {};

// //   if (type === TxFlowType.TRANSFER) {
// //     if (!params.toAddress) {
// //       throw new Error('Missing toAddress for transfer');
// //     }
// //     const toBalanceUpdate: Prisma.user_balanceUpdateInput = {};
// //     if (tokenType === TokenType.TXT) {
// //       toBalanceUpdate.token_points = { increment: amount };
// //     } else {
// //       toBalanceUpdate.usdt_points = { increment: amount };
// //     }

// //     await tx.user_balance.upsert({
// //       where: { address: params.toAddress },
// //       create: {
// //         address: params.toAddress,
// //         usdt_points: tokenType === TokenType.USDT ? amount : 0,
// //         token_points: tokenType === TokenType.TXT ? amount : 0,
// //         token_locked_points: 0,
// //         token_staked_points: 0,
// //       },
// //       update: toBalanceUpdate,
// //     });
// //   }

// //   switch (type) {
// //     case TxFlowType.IN:
// //     case TxFlowType.NODE_REWARD:
// //     case TxFlowType.NODE_DIFF_REWARD:
// //     case TxFlowType.STAKE_STATIC_DIRECT_REWARD:
// //     case TxFlowType.STAKE_STATIC_REWARD:
// //     case TxFlowType.STAKE_DYNAMIC_REWARD:
// //     case TxFlowType.STAKE_DYNAMIC_NODE_REWARD:
// //     case TxFlowType.STAKE_DYNAMIC_INCUBATION_REWARD:
// //     case TxFlowType.STAKE_DYNAMIC_NODE_INCUBATION_REWARD:
// //     case TxFlowType.MARKET_EXPENSE:
// //     case TxFlowType.SECURITY_FUND:
// //     case TxFlowType.AIRDROP:
// //     case TxFlowType.FEE_DIVIDEND:
// //     case TxFlowType.FEE_DIVIDEND_TOKEN:
// //       if (tokenType === TokenType.TXT) {
// //         balanceUpdate.token_points = { increment: amount };
// //       } else {
// //         balanceUpdate.usdt_points = { increment: amount };
// //       }
// //       break;

// //     case TxFlowType.OUT:
// //     case TxFlowType.TRANSFER:
// //       if (tokenType === TokenType.TXT) {
// //         balanceUpdate.token_points = { decrement: amount };
// //       } else {
// //         balanceUpdate.usdt_points = { decrement: amount };
// //       }
// //       break;

// //     case TxFlowType.STAKE:
// //       balanceUpdate.token_staked_points = { increment: amount };
// //       balanceUpdate.stake_reward_cap = { increment: (await getMiningCapExpansionByLevel(params.level)).mul(amount) };
// //       break;

// //   }

// //   // Execute balance update
// //   return await tx.user_balance.upsert({
// //     where: { address },
// //     create: {
// //       address,
// //       usdt_points: tokenType === TokenType.USDT && type === TxFlowType.IN ? amount : 0,
// //       token_points: tokenType === TokenType.TXT && type === TxFlowType.IN ? amount : 0,
// //       token_locked_points: type === TxFlowType.LOCK ? amount : 0,
// //       token_staked_points: type === TxFlowType.STAKE ? amount : 0,
// //     },
// //     update: balanceUpdate,
// //   });
// // }

// /**
//  * Create multiple transaction flow records in a batch
//  */
// // export async function createTxFlowBatch(params: TxFlowCreateParams[], tx: Prisma.TransactionClient) {
// //   return await tx.tx_flow.createMany({
// //     data: params.map(param => ({
// //       user_address: param.address,
// //       amount: param.amount,
// //       type: param.type,
// //       token_type: param.tokenType,
// //       to_address: param.toAddress,
// //       tx_hash: param.txHash,
// //       status: param.status || TxFlowStatus.PENDING,
// //       executed_at: param.executedAt || new Date(),
// //       description: param.description
// //     }))
// //   });
// // }

// // export async function flashSwap(params: Omit<BalanceUpdateParams, 'type'>) {
// //   const { address, amount } = params;
// //   const tokenPrice = await getTokenPrice();
// //   const usdtAmount = new decimal(amount).mul(new decimal(tokenPrice));

// //   // Start transaction
// //   await prisma.$transaction(async (prisma) => {
// //     // Process balance update
// //     await processBalanceUpdate({ amount: new decimal(amount).toDecimalPlaces(2, decimal.ROUND_DOWN) , type: TxFlowType.OUT, address: address, tokenType: TokenType.TXT }, prisma);
// //     await processBalanceUpdate({ amount: new decimal(usdtAmount).toDecimalPlaces(2, decimal.ROUND_DOWN), type: TxFlowType.IN, address: address, tokenType: TokenType.USDT }, prisma);

// //     // Create tx flows array starting with the confirmed stake
// //     const txFlows: TxFlowCreateParams[] = [{
// //       address,
// //       amount,
// //       type: TxFlowType.FLASH_SWAP,
// //       tokenType: TokenType.TXT,
// //       toAddress: address,
// //       txHash: null,
// //       status: TxFlowStatus.CONFIRMED,
// //       description: JSON.stringify({
// //         "usdtAmount": usdtAmount
// //       }),
// //       executedAt: new Date()
// //     }];

// //     console.log(`txflow: ${JSON.stringify(txFlows)}`)

// //     // Create tx_flows in batch
// //     await createTxFlowBatch(txFlows, prisma);

// //     return;
// //   });
// // }

// // export async function innerTransfer(params: Omit<BalanceUpdateParams, 'type'>) {
// //   const { address, amount, txHash, toAddress } = params;
// //   if (!toAddress) {
// //     throw new Error('Missing toAddress for transfer');
// //   }

// //   // Start transaction
// //   await prisma.$transaction(async (prisma) => {
// //     // Process balance update
// //     await processBalanceUpdate({ ...params, type: TxFlowType.OUT }, prisma);
// //     await processBalanceUpdate({ ...params, type: TxFlowType.IN, address: toAddress }, prisma);

// //     // Create tx flows array starting with the confirmed stake
// //     const txFlows: TxFlowCreateParams[] = [{
// //       address,
// //       amount,
// //       type: TxFlowType.TRANSFER,
// //       tokenType: params.tokenType,
// //       toAddress: params.toAddress,
// //       txHash,
// //       status: TxFlowStatus.CONFIRMED,
// //       executedAt: new Date()
// //     }];

// //     console.log(`txflow: ${JSON.stringify(txFlows)}`)

// //     // Create tx_flows in batch
// //     await createTxFlowBatch(txFlows, prisma);

// //     return;
// //   });
// // }

// /**
//  * Get total staked reward
//  */
// // export async function getTotalStakedReward() {
// //   const todayStart = getUTCTodayStart();
// //   const todayEnd = getUTCTodayEnd();

// //   return await prisma.$transaction(async (prisma) => {
// //     // Get users with null superior
// //     const users = await prisma.user_info.findMany({
// //       where: {
// //         superior: null
// //       },
// //       select: {
// //         address: true
// //       }
// //     });

// //     // Get their dynamic tx_flow records for today
// //     const txFlows = await prisma.tx_flow.findMany({
// //       where: {
// //         user_address: {
// //           in: users.map(user => user.address)
// //         },
// //         type: TxFlowType.STAKE_DYNAMIC_REWARD,
// //         executed_at: {
// //           gte: todayStart,
// //           lte: todayEnd
// //         }
// //       },
// //       select: {
// //         description: true
// //       }
// //     });

// //     // Get their static tx_flow records for today
// //     const staticTxFlows = await prisma.tx_flow.findMany({
// //       where: {
// //         user_address: {
// //           in: users.map(user => user.address)
// //         },
// //         type: TxFlowType.STAKE_STATIC_REWARD,
// //         executed_at: {
// //           gte: todayStart,
// //           lte: todayEnd
// //         }
// //       },
// //       select: {
// //         amount: true
// //       }
// //     });

// //     const dynamicSum = txFlows.reduce((sum, txFlow) => {
// //       const description = txFlow.description ? JSON.parse(txFlow.description) : {};
// //       return new decimal(sum).add(new decimal(description.subordinate_static || 0)).toNumber();
// //     }, 0);

// //     const staticSum = staticTxFlows.reduce((sum, flow) => new decimal(sum).add(new decimal(flow.amount)).toNumber(), 0);
// //     return new decimal(dynamicSum).add(new decimal(staticSum)).toNumber();
// //   });
// // }

// // export async function calculateDynamicReward(userId: number, tokenPrice: decimal, year: number, month: number, day: number) {

// //   const user = await prisma.user_info.findUnique({
// //     where: { id: userId },
// //     select: {
// //       id: true,
// //       address: true,
// //       superior: true,
// //       level: true,
// //       type: true
// //     },
// //   });
// //   if (!user) {
// //     return null;
// //   }
// //   const subordinates = await getDirectSubordinates(user.address);

// //   const performances = await getPerformanceHistory([user.address, ...subordinates.map(sub => sub.address)], year, month, day);

// //   // Create a Map to store performances by address
// //   const performanceMap: Map<string, decimal> = new Map();
// //   const dynamicRewardMap: Map<string, decimal> = new Map();
// //   const miningMap: Map<string, decimal> = new Map();
// //   const rewardRatio = new decimal(await getLevelRewardRatio(user.level))
// //   // let nodeRewardRatio = new decimal(0)
// //   // let nodeRewardRatioDiff = new decimal(0)
// //   // if (user.type === UserType.COMMUNITY) {
// //   //   nodeRewardRatio = await getStakeCommunityNodeRewardRatio()
// //   //   nodeRewardRatioDiff = await getStakeCommunityNodeRewardDifRatio()
// //   // } else if (user.type === UserType.GROUP) {
// //   //   nodeRewardRatio = await getStakeGroupNodeRewardRatio()
// //   //   nodeRewardRatioDiff = await getStakeGroupNodeRewardDifRatio()
// //   // }

// //   // Store performances for both user and subordinates in a single loop
// //   performances.forEach((perf: { address: string; performance: decimal | null; token_staked_points: decimal | null; token_dynamic_reward: decimal | null }) => {
// //     performanceMap.set(perf.address, perf.performance || new decimal(0));
// //     miningMap.set(perf.address, perf.token_staked_points || new decimal(0));
// //     dynamicRewardMap.set(perf.address, perf.token_dynamic_reward || new decimal(0));
// //   });

// //   // Calculate user's pure reward
// //   const stakeRate = new decimal(await getStakeRewardRate());

// //   let dynamicReward = new decimal(0)
// //   let incubationReward = new decimal(0)
// //   // let dynamicNodeReward = new decimal(0)
// //   // let nodeIncubationReward = new decimal(0)
// //   // let specialMarketing = new decimal(0)
// //   // let specialSecurity = new decimal(0)

// //   // Calculate total subordinate rewards
// //   for (const sub of subordinates) {
// //     const subPerformance = performanceMap.get(sub.address) || new decimal(0);
// //     const subDynamicRewardBase = dynamicRewardMap.get(sub.address) || new decimal(0);
// //     const subMining = miningMap.get(sub.address) || new decimal(0)
// //     const subMiningReward = subMining.mul(stakeRate)
// //     const subPerformanceBase = subPerformance.mul(stakeRate)
// //     const performanceBase = (subPerformance.add(subMining)).mul(stakeRate)
// //     const subLevel = sub.level;
// //     const subRewardRatio = new decimal(await getLevelRewardRatio(subLevel || 0))

// //     // if ((await getSpecialAddress()).includes(user.address)) {

// //     //   // Special marketing
// //     //   let subSpecialMarketing = new decimal(0)
// //     //   subSpecialMarketing = performanceBase.mul(new decimal(await getSpecialMarketingRate()))
// //     //   if (subSpecialMarketing.gt(0)) {
// //     //     specialMarketing = specialMarketing.add(subSpecialMarketing)
// //     //     specialSecurity = specialSecurity.add(subSpecialMarketing)
// //     //   }
// //     // }

// //     // Sub reward diff
// //     let subDynamicReward = new decimal(0)
// //     let ratioDiff = rewardRatio.sub(subRewardRatio)
// //     ratioDiff = ratioDiff.gt(new decimal(0)) ? ratioDiff : new decimal(0)
// //     // 业绩提供级差奖励 + 本人提供动态奖励
// //     subDynamicReward = subPerformanceBase.mul(ratioDiff).add(subMiningReward.mul(rewardRatio))
// //     if (subDynamicReward.gt(0)) {
// //       dynamicReward = dynamicReward.add(subDynamicReward)
// //     }

// //     // Sub incubation reward
// //     let subIncubationReward = new decimal(0)
// //     if (sub.level >= user.level && user.level > 0) {
// //       subIncubationReward = subDynamicRewardBase.mul(new decimal(await getEqualRewardRate()))
// //     }
// //     if (subIncubationReward.gt(0)) {
// //       incubationReward = incubationReward.add(subIncubationReward)
// //     }

// //     // let subNodeRewardRatio = new decimal(0)
// //     // if (sub.type === UserType.COMMUNITY) {
// //     //   subNodeRewardRatio = await getStakeCommunityNodeRewardRatio()
// //     // } else if (sub.type === UserType.GROUP) {
// //     //   subNodeRewardRatio = await getStakeGroupNodeRewardRatio()
// //     // }

// //     // Node mining pure reward
// //     //let subNodeRewardDiff = new decimal(0)
// //     //subNodeRewardDiff = performanceBase.mul(nodeRewardRatio).sub(subPerformanceBase.mul(subNodeRewardRatio))
// //     // if (subNodeRewardDiff.gt(0)) {
// //     //   dynamicNodeReward = dynamicNodeReward.add(subNodeRewardDiff)
// //     // }

// //     // Sub node incubation reward
// //     // let subNodeIncubationReward = new decimal(0)
// //     // if (subNodeRewardRatio.gte(nodeRewardRatio) && nodeRewardRatio.gt(new decimal(0))) {
// //     //   subNodeIncubationReward = subDynamicRewardBase.mul(new decimal(nodeRewardRatioDiff))
// //     // }
// //     // if (subNodeIncubationReward.gt(0)) {
// //     //   nodeIncubationReward = nodeIncubationReward.add(subNodeIncubationReward)
// //     // }
// //     console.log(`reward contribute: ${user.address} <- ${sub.address} dynamicR:${subDynamicReward}, incubationR:${subIncubationReward}`)
// //   }
// //   await processDynamicRewardCapBatch(user.address, dynamicReward, incubationReward, tokenPrice, year, month, day)
// // }

// /**
//  * Calculate and update dynamic reward for superior based on stake rewards
//  * @param address User's address whose superior will receive the reward
//  */
// export async function calculateStaticReward(address: string, stakedPoints: decimal, tokenPrice: decimal, year: number, month: number, day: number) {
//   const timestamp = new Date(Date.UTC(year, month - 1, day));

//   let stakeReward = new decimal(0);
//   let directReward = new decimal(0);


//   // Calculate reward for staked token (1%)
//   if (stakedPoints.lessThanOrEqualTo(0)) {
//     return
//   }
//   stakeReward = new decimal(stakedPoints)
//     .mul(await getStakeRewardRate());

//   const myPath = await getUserPath(address)
//   const myDepth = await getUserDepth(address);
//   const myPerformance = await getPerformanceHistory([address], year, month, day);
//   const myMining = await getUserMining(address)


//   if (myPerformance.length === 0) {
//     console.error(`No performance history found for address: ${address}, year: ${year}, month: ${month}, day: ${day}`)
//     return
//   }
//   const subordinateNum = myPerformance[0].subordinates_num;

//   const targetDepthsDiff = await getDirectRewardDepthDiff(subordinateNum);

//   let subordinates: SubordinateInfo[] = [];
//   for (const depth of targetDepthsDiff) {
//     subordinates = subordinates.concat(await getSubordinatesWithBalanceDepth(myPath, myDepth + depth));
//   }

//   let activeSubordinateStakedPoints = new decimal(0)
//   for (const sub of subordinates) {
//     if (isActive(sub) && sub.balance !== null) {
//       //const subActiveAmount = myMining.gte(await getRewardBurningThreshold()) ? sub.balance.token_staked_points : new decimal(Math.max(0, myMining.sub(sub.balance.token_staked_points).toNumber()))
//       const subActiveAmount = sub.balance.token_staked_points
//       activeSubordinateStakedPoints = activeSubordinateStakedPoints.add(subActiveAmount)
//     }
//   }
//   console.log(`activeSubordinateStakedPoints: ${activeSubordinateStakedPoints}, myMining: ${myMining}, getRewardBurningThreshold: ${await getRewardBurningThreshold()}`)

//   // Add active subordinates' staked points to stake reward
//   directReward = activeSubordinateStakedPoints.mul(await getStakeRewardRate()).mul(await getStakeDirectRewardRate(subordinateNum));

//   return await prisma.$transaction(async (prisma) => {
//     // Get user's token balances
//     if (stakeReward.gt(new decimal(0))) {
//       const stakeRewardReal = stakeReward.div(tokenPrice)

//       await processRewardCapAndFlow(address, stakeRewardReal, prisma, {
//         type: TxFlowType.STAKE_STATIC_REWARD,
//         token_type: TokenType.TXT,
//         description: JSON.stringify({
//           usdtAmount: stakeReward
//         }),
//         tx_hash: null,
//         status: TxFlowStatus.PENDING,
//         executed_at: timestamp
//       });
//     }

//     if (directReward.gt(new decimal(0))) {
//       const directRewardReal = directReward.div(tokenPrice)

//       await processRewardCapAndFlow(address, directRewardReal, prisma, {
//         type: TxFlowType.STAKE_STATIC_DIRECT_REWARD,
//         token_type: TokenType.TXT,
//         description: JSON.stringify({
//           usdtAmount: directReward
//         }),
//         tx_hash: null,
//         status: TxFlowStatus.PENDING,
//         executed_at: timestamp
//       });
//     }
//   }
//   );
// }

// export async function claim(params: Omit<BalanceUpdateParams, 'type'>) {
//   const { address, tokenType } = params;
//   let types: TxFlowType[] = [];
//   if (tokenType != TokenType.TXT) {
//     types.push(TxFlowType.NODE_REWARD);
//     types.push(TxFlowType.FEE_DIVIDEND);
//     types.push(TxFlowType.NODE_DIFF_REWARD);
//   } 
//   if ( tokenType != TokenType.USDT ){
//     types.push(TxFlowType.STAKE_STATIC_REWARD);
//     types.push(TxFlowType.STAKE_STATIC_DIRECT_REWARD);
//     types.push(TxFlowType.STAKE_DYNAMIC_REWARD);
//     types.push(TxFlowType.STAKE_DYNAMIC_NODE_REWARD);
//     types.push(TxFlowType.STAKE_DYNAMIC_INCUBATION_REWARD);
//     types.push(TxFlowType.STAKE_DYNAMIC_NODE_INCUBATION_REWARD);
//     types.push(TxFlowType.AIRDROP);
//     types.push(TxFlowType.FEE_DIVIDEND_TOKEN);
//     types.push(TxFlowType.MARKET_EXPENSE);
//     // if (await getSpecialSecurityClaimable()) {
//     //   types.push(TxFlowType.SECURITY_FUND);
//     // }
//   }

//   let sum = new decimal(0);

//   // Get all rewards that can be redeemed
//   while (true) {
//     const batch = await prisma.tx_flow.findMany({
//       where: {
//         user_address: address,
//         type: {
//           in: types
//         },
//         status: TxFlowStatus.PENDING,
//       },
//       select: {
//         amount: true,
//         id: true,
//         type: true,
//         token_type: true
//       },
//       orderBy: {
//         created_at: 'asc'
//       },
//       take: DB_BATCH, // Add pagination limit
//       //skip: skip // Start from first record
//     });

//     if (batch.length === 0) {
//       console.log('No rewards found for address:', address);
//       break;
//     }

//     for (const txFlow of batch) {
//       sum = sum.add(txFlow.amount);
//       await prisma.$transaction(async (prisma) => {
//         await processBalanceUpdate({
//           address,
//           amount: txFlow.amount,
//           type: txFlow.type,
//           tokenType: txFlow.token_type
//         }, prisma);

//         await prisma.tx_flow.update({
//           where: {
//             id: txFlow.id
//           },
//           data: {
//             status: TxFlowStatus.CONFIRMED
//           }
//         });
//       });
//     }

//     if (batch.length < DB_BATCH) {
//       break;
//     }

//     //skip += DB_BATCH;
//   }
//   if (sum.eq(0)) {
//     return;
//   }
// }

// export async function assemble(params: Omit<BalanceUpdateParams, 'type'>) {
//   // add an out pending tx_flow
//   const txFlow = await prisma.transaction.create({
//     data: {
//       tx_hash: "",
//       from_address: (await getHotWalletAddress()).toString(),
//       to_address: (await getAssembleTargetAddress()).toString(),
//       amount: params.amount,
//       amount_fee: new decimal(0),
//       description: JSON.stringify({
//         hotWallet: (await getHotWalletAddress()).toString()
//       }),
//       token_type: params.tokenType,
//       type: TxFlowType.ASSEMBLE,
//       status: TxFlowStatus.PENDING,
//     }
//   });

//   let txHash: string;

//   try {
//     txHash = (await outTransferTokens((await getAssembleTargetAddress()).toString(), params.amount, params.tokenType)).txHash;
//   } catch (error) {
//     await prisma.transaction.update({
//       where: {
//         id: txFlow.id
//       },
//       data: {
//         status: TxFlowStatus.FAILED,
//         description: error instanceof Error ? error.message : String(error)
//       }
//     });
//     console.log(`Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`);
//     throw new Error(ErrorCode.OPERATION_FAILED);
//   }
//   if (txHash) {
//     await prisma.transaction.update({
//       where: {
//         id: txFlow.id
//       },
//       data: {
//         tx_hash: txHash
//       }
//     });
//   }
//   return txHash;
// }

// async function getWithdrawFee(amount: decimal, tokenType: TokenType) {
//   if (tokenType === TokenType.USDT) {
//     return amount.mul(new decimal(await getWithdrawTokenFeeRatio()));
//   } else {
//     return amount.mul(new decimal(await getWithdrawTokenFeeRatio()));
//   }
// }

// /**
//  * Helper function to withdraw points
//  */
// export async function outPoints(params: Omit<BalanceUpdateParams, 'type'>) {

//   let txFlow;
//   // check: the last withdraw should be at least 10 minutes ago
//   const tenMinutesAgo = new Date();
//   tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

//   txFlow = await prisma.$transaction(async (prisma) => {

//     const latestWithdraw = await prisma.transaction.findFirst({
//       where: {
//         from_address: params.address,
//         type: TxFlowType.OUT,
//         token_type: params.tokenType
//       },
//       orderBy: {
//         created_at: 'desc'
//       }
//     });

//     if (latestWithdraw && (
//       latestWithdraw.status === TxFlowStatus.AUDITING || latestWithdraw.status === TxFlowStatus.PENDING
//     )) {
//       throw new Error(ErrorCode.FREQUENT_OPERATION);
//     }

//     const amountFee = await getWithdrawFee(new decimal(params.amount), params.tokenType);

//     await processBalanceUpdate({
//       address: params.address,
//       amount: new decimal(params.amount),
//       tokenType: params.tokenType,
//       type: TxFlowType.OUT
//     }, prisma);

//     // add an out pending tx_flow
//     return await prisma.transaction.create({
//       data: {
//         tx_hash: "",
//         from_address: params.address,
//         to_address: params.toAddress || '',
//         amount: new decimal(params.amount).sub(amountFee).toDecimalPlaces(2, decimal.ROUND_DOWN),
//         amount_fee: amountFee,
//         description: JSON.stringify({
//           hotWallet: (await getHotWalletAddress()).toString()
//         }),
//         token_type: params.tokenType,
//         type: TxFlowType.OUT,
//         status: TxFlowStatus.AUDITING,
//       }
//     });
//   });

//   if (!txFlow) {
//     throw new Error(ErrorCode.OPERATION_FAILED);
//   }
//   return txFlow.id
// }

// /**
//  * Set the status of a transaction as refused, visiable for user
//  * @param txId 
//  * @param pointsBack 
//  * @returns 
//  */
// export async function auditionOutRefused(txId: number) {
//   const tx = await prisma.transaction.findUnique({
//     where: {
//       id: txId,
//       type: TxFlowType.OUT,
//       status: TxFlowStatus.AUDITING
//     }
//   });
//   if (!tx) {
//     throw new Error(`tx ${txId} not exist`);
//   }
//   const amount = tx.amount_fee ? tx.amount.add(tx.amount_fee) : tx.amount;
//   const type = tx.token_type;

//   await prisma.$transaction(async (prisma) => {
//     try {
//       await processBalanceUpdate({
//         address: tx.from_address,
//         amount,
//         tokenType: type,
//         type: TxFlowType.IN // Since we're adding points back, this is an incoming transaction
//       }, prisma);

//       await prisma.transaction.update({
//         where: { id: txId },
//         data: {
//           status: TxFlowStatus.REFUSED
//         }
//       });
//     } catch (error: any) {
//       console.error(`Transaction processing error: ${error.message}`, error);
//       throw error;
//     }
//   })
// }

// /**
//  * Batch set the status of a transaction as passed, visiable for user
//  */
// export async function auditionOutBatch() {
//   const txs = await prisma.transaction.findMany({
//     where: {
//       type: {
//         in: [TxFlowType.OUT, TxFlowType.BURNING]
//       },
//       status: TxFlowStatus.AUDITING
//     }
//   });
//   for (const tx of txs) {
//     await auditionOutTx(tx);
//   }
// }


// /**
//  * Set the status of a transaction as passed, visiable for user
//  * @param txId 
//  * @param pointsBack 
//  * @returns 
//  */
// export async function auditionOutPassed(txId: number): Promise<string> {
//   const tx = await prisma.transaction.findUnique({
//     where: {
//       id: txId,
//       type: TxFlowType.OUT,
//       status: {
//         in: [TxFlowStatus.AUDITING, TxFlowStatus.FAILED]
//       }
//     }
//   });
//   if (!tx) {
//     throw new Error(`tx ${txId} not exist`);
//   } 
//   return await auditionOutTx(tx);
// }

// /**
//  * Set the status of a transaction as passed, visiable for user
//  * @param tx 
//  * @param pointsBack 
//  * @returns 
//  */
// async function auditionOutTx(tx: Transaction): Promise<string> {
//   let txHash: string;
//   if (getEnvironment() === DEV_ENV) {
//     // Generate a random base58 string of correct length for Solana tx hash
//     const randomBytes = new Uint8Array(32);
//     crypto.getRandomValues(randomBytes);
//     txHash = bs58.encode(randomBytes);
//   } else {
//     if (!tx.to_address) {
//       throw new Error(ErrorCode.MISSING_WALLET_ADDRESS);
//     }
//     try {
//       txHash = (await outTransferTokens(tx.to_address, tx.amount, tx.token_type)).txHash;
//     } catch (error) {
//       await prisma.transaction.update({
//         where: {
//           id: tx.id
//         },
//         data: {
//           status: TxFlowStatus.FAILED,
//           description: error instanceof Error ? error.message : String(error)
//         }
//       });
//       console.log(`Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`);
//       throw new Error(ErrorCode.OPERATION_FAILED);
//     }
//   }

//   await prisma.transaction.update({
//     where: {
//       id: tx.id
//     },
//     data: {
//       status: TxFlowStatus.PENDING,
//       tx_hash: txHash
//     }
//   });

//   return txHash;
// }
