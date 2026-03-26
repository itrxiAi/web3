import decimal from 'decimal.js';
import { privateKeyToAccount, type Address } from 'viem/accounts';
import { toHex } from 'viem';
import { PROD_ENV } from '@/constants';
import { PrismaClient } from '@prisma/client';
import { UserType } from '@prisma/client';
import prisma from '@/lib/prisma';

// Ensure this file is only imported on the server side
if (typeof window !== 'undefined') {
    throw new Error('This file should only be imported on the server side');
}
const TOKEN_USDT_DECIMAL = Number(process.env.NEXT_PUBLIC_USDT_DECIMAL || 6);

// Simple cache object
const configCache = new Map<string, string>();

const GROUP_PRICE_DISPLAY = "GROUP_PRICE";
const COMMUNITY_PRICE_DISPLAY = "COMMUNITY_PRICE";

const GROUP_PRICE_TRANSFER = "GROUP_PRICE_TRANSFER";
const COMMUNITY_PRICE_TRANSFER = "COMMUNITY_PRICE_TRANSFER";

// Equity Price
const EQUITY_BASE_PRICE_DISPLAY = "EQUITY_BASE_PRICE_DISPLAY";
const EQUITY_PLUS_PRICE_DISPLAY = "EQUITY_PLUS_PRICE_DISPLAY";
const EQUITY_PREMIUM_PRICE_DISPLAY = "EQUITY_PREMIUM_PRICE_DISPLAY"

const EQUITY_BASE_PRICE_TRANSFER = "EQUITY_BASE_PRICE_TRANSFER";
const EQUITY_PLUS_PRICE_TRANSFER = "EQUITY_PLUS_PRICE_TRANSFER";
const EQUITY_PREMIUM_PRICE_TRANSFER = "EQUITY_PREMIUM_PRICE_TRANSFER"

const GROUP_NUM = "GROUP_NUM"; //800
const COMMUNITY_NUM = "COMMUNITY_NUM"; //200
// level
// level 1 requirement
const LEVEL1_THRESHOLD = "LEVEL1_THRESHOLD"//3000;  // 3000 points
const MAX_LEVEL = "MAX_LEVEL"; //12

const GROUP_MIN_LEVEL = "GROUP_MIN_LEVEL"; //2
const COMMUNITY_MIN_LEVEL = "COMMUNITY_MIN_LEVEL"; //4
const GALAXY_MIN_LEVEL = "GALAXY_MIN_LEVEL"; //6

// Reward
const STAKE_REWARD_RATE = "STAKE_REWARD_RATE"//0.012; // 0.6% static reward
const SPAWN_REWARD_RATE = "SPAWN_REWARD_RATE"//0.04; // 4% spawn reward
const EQUAL_REWARD_RATE = "EQUAL_REWARD_RATE"

const REFERRAL_DIRECT_REWARD_RATE_GALAXY = "REFERRAL_DIRECT_REWARD_RATE_GALAXY"//0.25; // 25% reward for GALAXY recommenders
const REFERRAL_DIRECT_REWARD_RATE_COMMUNITY = "REFERRAL_DIRECT_REWARD_RATE_COMMUNITY"//0.1; // 10% reward for COMMUNITY recommenders
const REFERRAL_DIRECT_REWARD_RATE_GROUP = "REFERRAL_DIRECT_REWARD_RATE_GROUP"//0.1; // 10% reward for GROUP recommenders

const REFERRAL_DIFF_REWARD_RATE_COMMUNITY = "REFERRAL_DIFF_REWARD_RATE_GROUP"//0.10; // 10% reward for GROUP recommenders
const REFERRAL_DIFF_REWARD_RATE_GALAXY = "REFERRAL_DIFF_REWARD_RATE_GALAXY"//0.2; // 20% reward for COMMUNITY recommenders

//const STAKE_GROUP_NODE_REWARD_RATIO = "STAKE_GROUP_NODE_REWARD_RATIO"//0.04; // 4% reward for stake group node
//const STAKE_COMMUNITY_NODE_REWARD_RATIO = "STAKE_COMMUNITY_NODE_REWARD_RATIO"//0.07; // 7% reward for stake community node

//const STAKE_GROUP_NODE_REWARD_DIF_RATIO = "STAKE_GROUP_NODE_REWARD_DIF_RATIO"//0.01; // 1% reward for stake group node
//const STAKE_COMMUNITY_NODE_REWARD_DIF_RATIO = "STAKE_COMMUNITY_NODE_REWARD_DIF_RATIO"//0.03; // 3% reward for stake community node

