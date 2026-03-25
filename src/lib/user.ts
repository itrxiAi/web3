import { DB_BATCH } from '@/constants';
import prisma from './prisma';
import { EquityType, Prisma, TokenType, TxFlowStatus, TxFlowType, UserType } from '@prisma/client';
import decimal from 'decimal.js';
import { getCommunityNum, getCommunityPriceDisplay, getGroupNum, getGroupPriceDisplay, getHotWalletAddress, getReferralDirectRewardRateCommunity, getReferralDirectRewardRateGroup, getReferralDiffRewardRateCommunity, getReferralDiffRewardRateGalaxy, getGalaxyThreshold, getStakeGroupDynamicRewardCap, getStakeCommunityDynamicRewardCap, getGroupMinLevel, getCommunityMinLevel, getGalaxyMinLevel, getReferralDirectRewardRateGalaxy, getEquityBasePriceDisplay, getEquityPlusPriceDisplay, getEquityPremiumPriceDisplay } from './config';
import { cleanUserLevel, cleanUserMining, cleanUserTotalPerformance, getUserAddressById, getUserPath, getUserTotalPerformance } from './userCache';
import { reRankUser } from '@/tasks/user';
//import { processBalanceUpdate } from './balance';
import { truncateDecimals, truncateNumber } from '@/utils/common';

export async function getUsersByTypes(types: UserType[]) {
  return await prisma.user.findMany({
    where: { type: { in: types } }
  });
}

export async function getActivePercent({
  walletAddress,
  userType
}: {
  walletAddress: string;
  userType: UserType;
}) {
  return 100
  // if (userType !== UserType.GALAXY) {
  //   return 100;
  // }

  // const num = await prisma.user_info.count({
  //   where: { leader: walletAddress }
  // });
  // return truncateNumber(new decimal(num).div(await getGalaxyThreshold()).mul(100));
}

export async function setGalaxy(walletAddress: string) {
  await prisma.user.update({
    where: { walletAddress: walletAddress },
    data: { type: UserType.COMMUNITY }
  });
}

export async function updateUserEquity({
  walletAddress,
  equityType,
  txHash,
  tx
}: {
  walletAddress: string;
  equityType: EquityType;
  txHash: string; 
  tx: Prisma.TransactionClient;
}) {
  let amount = 0;
  if (equityType === EquityType.BASE) {
    amount = (await getEquityBasePriceDisplay()).toNumber();
  } else if (equityType === EquityType.PLUS) {
    amount = (await getEquityPlusPriceDisplay()).toNumber();
  } else if (equityType === EquityType.PREMIUM) {
    amount = (await getEquityPremiumPriceDisplay()).toNumber();
  }
  const transactiion = await tx.transaction.create({
    data: {
      txHash: txHash,
      fromAddress: walletAddress,
      toAddress: (await getHotWalletAddress()).toString(),
      amount: amount,
      tokenType: TokenType.USDT,
      type: TxFlowType.EQUITY,
      status: TxFlowStatus.PENDING
    }
  });

  const user = await tx.user.update({
    where: { walletAddress: walletAddress },
    data: { equityType: EquityType.PREMIUM, equityActivedAt: new Date() }
  });

  return {
    txId: transactiion.id,
    userId: user.id
  }
}

export async function updateUserType({
  walletAddress,
  type,
  txHash,
  tx
}: {
  walletAddress: string;
  type: UserType;
  txHash: string;
  tx: Prisma.TransactionClient;
}) {
  let amount = 0;
  let userType: UserType = type; // 默认使用传入的类型，确保不会为 null
  let stakeCap = new decimal(0)
  let dynamicCap = new decimal(0)
  let minLevel = 0


  // if (type === UserType.GROUP) {
  //   amount = (await getGroupPriceDisplay()).toNumber();
  //   userType = UserType.GROUP;
  //   dynamicCap = await getStakeGroupDynamicRewardCap()
  //   minLevel = await getGroupMinLevel()
  // } else if (type === UserType.COMMUNITY) {
  //   amount = (await getCommunityPriceDisplay()).toNumber();
  //   userType = UserType.COMMUNITY;
  //   dynamicCap = await getStakeCommunityDynamicRewardCap()
  //   minLevel = await getCommunityMinLevel()
  // }

  if (type === UserType.COMMUNITY) {
    amount = (await getCommunityPriceDisplay()).toNumber();
    userType = UserType.COMMUNITY;
    dynamicCap = await getStakeCommunityDynamicRewardCap()
    minLevel = await getCommunityMinLevel()
  }

  const count = await tx.user.count({
    where: { type }
  });
  if (count >= (type != UserType.COMMUNITY ? await getGroupNum() : await getCommunityNum())) {
    throw new Error('All spots are currently sold out');
  }

  const transactiion = await tx.transaction.create({
    data: {
      txHash: txHash,
      fromAddress: walletAddress,
      toAddress: (await getHotWalletAddress()).toString(),
      amount: amount,
      tokenType: TokenType.USDT,
      type: TxFlowType.EQUITY,
      status: TxFlowStatus.PENDING
    }
  });


  const user = await tx.user.update({
    where: { walletAddress: walletAddress },
    data: { type: userType, equityType: EquityType.PREMIUM, purchaseAt: new Date(), equityActivedAt: new Date()/* , min_level: minLevel */ }
  });

  await reRankUser(walletAddress)

  // await tx.user_balance.update({
  //   where: { address: walletAddress },
  //   data: { stake_reward_cap: { increment: dynamicCap }, token_staked_points: { increment: amount } }
  // });

  return {
    txId: transactiion.id,
    userId: user.id
  }

}

