import { MAX_TIMESTAMP_GAP_MS } from "@/constants";
import prisma from "@/lib/prisma";
import decimal from "decimal.js";
//import { getDirectSubordinatesWithBalance, getUserMinLevel, isActive, updateUserLevel } from "./user";
import { getLevelByPerformance } from "./config";
import { deleteKey, getValue, setWithExpiry } from "./redis";

// Cache durations
const CLEAN_TASK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const MINING_DATA_CACHE_DURATION = CLEAN_TASK_INTERVAL;
const USER_DATA_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache key prefixes - using standard Redis naming conventions
// Format: entity:identifier:attribute
const KEY_PREFIX = "TwinX";
const PERFORMANCE_KEY = `${KEY_PREFIX}:user:performance`;
const USER_ID_KEY = `${KEY_PREFIX}:user:id`;
const USER_PATH_KEY = `${KEY_PREFIX}:user:path`;
const USER_LEVEL_KEY = `${KEY_PREFIX}:user:level`;
const USER_SUPERIOR_KEY = `${KEY_PREFIX}:user:superior`;
const USER_TYPE_KEY = `${KEY_PREFIX}:user:type`;
const USER_MINING_KEY = `${KEY_PREFIX}:user:mining`;

/**
 * Clean user type from cache
 * @param address User wallet address
 */
export async function cleanUserType(address: string) {
    await deleteKey(`${USER_TYPE_KEY}:${address}`);
}

/**
 * Get user type from cache or database
 * @param address User wallet address
 */
export async function getUserType(address: string) {
    // Check cache first with a specific key for user addresses
    const userType = await getValue(`${USER_TYPE_KEY}:${address}`);

    if (userType) {
        return userType;
    }

    // If not in cache, query from database
    const user = await prisma.user.findUnique({
        where: { walletAddress: address },
        select: { type: true }
    });

    if (!user || !user.type) {
        return null;
    }

    const type = user.type;

    // Store in cache
    await setWithExpiry(`${USER_TYPE_KEY}:${address}`, type, USER_DATA_CACHE_DURATION);

    return type;
}

/**
 * Get user's superior from cache or database
 * @param address User wallet address
 */
export async function getUserSuperior(address: string) {
    // Check cache first with a specific key for user addresses
    const superior = await getValue(`${USER_SUPERIOR_KEY}:${address}`);

    if (superior) {
        return superior;
    }

    // If not in cache, query from database
    const user = await prisma.user.findUnique({
        where: { walletAddress: address },
        select: { superior: true }
    });

    if (!user || !user.superior) {
        return null;
    }

    // Store in cache
    await setWithExpiry(`${USER_SUPERIOR_KEY}:${address}`, user.superior, USER_DATA_CACHE_DURATION);

    return user.superior;
}


/**
 * Clean user level from cache
 * @param address User wallet address
 */
export async function cleanUserLevel(address: string) {
    await deleteKey(`${USER_LEVEL_KEY}:${address}`);
}

/**
 * Get user level from cache or database
 * @param address User wallet address
 */
// export async function getUserLevel(address: string) {
//     // Check cache first with a specific key for user addresses
//     const userLevel = await getValue(`${USER_LEVEL_KEY}:${address}`);

//     if (userLevel) {
//         try {
//             return Number(userLevel);
//         } catch (error) {
//             console.warn(`Cannot convert cached user level to number for ${address}:`, error);
//             // Fallback to database query
//         }
//     }

//     // If not in cache, query from database
//     //const performance = await getUserPartialPerformance(address);
//     let newLevel = await getLevelByPerformance(performance.partialAmount);
//     //const minLevel = await getUserMinLevel(address);
//     // if (minLevel && newLevel < minLevel) {
//     //     newLevel = minLevel;
//     // }
//     console.log(`[getUserLevel] ${address} level: ${newLevel}, partialAmount: ${performance.partialAmount}`)
//     //await updateUserLevel(address, newLevel)

//     // Store in cache
//     await setWithExpiry(`${USER_LEVEL_KEY}:${address}`, `${newLevel}`, MINING_DATA_CACHE_DURATION);

//     return newLevel;
// }

/**
 * Get user path from cache or database
 * @param address User wallet address
 */
export async function getUserPath(address: string) {
    // Check cache first with a specific key for user addresses
    const cachedPath = await getValue(`${USER_PATH_KEY}:${address}`);

    if (cachedPath) {
        return cachedPath;
    }

    // If not in cache, query from database
    const user = await prisma.user.findUnique({
        where: { walletAddress: address },
        select: { path: true, superior: true }
    });

    if (!user || !user.path) {
        throw new Error(`No user,path found with address: ${address}`);
    }

    // Store in cache
    if (user.superior) {
        await setWithExpiry(`${USER_PATH_KEY}:${address}`, user.path, USER_DATA_CACHE_DURATION);
    }

    return user.path;
}