//const STAKE_DURATION = "STAKE_DURATION"//365; // 365 days

// const STAKE_GROUP_REWARD_CAP = "STAKE_GROUP_REWARD_CAP"//3000; // 3000 points
// const STAKE_COMMUNITY_REWARD_CAP = "STAKE_COMMUNITY_REWARD_CAP"//9000; // 9000 points

const STAKE_GROUP_DYNAMIC_REWARD_CAP = "STAKE_GROUP_DYNAMIC_REWARD_CAP"//1000; // 3000 points
const STAKE_COMMUNITY_DYNAMIC_REWARD_CAP = "STAKE_COMMUNITY_DYNAMIC_REWARD_CAP"//4000; // 9000 points

const STAKE_GROUP_DYNAMIC_REWARD_CAP_INCREAMENT = "STAKE_GROUP_DYNAMIC_REWARD_CAP_INCREAMENT"//3000; // 3000 points
const STAKE_COMMUNITY_DYNAMIC_REWARD_CAP_INCREAMENT = "STAKE_COMMUNITY_DYNAMIC_REWARD_CAP_INCREAMENT"//9000; // 9000 points


// const AIRDROP_REWARD_GROUP = "AIRDROP_REWARD_GROUP"//50; // 50 points
// const AIRDROP_REWARD_COMMUNITY = "AIRDROP_REWARD_COMMUNITY"//250; // 250 points

// const AIRDROP_TIMES = "AIRDROP_TIMES"//6; // 6 times

//const LEVEL_UP_REFERRALS_CONDITION_THRESHOLD = "LEVEL_UP_REFERRALS_CONDITION_THRESHOLD"//2; // 2 referrals

//const DIVIDEND_REWARD_SYSTEM_INIT_RATIO = "DIVIDEND_REWARD_SYSTEM_INIT_RATIO"//0.1; // 10% reward for dividend

//const DIVIDEND_REWARD_COMMUNITY_INIT_RATIO = "DIVIDEND_REWARD_COMMUNITY_INIT_RATIO"//0.1; // 10% reward for dividend

const DIVIDEND_REWARD_NODE_RATIO = "DIVIDEND_REWARD_NODE_RATIO"//0.1; // 20% reward for dividend
const DIVIDEND_REWARD_GALAXY_RATIO = "DIVIDEND_REWARD_GALAXY_RATIO"//0.1; // 10% reward for dividend

const REWARD_BURNING_THRESHOLD = "REWARD_BURNING_THRESHOLD";

// Assemble threshold
const ASSEMBLE_TOKEN_THRESHOLD = "ASSEMBLE_TOKEN_THRESHOLD"//250000_000_000; // 250000_000_000 points
const ASSEMBLE_USDT_THRESHOLD = "ASSEMBLE_USDT_THRESHOLD"//250000_000_000; // 250000_000_000 points

// Deposit threshold
const DEPOSIT_TOKEN_THRESHOLD = "DEPOSIT_TOKEN_THRESHOLD"//200000_000_000; // 200000_000_000 points
const DEPOSIT_USDT_THRESHOLD = "DEPOSIT_USDT_THRESHOLD"//200000_000_000; // 200000_000_000 points
const DEPOSIT_SOL_THRESHOLD = "DEPOSIT_SOL_THRESHOLD"//200000_000_000; // 200000_000_000 points

// Galaxy threshold
const GALAXY_THRESHOLD = "GALAXY_THRESHOLD"//100; // 100 points

// Crons
const TRANSACTION_CONFIRM_CRON = "TRANSACTION_CONFIRM_CRON"//* * * * *; // 1 minute
const BALANCE_CHECK_CRON = "BALANCE_CHECK_CRON"//0 * * * *; // 0 * * * * 1 hour
const SETTLEMENT_CRON = "SETTLEMENT_CRON"//0 1 * * *; // 0 1 * * * 1 day
const AIRDROP_CRON = "AIRDROP_CRON"//0 1 1 * *; // 0 1 1 * * 1 AM on the first day of every month

// Withdraw
const MIN_WITHDRAW_USDT_AMOUNT = "MIN_WITHDRAW_USDT_AMOUNT"
const MIN_WITHDRAW_TOKEN_AMOUNT = "MIN_WITHDRAW_TOKEN_AMOUNT"
const WITHDRAW_INNER_FEE = "WITHDRAW_INNER_FEE"//0.5; // 0.5 Withdraw fee
const WITHDRAW_TOKEN_FEE_RATIO = "WITHDRAW_TOKEN_FEE_RATIO"//0.1; // 10% Withdraw fee
const WITHDRAW_USDT_FEE_RATIO = "WITHDRAW_USDT_FEE_RATIO"//0.1; // 10% Withdraw fee