// export async function updateSuperiorNodeReward({
//   walletAddress,
//   superiorAddress,
//   type,
//   tx
// }: {
//   walletAddress: string;
//   superiorAddress: string;
//   type: UserType;
//   tx: Prisma.TransactionClient;
// }) {
//   if (type !== UserType.GROUP && type !== UserType.COMMUNITY) {
//     return;
//   }
//   let amount = 0;
//   if (type === UserType.GROUP) {
//     amount = (await getGroupPriceDisplay()).toNumber();
//   } else if (type === UserType.COMMUNITY) {
//     amount = (await getCommunityPriceDisplay()).toNumber();
//   }

//   // Initialize remaining reward amount (100% of original amount)
//   let currentSuperiorAddress: string = superiorAddress;
//   let communityRewared = false;
//   let galaxyRewared = false;
//   let iteNum = 0;
//   let leaderAddress = '';

//   // Iterate through the chain of superiors until no more superiors exist or no rewards left
//   while (currentSuperiorAddress !== '' && !galaxyRewared) {
//     const currentSuperior = await tx.user_info.findUnique({
//       where: { address: currentSuperiorAddress },
//       select: { address: true, type: true, superior: true, interest_active: true }
//     }) as { address: string; type: UserType | null; superior: string | null, interest_active: boolean } | null;
//     console.log(`currentSuperior: ${JSON.stringify(currentSuperior)}`)

//     // Leader
//     if (currentSuperior?.type == UserType.GALAXY && leaderAddress === '') {
//       // Count leaders subordinates
//       const subordinates = await tx.user_info.count({
//         where: { leader: currentSuperior.address }
//       });
//       if (subordinates >= (await getGalaxyThreshold()).toNumber() - 1) {
//         // Update minLevel if active
//         await tx.user_info.update({
//           where: { address: currentSuperior.address },
//           data: { interest_active: true, min_level: await getGalaxyMinLevel() }
//         });
//       }
//       leaderAddress = currentSuperior.address;
//       await tx.user_info.update({
//         where: { address: walletAddress },
//         data: { leader: currentSuperior.address }
//       });

//     }
//     console.log(`iteNum: ${iteNum}, currentSuperior: ${currentSuperior?.type}`)
//     // Direct reward
//     if (iteNum == 0 && (currentSuperior?.type === UserType.GROUP || currentSuperior?.type === UserType.COMMUNITY || currentSuperior?.type === UserType.GALAXY)) {
//       console.log(`in`)
//       let superiorRewardRate = new decimal(0);
//       // Calculate reward based on superior type
//       if (currentSuperior.type === UserType.COMMUNITY) {
//         superiorRewardRate = await getReferralDirectRewardRateCommunity();
//       } else if (currentSuperior.type === UserType.GALAXY) {
//         superiorRewardRate = await getReferralDirectRewardRateGalaxy();
//       } else if (currentSuperior.type === UserType.GROUP) {
//         superiorRewardRate = await getReferralDirectRewardRateGroup();
//       }
//       const rewardAmount = new decimal(amount).mul(superiorRewardRate);
//       if (rewardAmount.gt(new decimal(0))) {
//         await tx.tx_flow.create({
//           data: {
//             user_address: currentSuperiorAddress,
//             amount: rewardAmount,
//             token_type: TokenType.USDT,
//             type: TxFlowType.NODE_REWARD,
//             status: TxFlowStatus.PENDING,
//             description: JSON.stringify({
//               buyer: walletAddress,
//               nodeType: type,
//             }),
//             executed_at: new Date(),
//           }
//         });
//       }
//       await cleanUserTotalPerformance(currentSuperiorAddress)
//       console.log(`superior: ${currentSuperiorAddress}, superiorRewardRate:${superiorRewardRate}, rewardAmount:${rewardAmount}`);
//     }