/**
 * Get user depth from cache or database
 * @param address User wallet address
 */
export async function getUserDepth(address: string) {
    const path = await getUserPath(address)
    return path.split('.').length - 1;
}

/**
 * Get user address by ID from cache or database
 * @param id User ID
 */
export async function getUserAddressById(id: string) {
    // Check cache first with a specific key for user addresses
    const cachedAddress = await getValue(`${USER_ID_KEY}:${id}`);

    if (cachedAddress) {
        return cachedAddress;
    }

    // If not in cache, query from database
    const user = await prisma.user.findUnique({
        where: { id },
        select: { walletAddress: true }
    });

    if (!user) {
        throw new Error(`No user found with ID: ${id}`);
    }

    // Store in cache
    await setWithExpiry(`${USER_ID_KEY}:${id}`, user.walletAddress, USER_DATA_CACHE_DURATION);

    return user.walletAddress;
}

/**
 * getUserTotalPerformanceDb
 * @param address 
 */
// export async function getUserMiningDb(address: string) {

//     // Use Prisma's aggregate to sum staked points in a single query
//     const miningPoint = await prisma.user_balance.findUnique({
//         where: {
//             address: address
//         },
//         select: {
//             token_staked_points: true,
//             stake_reward_cap: true,
//         }
//     });

//     let staking = new decimal(0)
//     if (!miningPoint || miningPoint.token_staked_points.lte(new decimal(0)) || miningPoint.stake_reward_cap.lte(new decimal(0))) {
//         staking = new decimal(0)
//     } else {
//         staking = miningPoint.token_staked_points
//     }

//     await setUserMining(address, staking)
//     return staking
// }

async function setUserMining(address: string, amount: decimal) {
    try {
        // Set the cache entry for this address
        // The entry will automatically expire after MINING_DATA_CACHE_DURATION
        await setWithExpiry(`${USER_MINING_KEY}:${address}`, amount.toString(), MINING_DATA_CACHE_DURATION);

        // You might want to add additional logic here, such as:
        // - Updating database records
        // - Performing mining-related operations

    } catch (error) {
        // Remove the cache entry if an error occurs
        await cleanUserMining(address)
        console.error(`Error in setUserMining for address ${address}:`, error);
    }
}

/**
 * cleanUserTotalPerformance
 * @param address 
 */
export async function cleanUserMining(address: string) {
    await deleteKey(`${USER_MINING_KEY}:${address}`)
}

/**
 * getUserTotalPerformance
 * @param address 
 */
// export async function getUserMining(address: string) {
//     // Retrieve the cached mining amount for the given address
//     const cachedAmount = await getValue(`${USER_MINING_KEY}:${address}`);

//     // If there's a cached amount, try to convert it to decimal
//     if (cachedAmount) {
//         try {
//             return new decimal(cachedAmount);
//         } catch (error) {
//             // If conversion fails, fetch from database
//             console.warn(`Failed to convert cached performance for ${address}:`, error);
//         }
//     }

//     // If no cached amount, fetch the mining data from the database
//     const totalAmount = await getUserMiningDb(address);
//     return totalAmount;
// }

/**
 * getUserTotalPerformanceDb
 * @param address 
 */
/* export async function getUserTotalPerformanceDb(address: string) {
    const path = await getUserPath(address)
    // Query avalizble tx flows
    const subordinates = await getAllSubordinatesWithBalance(path)
    // Filter out the current user's address
    const filteredSubordinates = subordinates.filter(sub => (sub.address !== address && sub.balance?.token_reward_cap.gt(new decimal(0))));

    // Use Prisma's aggregate to sum staked points in a single query
    const totalStakedPoints = await prisma.user_balance.aggregate({
        _sum: {
            token_staked_points: true
        },
        where: {
            address: {
                in: filteredSubordinates.map(sub => sub.address)
            }
        }
    });

    // Convert the sum to a decimal, defaulting to 0 if null
    const totalAmount = new decimal(totalStakedPoints._sum.token_staked_points || 0);
    await setUserTotalPerformance(address, totalAmount)
    return totalAmount
} */

async function setUserTotalPerformance(address: string, amount: decimal) {
    try {
        // Set the cache entry for this address
        // The entry will automatically expire after MINING_DATA_CACHE_DURATION
        await setWithExpiry(`${PERFORMANCE_KEY}:${address}`, amount.toString(), MINING_DATA_CACHE_DURATION);

        // You might want to add additional logic here, such as:
        // - Updating database records
        // - Performing mining-related operations

    } catch (error) {
        // Remove the cache entry if an error occurs
        await cleanUserTotalPerformance(address)
        console.error(`Error in setUserMining for address ${address}:`, error);
    }
}

/**
 * cleanUserTotalPerformance
 * @param address 
 */
export async function cleanUserTotalPerformance(address: string) {
    await deleteKey(`${PERFORMANCE_KEY}:${address}`)
}