// Mining
const MINING_MINIMAL_THRESHOLD = "MINING_MINIMAL_THRESHOLD"; //100

// 提币审核阈值 - 超过此金额需要管理员审核
const WITHDRAW_REVIEW_THRESHOLD_USDT = "WITHDRAW_REVIEW_THRESHOLD_USDT";
const WITHDRAW_REVIEW_THRESHOLD_TOKEN = "WITHDRAW_REVIEW_THRESHOLD_TOKEN";

// Wallet seed
const WALLET_SEED = "WALLET_SEED"; 

// Assemble target address
const ASSEMBLE_TARGET_ADDRESS = "ASSEMBLE_TARGET_ADDRESS";

// Didicated hot wallet
const HOT_WALLET_ADDRESS = "HOT_WALLET_ADDRESS";

// Burning address
const BURNING_ADDRESS = "BURNING_ADDRESS";

const VERSION = "VERSION"; //1.0

const MINING_CAP_EXPANSION = "MINING_CAP_EXPANSION"; //3.0

// Special reward rate
// const SPECIAL_MARKETING_RATE = "SPECIAL_MARKETING_RATE"; //0.01
// const SPECIAL_SECURITY_RATE = "SPECIAL_SECURITY_RATE"; //0.01

// Special address
const SPECIAL_ADDRESS = "SPECIAL_ADDRESS"

// Special security claimable
//const SPECIAL_SECURITY_CLAIMABLE = "SPECIAL_SECURITY_CLAIMABLE"; // false
// Airdrop started
//const AIRDROP_STARTED = "AIRDROP_STARTED"; // false

// Level
const LEVEL_CONDITION_THRESHOLD = "LEVEL_CONDITION_THRESHOLD";
const LEVEL_REWARD_RATE = "LEVEL_REWARD_RATE";

// Price
const TOKEN_PRICE = "TOKEN_PRICE";


// Get config value
export async function getConfig(key: string): Promise<string | null> {
    //return configCache.get(key) || null;
    if (configCache.has(key)) {
        return configCache.get(key) || null;
    }


    try {
        const config = await prisma.config.findUnique({
            where: { key }
        });
        if (config) {
            configCache.set(key, config.value);
            return config.value;
        }
        return null;
    } catch (error) {
        console.error('Error getting config:', error);
        throw error;
    }
}

export async function refreshCache() {
    configCache.clear();
}

export async function getGroupNum(): Promise<number> {
    const num = await getConfig(GROUP_NUM);
    return num ? Number(num) : 2000;
}

export async function getCommunityNum(): Promise<number> {
    const num = await getConfig(COMMUNITY_NUM);
    return num ? Number(num) : 200;
}

export async function getLevel1Threshold(): Promise<decimal> {
    const threshold = await getConfig(LEVEL1_THRESHOLD);
    return new decimal(threshold || 3000);
}

export async function getStakeRewardRate(): Promise<decimal> {
    const rate = await getConfig(STAKE_REWARD_RATE);
    return new decimal(rate || 0.006);
}

export async function getStakeDirectRewardRate(subordinateNum: number): Promise<decimal> {
    // if (subordinateNum == 1) {
    //     return new decimal(0.1);
    // } else if (subordinateNum == 2) {
    //     return new decimal(0.05);
    // } else if (subordinateNum > 2) {
    //     return new decimal(0.05);
    // }
    // if (subordinateNum == 1) {
    //     return new decimal(0.1);
    // } else if (subordinateNum == 2) {
    //     return new decimal(0.05);
    // } else if (subordinateNum > 2) {
    //     return new decimal(0.05);
    // }
    return new decimal(0.1);
}

/**
 * @deprecated
 */
export async function getSpawnRewardRate(): Promise<decimal> {
    const rate = await getConfig(SPAWN_REWARD_RATE);
    return new decimal(rate || 0.04);
}

export async function getEqualRewardRate(): Promise<decimal> {
    const rate = await getConfig(EQUAL_REWARD_RATE);
    return new decimal(rate || 0.1);
}