//     // Diff reward
//     if (!galaxyRewared && (currentSuperior?.type === UserType.COMMUNITY || currentSuperior?.type === UserType.GALAXY)) {
//       let superiorRewardRate = new decimal(0);
//       // Calculate reward based on superior type
//       // if (currentSuperior.type === UserType.COMMUNITY && !communityRewared) {
//       //   superiorRewardRate = await getReferralDiffRewardRateCommunity();
//       //   communityRewared = true;
//       // } else if (currentSuperior.type === UserType.GALAXY && !communityRewared && currentSuperior.interest_active) {
//       //   superiorRewardRate = await getReferralDiffRewardRateGalaxy();
//       //   galaxyRewared = true;
//       // } else if (currentSuperior.type === UserType.GALAXY && communityRewared && currentSuperior.interest_active) {
//       //   superiorRewardRate = (await getReferralDiffRewardRateGalaxy()).sub(await getReferralDiffRewardRateCommunity());
//       //   galaxyRewared = true;
//       // }
//       if (currentSuperior.type === UserType.GALAXY) {
//         superiorRewardRate = await getReferralDiffRewardRateGalaxy();
//         galaxyRewared = true;
//       }
//       console.log(`superior: ${currentSuperiorAddress}, superiorRewardRate:${superiorRewardRate}`);

//       if (superiorRewardRate.gt(new decimal(0))) {
//         // Calculate reward amount for current superior
//         const preRewardAmount = new decimal(amount).mul(superiorRewardRate);
//         // await prisma.transaction.create({
//         //   data: {
//         //     tx_hash: "",
//         //     from_address: currentSuperiorAddress,
//         //     to_address: currentSuperiorAddress,
//         //     amount: preRewardAmount,
//         //     amount_fee: 0,
//         //     description: JSON.stringify({
//         //       hotWallet: (await getHotWalletAddress()).toString(),
//         //       buyer: walletAddress,
//         //       nodeType: type,
//         //     }),
//         //     token_type: TokenType.USDT,
//         //     type: TxFlowType.NODE_DIFF_REWARD,
//         //     status: TxFlowStatus.AUDITING,
//         //   }
//         // });
//         // Create reward transaction
//         /* await tx.tx_flow.create({
//           data: {
//             user_address: currentSuperiorAddress,
//             amount: preRewardAmount,
//             token_type: TokenType.USDT,
//             type: TxFlowType.NODE_DIFF_REWARD,
//             status: TxFlowStatus.CONFIRMED,
//             description: JSON.stringify({
//               buyer: walletAddress,
//               nodeType: type,
//             }),
//             executed_at: new Date(),
//           }
//         }); */
//         // await processBalanceUpdate({
//         //   address: currentSuperiorAddress,
//         //   amount: rewardAmount,
//         //   type: TxFlowType.NODE_REWARD,
//         //   tokenType: TokenType.USDT,
//         // }, tx);
//       }
//     }

//     // Move to the next superior in the chain
//     currentSuperiorAddress = currentSuperior?.superior ?? '';
//     iteNum++;

//   }

// }

/**
 * Get user min level
 * @param address User's wallet address
 * @returns User's min level
 */
// export async function getUserMinLevel(address: string) {
//   const user = await prisma.user_info.findUnique({
//     where: { address }
//   });

//   if (!user) {
//     return null;
//   }

//   return user.min_level;
// }

// export async function updateUserMinLevel(address: string, minLevel: number) {
//   await cleanUserLevel(address)
//   const user = await prisma.user_info.update({
//     where: { address },
//     data: { min_level: minLevel }
//   });

//   return user;
// }

/**
 * User management related functions
 */

/**
 * Update user level
 * @param address User's wallet address
 * @param newLevel New level to set
 */
// export async function updateUserLevel(address: string, newLevel: number) {
//   const user = await prisma.user_info.findUnique({
//     where: { address }
//   });

//   if (!user) {
//     return null;
//   }

//   return await prisma.user.update({
//     where: { address },
//     data: { level: newLevel }
//   });
// }

export interface SubordinateInfo {
  id: string;
  walletAddress: string;
  //level: number;
  type: UserType | null;
  path: string | null;
  purchaseAt: Date | null;
  balance: {
    token_points: decimal;
    token_staked_points: decimal;
    stake_reward_cap: decimal;
    stake_dynamic_reward_cap: decimal;
    performance: decimal;
  } | null;
}