/** 防止异常上下级成环导致无限递归栈溢出 */
const MAX_PERFORMANCE_RECURSION_DEPTH = 100;

/**
 * getUserTotalPerformance
 * @param address 
 */
export async function getUserTotalPerformance(
    address: string,
    depth = 0
): Promise<decimal> {
    if (depth > MAX_PERFORMANCE_RECURSION_DEPTH) {
        console.warn(
            `[getUserTotalPerformance] max depth (${MAX_PERFORMANCE_RECURSION_DEPTH}) at ${address}`
        );
        return new decimal(0);
    }
    // Define keys for computation state
    const cacheKey = `${PERFORMANCE_KEY}:${address}`;
    const computingKey = `${PERFORMANCE_KEY}:computing:${address}`;
    
    // Retrieve the cached mining amount for the given address
    const cachedAmount = await getValue(cacheKey);

    // If there's a cached amount, try to convert it to decimal
    if (cachedAmount) {
        try {
            return new decimal(cachedAmount);
        } catch (error) {
            // If conversion fails, fetch from database
            console.warn(`Failed to convert cached performance for ${address}:`, error);
        }
    }
    
    // Check if computation is already in progress for this address
    const isComputing = await getValue(computingKey);
    if (isComputing) {
        // Return a negative value to indicate computation is in progress
        // Retry 20 times
        let retryCount = 0;
        const maxRetries = 20;
        const baseDelay = 2000; // base delay in milliseconds

        while (retryCount < maxRetries) {
            // Wait with exponential backoff
            const delay = baseDelay * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Try again
            const finalPerformance = await getUserTotalPerformance(address, 0);
            if (!finalPerformance.lessThan(0)) {
                return finalPerformance;
            }
            retryCount++;
        }
        throw new Error(`Failed to get performance for address ${address} after ${maxRetries} retries`);
    }
    
    try {
        // Set a flag indicating computation is in progress (with a timeout for safety)
        await setWithExpiry(computingKey, "1", 60 * 1000); // 60 seconds timeout
        
        // If no cached amount, fetch the mining data recurrently
        //const subordinates = await getDirectSubordinatesWithBalance(address);
        let totalAmount = new decimal(0);
        
        // Process each subordinate
        // for (const subordinate of subordinates) {
        //     if (isActive(subordinate) && subordinate.balance) {
        //         totalAmount = totalAmount.add(subordinate.balance.token_staked_points);
        //     }
        //     const subPerformance = await getUserTotalPerformance(
        //         subordinate.address,
        //         depth + 1
        //     );
        //     totalAmount = totalAmount.add(subPerformance);
        // }
        
        // Cache the result
        await setUserTotalPerformance(address, totalAmount);
        
        return totalAmount;
    } finally {
        // Always clean up the computing flag when done, regardless of success or failure
        await deleteKey(computingKey);
    }
}

interface UserPartialPerformance {
    partialAmount: decimal;
    maxUserId: number | null;
    maxAmount: decimal;
}

/**
 * getUserPartialPerformance
 * @param address 
 */
// export async function getUserPartialPerformance(address: string): Promise<UserPartialPerformance> {
//     //const subordinates = await getDirectSubordinatesWithBalance(address)
//     // Query their performance for each subordinate    
//     // Use Promise.all to concurrently fetch performance for each subordinate
//     // const subordinatePerformances = await Promise.all(
//     //     subordinates.map(async (sub) => {
//     //         const performance = await getUserTotalPerformance(sub.address);
//     //         return {
//     //             ...sub,
//     //             performanceIncludeSelf: (isActive(sub) && sub.balance) ? performance.add(sub.balance.token_staked_points) : performance
//     //         };
//     //     })
//     // );

//     // Find the maximum performance and its corresponding user ID
//     const { maxAmount, maxUserId } = subordinatePerformances.reduce(
//         (acc, subPerformance) => {
//             if (subPerformance.performanceIncludeSelf.gt(acc.maxAmount)) {
//                 return {
//                     maxAmount: subPerformance.performanceIncludeSelf,
//                     maxUserId: subPerformance.id
//                 };
//             }
//             return acc;
//         },
//         {
//             maxAmount: new decimal(0),
//             maxUserId: null as number | null
//         }
//     );

//     // Calculate total partial performance by summing all except the max
//     const partialAmount = subordinatePerformances.reduce(
//         (sum, subPerformance) => {
//             if(subPerformance.id === maxUserId) {
//                 return sum
//             }
//             sum = sum.add(subPerformance.performanceIncludeSelf)
//             /* if (isActive(subPerformance) && subPerformance.balance) {
//                 sum = sum.add(subPerformance.balance?.token_staked_points)
//             } */
//             return sum
//         },
//         new decimal(0)
//     );



//     return {
//         partialAmount,
//         maxUserId,
//         maxAmount
//     };
// }