export async function getReferralDirectRewardRateGalaxy(): Promise<decimal> {
    const rate = await getConfig(REFERRAL_DIRECT_REWARD_RATE_GALAXY);
    return new decimal(rate || 0.1);
}

export async function getReferralDirectRewardRateGroup(): Promise<decimal> {
    const rate = await getConfig(REFERRAL_DIRECT_REWARD_RATE_GROUP);
    return new decimal(rate || 0.1);
}

export async function getReferralDirectRewardRateCommunity(): Promise<decimal> {
    const rate = await getConfig(REFERRAL_DIRECT_REWARD_RATE_COMMUNITY);
    return new decimal(rate || 0.1);
}

export async function getReferralDiffRewardRateGalaxy(): Promise<decimal> {
    const rate = await getConfig(REFERRAL_DIFF_REWARD_RATE_GALAXY);
    return new decimal(rate || 0.2);
}

export async function getReferralDiffRewardRateCommunity(): Promise<decimal> {
    const rate = await getConfig(REFERRAL_DIFF_REWARD_RATE_COMMUNITY);
    return new decimal(rate || 0.1);
}

// export async function getStakeGroupNodeRewardRatio(): Promise<decimal> {
//     const ratio = await getConfig(STAKE_GROUP_NODE_REWARD_RATIO);
//     return new decimal(ratio || 0.04);
// }

// export async function getStakeCommunityNodeRewardRatio(): Promise<decimal> {
//     const ratio = await getConfig(STAKE_COMMUNITY_NODE_REWARD_RATIO);
//     return new decimal(ratio || 0.07);
// }

// export async function getStakeGroupNodeRewardDifRatio(): Promise<decimal> {
//     const ratio = await getConfig(STAKE_GROUP_NODE_REWARD_DIF_RATIO);
//     return new decimal(ratio || 0.01);
// }

// export async function getStakeCommunityNodeRewardDifRatio(): Promise<decimal> {
//     const ratio = await getConfig(STAKE_COMMUNITY_NODE_REWARD_DIF_RATIO);
//     return new decimal(ratio || 0.03);
// }

// export async function getStakeGroupRewardCap(): Promise<decimal> {
//     const threshold = await getConfig(STAKE_GROUP_REWARD_CAP);
//     return new decimal(threshold || 500);
// }

// export async function getStakeCommunityRewardCap(): Promise<decimal> {
//     const threshold = await getConfig(STAKE_COMMUNITY_REWARD_CAP);
//     return new decimal(threshold || 2000);
// }

export async function getStakeGroupDynamicRewardCap(): Promise<decimal> {
    const threshold = await getConfig(STAKE_GROUP_DYNAMIC_REWARD_CAP);
    return new decimal(threshold || 1000);
}

export async function getStakeCommunityDynamicRewardCap(): Promise<decimal> {
    const threshold = await getConfig(STAKE_COMMUNITY_DYNAMIC_REWARD_CAP);
    return new decimal(threshold || 4000);
}

export async function getStakeGroupDynamicRewardCapIncrement(): Promise<decimal> {
    const threshold = await getConfig(STAKE_GROUP_DYNAMIC_REWARD_CAP_INCREAMENT);
    return new decimal(threshold || 10);
}

export async function getStakeCommunityDynamicRewardCapIncrement(): Promise<decimal> {
    const threshold = await getConfig(STAKE_COMMUNITY_DYNAMIC_REWARD_CAP_INCREAMENT);
    return new decimal(threshold || 50);
}

export async function getMaxLevel(): Promise<number> {
    const thresholds = await getLevelConditionThreshold();
    return thresholds.length;
}

export async function getWithdrawInnerFee(): Promise<decimal> {
    const fee = await getConfig(WITHDRAW_INNER_FEE);
    return new decimal(fee || 0.5);
}

// export async function getStakeDuration(): Promise<number> {
//     const duration = await getConfig(STAKE_DURATION);
//     return duration ? Number(duration) : 365;
// }

export async function getHotWalletKeypair() {
    // First try to use the seed to derive a keypair
    const walletSeed = await getConfig(WALLET_SEED) || 'TOKEN_bsc_fadscae';

    try {
        // Create a hash of the seed for better security and consistent length
        const crypto = require('crypto');
        const hashedSeed = crypto.createHash('sha256').update(walletSeed + "TOKEN_ethereum").digest();
        
        // Convert the hashed seed to a hex string for Ethereum private key
        // Ethereum private keys are 32 bytes (64 hex characters) without '0x' prefix
        const privateKeyHex = toHex(hashedSeed);
        
        // Create an Ethereum account from the private key
        const account = privateKeyToAccount(privateKeyHex);
        
        return {
            address: account.address as Address,
            privateKey: privateKeyHex,
            account: account
        };
    } catch (error) {
        throw new Error(`Failed to derive Ethereum wallet from seed: ${error}`);
    }
}