/**
 * Only the mining amout of active user can be included in the performance counting
 * @param user 
 * @returns
 */
export function isActive(user: SubordinateInfo) {
  if (!user.balance || user.balance.stake_reward_cap.lte(new decimal(0))) {
    return false
  }
  return true
}

// 含本人
// export async function fetchSubordinatesIncrement(path: string, startDate: string | Date, endDate: string | Date, type?: UserType): Promise<{ address: string; type: UserType | null; buy_at: Date | null }[]> {
//   const whereCondition: any = {
//     path: {
//       startsWith: `${path}`
//     },
//     buy_at: {
//       gte: startDate,
//       lt: endDate
//     }
//   };

//   // Add type condition if it exists
//   if (type) {
//     whereCondition.type = type;
//   }

//   const users = await prisma.user_info.findMany({
//     where: whereCondition,
//     select: {
//       address: true,
//       type: true,
//       buy_at: true
//     }
//   });

//   return users;
// }

// This function will return all subordinates including the user himself
// export async function getAllSubordinates(path: string): Promise<SubordinateInfo[]> {
//   const subordinates = await prisma.user.findMany({
//     where: {
//       path: {
//         startsWith: path
//       }
//     },
//     select: {
//       id: true,
//       walletAddress: true,
//       level: true,
//       path: true,
//       type: true,
//       buy_at: true,
//       created_at: true
//     }
//   });

//   // Add the required balance property with null value
//   return subordinates.map(sub => ({
//     ...sub,
//     balance: null
//   }));
// }

/**
 * Get subordinates with balance and depth
 */
// export async function getSubordinatesWithBalanceDepth(path: string, depth: number): Promise<SubordinateInfo[]> {
//   const subordinates = await prisma.user_info.findMany({
//     where: {
//       depth: {
//         equals: depth
//       },
//       path: {
//         startsWith: path,
//       }
//     },
//     select: {
//       id: true,
//       address: true,
//       level: true,
//       path: true,
//       type: true,
//       buy_at: true,
//       created_at: true
//     }
//   });

//   const balances = await prisma.user_balance.findMany({
//     where: {
//       address: {
//         in: subordinates.map(sub => sub.address)
//       }
//     },
//   })

//   const result: SubordinateInfo[] = [];

//   // Map each subordinate with its corresponding balance
//   for (const sub of subordinates) {
//     const userBalance = balances.find(b => b.address === sub.address);

//     result.push({
//       ...sub,
//       balance: userBalance ? {
//         token_points: userBalance.token_points,
//         token_staked_points: userBalance.token_staked_points,
//         stake_reward_cap: userBalance.stake_reward_cap,
//         stake_dynamic_reward_cap: userBalance.stake_dynamic_reward_cap,
//         performance: new decimal(0)
//       } : null,
//     });
//   }

//   return result;
// }


// This function will return all subordinates including the user himself
// export async function getAllSubordinatesWithBalance(path: string): Promise<SubordinateInfo[]> {
//   const subordinates = await prisma.user_info.findMany({
//     where: {
//       path: {
//         startsWith: path
//       }
//     },
//     select: {
//       id: true,
//       address: true,
//       level: true,
//       path: true,
//       type: true,
//       buy_at: true,
//       created_at: true
//     }
//   });

//   const balances = await prisma.user_balance.findMany({
//     where: {
//       address: {
//         in: subordinates.map(sub => sub.address)
//       }
//     },
//   })

//   const result: SubordinateInfo[] = [];

//   // Map each subordinate with its corresponding balance
//   for (const sub of subordinates) {
//     const userBalance = balances.find(b => b.address === sub.address);

//     result.push({
//       ...sub,
//       balance: userBalance ? {
//         token_points: userBalance.token_points,
//         token_staked_points: userBalance.token_staked_points,
//         stake_reward_cap: userBalance.stake_reward_cap,
//         stake_dynamic_reward_cap: userBalance.stake_dynamic_reward_cap,
//         performance: new decimal(0)
//       } : null,
//     });
//   }

//   return result;
// }

/**
 * Get direct subordinates of a user
 */
export async function getDirectSubordinates(address: string): Promise<SubordinateInfo[]> {
  const subordinates = await prisma.user.findMany({
    where: {
      superior: address
    },
    select: {
      id: true,
      walletAddress: true,
      //level: true,
      path: true,
      type: true,
      purchaseAt: true,
      createdAt: true

    }
  });
  // Add the required balance property with null value
  return subordinates.map(sub => ({
    ...sub,
    balance: null
  }));
}

