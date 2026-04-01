
import { getValue, setWithExpiry } from "./redis";

// Cache durations
const INDEX_CACHE_DURATION = 96 * 60 * 60 * 1000; // 24 hours

// Cache key prefixes - using standard Redis naming conventions
// Format: entity:identifier:attribute
const KEY_PREFIX = "HAK";

const TASK_STATIC_REWARD = `${KEY_PREFIX}:task:static`
const TASK_DYNCMIC_REWARD = `${KEY_PREFIX}:task:dynamic`
const TASK_SETTLEMENT = `${KEY_PREFIX}:task:settlement`
const TASK_FEE_DIVIDEND = `${KEY_PREFIX}:task:feedivident`
const TASK_REWARD_CAP = `${KEY_PREFIX}:task:rewardcap`

/**
 * Set static index to cache
 * @param address User wallet address
 */
export async function setSettlementStatus(year: number, month: number, day: number, status: string) {
    await setWithExpiry(`${TASK_SETTLEMENT}:${year}-${month}-${day}`, status, INDEX_CACHE_DURATION);
}

export async function getSettlementStatus(year: number, month: number, day: number) {
    const status = await getValue(`${TASK_SETTLEMENT}:${year}-${month}-${day}`);
    return status;
}

/**
 * Set static index to cache
 * @param address User wallet address
 */
export async function setStaticIndex(year: number, month: number, day: number, index: number) {
    await setWithExpiry(`${TASK_STATIC_REWARD}:${year}-${month}-${day}`, String(index), INDEX_CACHE_DURATION);
}


/**
 * Get static index from cache or database
 * @param address User wallet address
 */
export async function getStaticIndex(year: number, month: number, day: number) {
    // Check cache first with a specific key for user addresses
    const id = await getValue(`${TASK_STATIC_REWARD}:${year}-${month}-${day}`);

    if (id) {
        return Number(id);
    }

    return 0
}

/**
 * Set fee dividend to cache
 * @param year 
 * @param month 
 * @param day 
 * @param amount 
 */
export async function setFeeDividend(year: number, month: number, day: number, amount: number) {
    await setWithExpiry(`${TASK_FEE_DIVIDEND}:${year}-${month}-${day}`, String(amount), INDEX_CACHE_DURATION);
}

/**
 * Get fee dividend from cache or database
 * @param year 
 * @param month 
 * @param day 
 */
export async function getFeeDividend(year: number, month: number, day: number) {
    const amount = await getValue(`${TASK_FEE_DIVIDEND}:${year}-${month}-${day}`);
    return amount;
}

/**
 * Set reward cap to cache
    * @param year 
 * @param month 
 * @param day 
 * @param amount 
 */
export async function setRewardCap(year: number, month: number, day: number, amount: number) {
    await setWithExpiry(`${TASK_REWARD_CAP}:${year}-${month}-${day}`, String(amount), INDEX_CACHE_DURATION);
}

/**
 * Get reward cap from cache or database
 * @param year 
 * @param month 
 * @param day 
 */
export async function getRewardCap(year: number, month: number, day: number) {
    const amount = await getValue(`${TASK_REWARD_CAP}:${year}-${month}-${day}`);
    return amount;
}

/**
 * Set static index to cache
 * @param address User wallet address
 */
export async function setDynamicIndex(year: number, month: number, day: number, index: number, depth: number) {
    const str = JSON.stringify({index: index, depth: depth})
    await setWithExpiry(`${TASK_DYNCMIC_REWARD}:${year}-${month}-${day}`, str, INDEX_CACHE_DURATION);
}

/**
 * Get dynamic index from cache or database
 * @param address User wallet address
 */
export async function getDynamicIndex(year: number, month: number, day: number) {
    // Check cache first with a specific key for user addresses
    const str = await getValue(`${TASK_DYNCMIC_REWARD}:${year}-${month}-${day}`);

    if (str) {
        return JSON.parse(str);
    }

    return null
}