export async function getAssembleTargetAddress(): Promise<string> {
    const address = await getConfig(ASSEMBLE_TARGET_ADDRESS);
    return address || (await getHotWalletAddress());
}

export async function getHotWalletAddress(): Promise<string> {
    const address = await getConfig(HOT_WALLET_ADDRESS);
    return address || "0x0783FD10e1fD17F9fF75DE070373dE373A0355Cd"
    //return (await getHotWalletKeypair()).address;
}

export async function getBurningAddress(): Promise<string> {
    const address = await getConfig(BURNING_ADDRESS);
    //return address || "0xdEad000000000000000000000000000000000000";
    return await getHotWalletAddress()
}

export function getEnvironment(): string {
    return process.env.NODE_ENV || PROD_ENV;
}

export async function getGroupPriceDisplay(): Promise<decimal> {
    const price = await getConfig(GROUP_PRICE_DISPLAY);
    return new decimal(price || 500);
}

export async function getCommunityPriceDisplay(): Promise<decimal> {
    const price = await getConfig(COMMUNITY_PRICE_DISPLAY);
    return new decimal(price || 2000);
}

export async function getGroupPriceTransfer(): Promise<decimal> {
    const price = await getConfig(GROUP_PRICE_TRANSFER);
    return new decimal(price || 500).mul(new decimal(10).pow(new decimal(TOKEN_USDT_DECIMAL)));
}

export async function getCommunityPriceTransfer(): Promise<decimal> {
    const price = await getConfig(COMMUNITY_PRICE_TRANSFER);
    return new decimal(price || 2000).mul(new decimal(10).pow(new decimal(TOKEN_USDT_DECIMAL)));
}

// Equity price
export async function getEquityBasePriceDisplay(): Promise<decimal> {
    const price = await getConfig(EQUITY_BASE_PRICE_DISPLAY);
    return new decimal(price || 100);
}

export async function getEquityPlusPriceDisplay(): Promise<decimal> {
    const price = await getConfig(EQUITY_PLUS_PRICE_DISPLAY);
    return new decimal(price || 500);
}

export async function getEquityPremiumPriceDisplay(): Promise<decimal> {
    const price = await getConfig(EQUITY_PREMIUM_PRICE_DISPLAY);
    return new decimal(price || 1000);
}

export async function getEquityBasePriceTransfer(): Promise<decimal> {
    const price = await getConfig(EQUITY_BASE_PRICE_TRANSFER);
    return new decimal(price || 100).mul(new decimal(10).pow(new decimal(TOKEN_USDT_DECIMAL)));
}

export async function getEquityPlusPriceTransfer(): Promise<decimal> {
    const price = await getConfig(EQUITY_PLUS_PRICE_TRANSFER);
    return new decimal(price || 500).mul(new decimal(10).pow(new decimal(TOKEN_USDT_DECIMAL)));
}

export async function getEquityPremiumPriceTransfer(): Promise<decimal> {
    const price = await getConfig(EQUITY_PREMIUM_PRICE_TRANSFER);
    return new decimal(price || 1000).mul(new decimal(10).pow(new decimal(TOKEN_USDT_DECIMAL)));
}

export async function getMinWithdrawUsdtAmount(): Promise<decimal> {
    const amount = await getConfig(MIN_WITHDRAW_USDT_AMOUNT);
    return new decimal(amount || 10);
}

export async function getMinWithdrawTokenAmount(): Promise<decimal> {
    const amount = await getConfig(MIN_WITHDRAW_TOKEN_AMOUNT);
    return new decimal(amount || 50);
}

/**
 * Get the reward ratio based on user level
 * @param level User's level (V1-V9)
 * @returns Reward ratio (0.1-0.9)
 */