/**
 * Get self and ancestors
 * @param address User wallet address
 * @returns Array of ancestor IDs as numbers
 */
// export async function getSelfIncludeAncestors(address: string): Promise<number[]> {
//   const path = await getUserPath(address);
//   const selfIncludeAncestors = path.split('.').map(id => Number(id));
//   return selfIncludeAncestors;
// }

// /**
//  * Clean user mining cache
//  * @param address User wallet address
//  */
// export async function cleanUserMiningLevelPerformanceCache(address: string) {
//   await cleanUserMining(address);
//   const ancestors = await getSelfIncludeAncestors(address);
//   console.log(`cleanUserMiningLevelPerformanceCache: ${address}, ancestors: ${ancestors}`)
//   // Iterate from tail to head (reverse order)
//   for (const ancestorId of [...ancestors].reverse()) {
//     const ancestorAddress = await getUserAddressById(ancestorId);
//     if (ancestorAddress) {
//       await cleanUserTotalPerformance(ancestorAddress);
//       await reRankUser(ancestorAddress);
//     }
//   }
// }


/**
 * Get direct subordinates of a user
 */
// export async function getDirectSubordinatesWithBalance(address: string): Promise<SubordinateInfo[]> {
//   const subordinates = await prisma.user_info.findMany({
//     where: {
//       superior: address
//     },
//     select: {
//       id: true,
//       address: true,
//       level: true,
//       path: true,
//       type: true,
//       buy_at: true,
//       created_at: true

//     }
//   });

//   const balances = await prisma.user_balance.findMany({
//     where: {
//       address: {
//         in: subordinates.map(sub => sub.address)
//       }
//     },
//   })

//   // Map each subordinate with its corresponding balance
//   const result: SubordinateInfo[] = [];
//   for (const sub of subordinates) {
//     const userBalance = balances.find(b => b.address === sub.address);
//     const performance = await getUserTotalPerformance(sub.address);
//     result.push({
//       ...sub,
//       balance: userBalance ? {
//         token_points: userBalance.token_points,
//         token_staked_points: userBalance.token_staked_points,
//         stake_reward_cap: userBalance.stake_reward_cap,
//         stake_dynamic_reward_cap: userBalance.stake_dynamic_reward_cap,
//         performance: performance
//       } : {
//         token_points: new decimal(0),
//         token_staked_points: new decimal(0),
//         stake_reward_cap: new decimal(0),
//         stake_dynamic_reward_cap: new decimal(0),
//         performance: new decimal(0)
//       }
//     });
//   }
//   return result;
// }

/**
 * Update user's path when adding to the hierarchy
 */
export async function updateUserPath(
  userId: string,
  superiorPath: string | null,
  tx: Prisma.TransactionClient = prisma,
  presentPath?: string
): Promise<void> {
  if (!presentPath) {
    presentPath = userId.toString();
  }
  const path = superiorPath ? `${superiorPath}.${presentPath}` : presentPath;
  const updateData: Prisma.UserUpdateArgs['data'] = {
    path,
    ...(superiorPath ? { depth: path.split('.').length - 1 } : { depth: 0 })
  };

  await tx.user.update({
    where: { id: userId },
    data: updateData
  });
}

/**
 * Get max path depth in the hierarchy
 */
// export async function getMaxPathDepth(): Promise<number> {
//   const result = await prisma.user.aggregate({
//     _max: {
//       depth: true
//     }
//   });

//   return result._max.depth || 0;
// }

/**
 * Get users at a specific path depth
 */
// export async function getUsersAtDepth(depth: number, take: number = DB_BATCH, skip: number = 0, userId: number = 0) {
//   // For depth 0, we want no dots
//   const users = await prisma.user_info.findMany({
//     where: {
//       id: {
//         gt: userId
//       },
//       depth: depth,
//     },
//     select: {
//       address: true,
//       id: true
//     },
//     orderBy: {
//       id: 'asc'
//     },
//     take,
//     skip
//   });
//   return users;
// }

/**
 * Get balance information for multiple users
 * @param addresses Array of wallet addresses to get balances for
 * @returns Array of objects containing address and balance information
 */
// export async function getUsersBalances(addresses: string[]) {
//   if (!addresses.length) return [];

//   const balances = await prisma.user_balance.findMany({
//     where: {
//       address: {
//         in: addresses
//       }
//     },
//     select: {
//       address: true,
//       token_points: true,
//       token_staked_points: true
//     }
//   });

//   return balances;
// }

// export async function isSpecial(address: string) {
//   const specialAddress = await getSpecialAddress();
//   return specialAddress.includes(address);
// }