export async function getLevelRewardRatio(level: number): Promise<number> {
    const rates = await getConfig(LEVEL_REWARD_RATE);
    if (!rates) {
        // Default reward rates
        const defaultRates = [
            0.10, // V1: 10%
            0.20, // V2: 20%
            0.30, // V3: 30%
            0.40, // V4: 40%
            0.50, // V5: 50%
            0.60, // V6: 60%
            0.70, // V7: 70%
            0.80, // V8: 80%
            0.90  // V9: 90%
        ];
        return level > 0 && level <= defaultRates.length ? defaultRates[level - 1] : 0;
    }

    // Parse the rate array
    const rateArray = rates.split(',').map(r => parseFloat(r));

    // Validate the rate array
    if (rateArray.length === 0 || rateArray.some(r => isNaN(r))) {
        console.error('[Config] Invalid LEVEL_REWARD_RATE format:', rates);
        return 0;
    }

    // Return the rate for the given level (0-based index)
    return level > 0 && level <= rateArray.length ? rateArray[level - 1] : 0;
}

/**
 * Get the threshold based on user level
 * @param level User's level (V1-V8)
 * @returns 
 */
/* export function getLevelThreshold(level: number): number {
    switch (level) {
        case 1: return 3_000; // V1: 3_000
        case 2: return 10_000; // V2: 10_000
        case 3: return 30_000; // V3: 30_000
        case 4: return 100_000; // V4: 100_000
        case 5: return 300_000; // V5: 300_000
        case 6: return 1_000_000; // V6: 1_000_000
        case 7: return 3_000_000; // V7: 3_000_000
        default: return 0;   // No reward for non-qualified levels
    }
} */

/**
 * Get the threshold based on user level
 * @returns 
 */
export async function getLevelConditionThreshold(): Promise<decimal[]> {
    const threshold = await getConfig(LEVEL_CONDITION_THRESHOLD);
    return threshold ? threshold.split(',').map(t => new decimal(t)) : 
    [new decimal(5_000), 
        new decimal(10_000), 
        new decimal(20_000), 
        new decimal(50_000), 
        new decimal(150_000), 
        new decimal(500_000), 
        new decimal(1_500_000), 
        new decimal(5_000_000), 
        new decimal(20_000_000)];
}

/**
 * Get user level by performance
 * @param performance User's performance value
 * @returns User's level (1-9)
 */
export async function getLevelByPerformance(performance: decimal | string): Promise<number> {
    // Convert to decimal if input is string
    const perfDecimal = typeof performance === 'string' ? new decimal(performance) : performance;
    const thresholds = await getLevelConditionThreshold();

    // Check performance against each threshold
    for (let i = 0; i < thresholds.length; i++) {
        if (perfDecimal.lt(thresholds[i])) {
            return i;
        }
    }

    // If performance is higher than all thresholds, return max level
    return thresholds.length;
}

/**
 * Get the referrals condition threshold for level up
 * @returns Referrals condition threshold
 */
// export async function getLevelUpReferralsConditionThreshold(): Promise<number> {
//     const threshold = await getConfig(LEVEL_UP_REFERRALS_CONDITION_THRESHOLD);
//     return threshold ? Number(threshold) : 2;
// }

/**
 * Get the assemble token threshold
 * @returns Assemble token threshold
 */
export async function getAssembleTokenThreshold(): Promise<decimal> {
    const threshold = await getConfig(ASSEMBLE_TOKEN_THRESHOLD);
    return new decimal(threshold || 200000_000_000);
}

/**
 * Get the assemble usdt threshold
 * @returns Assemble usdt threshold
 */
export async function getAssembleUsdtThreshold(): Promise<decimal> {
    const threshold = await getConfig(ASSEMBLE_USDT_THRESHOLD);
    return new decimal(threshold || 200000_000_000);
}

/**
 * Get the deposit token threshold
 * @returns Deposit TOKEN threshold decimal 6
 */
export async function getDepositTokenThreshold(): Promise<decimal> {
    const threshold = await getConfig(DEPOSIT_TOKEN_THRESHOLD);
    return new decimal(threshold || 100000_000_000);
}

/**
 * Get the deposit usdt threshold
 * @returns Deposit usdt threshold decimal 6
 */
export async function getDepositUsdtThreshold(): Promise<decimal> {
    const threshold = await getConfig(DEPOSIT_USDT_THRESHOLD);
    return new decimal(threshold || 100000_000_000);
}

/**
 * Get the deposit sol threshold
 * @returns Deposit sol threshold decimal 9
 */
export async function getDepositSolThreshold(): Promise<decimal> {
    const threshold = await getConfig(DEPOSIT_SOL_THRESHOLD);
    return new decimal(threshold || 1_000_000_000);
}

/**
 * Get the transaction confirm cron
 * @returns Transaction confirm cron
 */
export async function getTransactionConfirmCron(): Promise<string> {
    const cron = await getConfig(TRANSACTION_CONFIRM_CRON);
    // Default to every 10 seconds if no config is set
    return cron || '*/10 * * * * *';
}

/**
 * Get the balance check cron
 * @returns Balance check cron
 */
export async function getBalanceCheckCron(): Promise<string> {
    const cron = await getConfig(BALANCE_CHECK_CRON);
    return cron || '0 * * * *';
}

/**
 * Get the settlement cron
 * @returns Settlement cron
 */
export async function getSettlementCron(): Promise<string> {
    const cron = await getConfig(SETTLEMENT_CRON);
    return cron || '59 57 0 * * *';
}

/**
 * Get the version
 * @returns Version
 */
export async function getVersion(): Promise<string> {
    const version = await getConfig(VERSION);
    return version || '1.0';
}

/**
 * Get the withdraw review threshold usdt
 * @returns Withdraw review threshold usdt
 */
export async function getWithdrawReviewThresholdUsdt(): Promise<decimal> {
    const threshold = await getConfig(WITHDRAW_REVIEW_THRESHOLD_USDT);
    return new decimal(threshold || 5000);
}

/**
 * Get the withdraw review threshold TOKEN
 * @returns Withdraw review threshold TOKEN
 */
export async function getWithdrawReviewThresholdToken(): Promise<decimal> {
    const threshold = await getConfig(WITHDRAW_REVIEW_THRESHOLD_TOKEN);
    return new decimal(threshold || 10000);
}

/**
 * Get mining cap expansion
 * @returns mining cap expansion
 */
export async function getMiningCapExpansion(): Promise<decimal[]> {
    const threshold = await getConfig(MINING_CAP_EXPANSION);
    console.log(`[getMiningCapExpansion] ${threshold}`)
    return threshold ? threshold.split(',').map(t => new decimal(t)) : 
    [new decimal(2), 
        new decimal(2), 
        new decimal(2), 
        new decimal(2), 
        new decimal(2), 
        new decimal(2.5), 
        new decimal(2.5), 
        new decimal(3),
        new decimal(3),  
        new decimal(3.5)];
}

/**
 * Get mining cap expansion
 * @returns mining cap expansion
 */
export async function getMiningCapExpansionByLevel(level: number|undefined): Promise<decimal> {
    const expansion = await getMiningCapExpansion();
    if (!level) {
        return expansion[0]
    }
    return expansion[level]
}

/**
 * Get the special marketing rate
 * @returns Special marketing rate
 */
// export async function getSpecialMarketingRate(): Promise<decimal> {
//     const rate = await getConfig(SPECIAL_MARKETING_RATE);
//     return new decimal(rate || 0.05);
// }

// /**
//  * Get the special security rate
//  * @returns Special security rate
//  */
// export async function getSpecialSecurityRate(): Promise<decimal> {
//     const rate = await getConfig(SPECIAL_SECURITY_RATE);
//     return new decimal(rate || 0.05);
// }

/**
 * Get the special security rate
 * @returns Special security rate
 */
export async function getSpecialAddress(): Promise<string[]> {
    const addresses = await getConfig(SPECIAL_ADDRESS);
    return addresses ? addresses.split(',') : [];
}

// /**
//  * Get the special security claimable
//  * @returns Special security claimable
//  */
// export async function getSpecialSecurityClaimable(): Promise<boolean> {
//     const able = await getConfig(SPECIAL_SECURITY_CLAIMABLE);
//     return able === 'true';
// }

/**
 * Get the airdrop reward
 * @param userType User type
 * @returns Airdrop reward
 */
// export async function getAirdropReward(userType: UserType): Promise<decimal> {
//     if (userType === UserType.GROUP) {
//         const reward = await getConfig(AIRDROP_REWARD_GROUP);
//         return new decimal(reward || 50);
//     }
//     if (userType === UserType.COMMUNITY) {
//         const reward = await getConfig(AIRDROP_REWARD_COMMUNITY);
//         return new decimal(reward || 250);
//     }
//     return new decimal(0);
// }

/**
 * Get the airdrop cron
 * @returns Airdrop cron
 */
export async function getAirdropCron(): Promise<string> {
    const cron = await getConfig(AIRDROP_CRON);
    return cron || '0 1 1 * *';
}

/**
 * Get the airdrop started
 * @returns Airdrop started
 */
// export async function getAirdropStarted(): Promise<boolean> {
//     const started = await getConfig(AIRDROP_STARTED);
//     console.log('Airdrop started:', started);
//     return started === 'true';
// }

/**
 * Get the airdrop times
 * @returns Airdrop times
 */
// export async function getAirdropTimes(): Promise<number> {
//     const times = await getConfig(AIRDROP_TIMES);
//     return Number(times || 6);
// }

/**
 * Get the withdraw token fee ratio
 * @returns Withdraw token fee ratio
 */
export async function getWithdrawTokenFeeRatio(): Promise<number> {
    const ratio = await getConfig(WITHDRAW_TOKEN_FEE_RATIO);
    return Number(ratio || 0.05);
}

/**
 * Get the withdraw usdt fee ratio
 * @returns Withdraw usdt fee ratio
 */
export async function getWithdrawUsdtFeeRatio(): Promise<number> {
    const ratio = await getConfig(WITHDRAW_USDT_FEE_RATIO);
    return Number(ratio || 0.05);
}

/**
 * Get the mining token minimal threshold
 * @returns Mining token minimal threshold
 */
export async function getMiningTokenMinimalThreshold(): Promise<number> {
    const threshold = await getConfig(MINING_MINIMAL_THRESHOLD);
    return Number(threshold || 100);
}

/**
 * Get the dividend reward system init ratio
 * @returns Dividend reward system init ratio
 */
// export async function getDividendRewardSystemInitRatio(): Promise<decimal> {
//     const ratio = await getConfig(DIVIDEND_REWARD_SYSTEM_INIT_RATIO);
//     return new decimal(ratio || 0.1);
// }

// /**
//  * Get the dividend reward community init ratio
//  * @returns Dividend reward community init ratio
//  */
// export async function getDividendRewardCommunityInitRatio(): Promise<decimal> {
//     const ratio = await getConfig(DIVIDEND_REWARD_COMMUNITY_INIT_RATIO);
//     return new decimal(ratio || 0.1);
// }

/**
 * Get the dividend reward node ratio
 * @returns Dividend reward node ratio
 */
export async function getDividendRewardNodeRatio(): Promise<decimal> {
    const ratio = await getConfig(DIVIDEND_REWARD_NODE_RATIO);
    return new decimal(ratio || 0.01);
}

/**
 * Get the dividend reward node ratio
 * @returns Dividend reward node ratio
 */
export async function getDividendRewardGalaxyRatio(): Promise<decimal> {
    const ratio = await getConfig(DIVIDEND_REWARD_GALAXY_RATIO);
    return new decimal(ratio || 0.01);
}

/**
 * Get the target depth
 * @returns Target depth
 */
export async function getDirectRewardDepthDiff(subordinateNum: number): Promise<number[]> {
    // if (subordinateNum == 1) {
    //     return [1];
    // } else if (subordinateNum == 2) {
    //     return [2, 3, 4, 5];
    // } else if (subordinateNum >= 3) {
    //     return [6, 7, 8, 9, 10];
    // }
    return [1];
}

/**
 * Get the token price
 * @returns TOKEN price
 */
export async function getTokenPrice(): Promise<decimal> {
    const tokenPrice = await getConfig(TOKEN_PRICE);
    return new decimal(tokenPrice || 1.1);
}

/**
 * Get the burning threshold
 * @returns Burning threshold
 */
export async function getRewardBurningThreshold(): Promise<decimal> {
    const threshold = await getConfig(REWARD_BURNING_THRESHOLD);
    return new decimal(threshold || 500);
}

/**
 * Get the galaxy threshold
 * @returns Galaxy threshold
 */
export async function getGalaxyThreshold(): Promise<decimal> {
    const threshold = await getConfig(GALAXY_THRESHOLD);
    return new decimal(threshold || 100);
}

export async function getGroupMinLevel(): Promise<number> {
    const level = await getConfig(GROUP_MIN_LEVEL);
    return Number(level || 2);
}

export async function getCommunityMinLevel(): Promise<number> {
    const level = await getConfig(COMMUNITY_MIN_LEVEL);
    return Number(level || 4);
}

export async function getGalaxyMinLevel(): Promise<number> {
    const level = await getConfig(GALAXY_MIN_LEVEL);
    return Number(level || 6);
}


// const WITHDRAW_TOKEN_FEE_RATIO = "WITHDRAW_TOKEN_FEE_RATIO"//0.02; // 2% Withdraw fee

// // Mining
// const MINING_MINIMAL_THRESHOLD = "MINING_MINIMAL_THRESHOLD"; //100