import { PublicKey } from '@solana/web3.js';

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// USDT amounts for membership types (9 decimals)
// export const GROUP_AMOUNT = 1_000_000_000;     // 1000 USDT
// export const COMMUNITY_AMOUNT = 3_000_000_000;  // 3000 USDT

// export const GROUP_POINTS = 1000 // 1000 points
// export const COMMUNITY_POINTS = 3000; // 3000 points

// Membership types
export const GROUP_TYPE = 'GROUP' as const;
export const COMMUNITY_TYPE = 'COMMUNITY' as const;
export const NORMAL_TYPE = 'NORMAL' as const;
export const EQUITY_BASE_TYPE = 'BASE' as const;
export const EQUITY_PLUS_TYPE = 'PLUS' as const;
export const EQUITY_PREMIUM_TYPE = 'PREMIUM' as const;
export const VERIFIER_1 = 'VERIFIER1' as const;
export const VERIFIER_2 = 'VERIFIER2' as const;
export const VERIFIER_3 = 'VERIFIER3' as const;
export const VERIFIER_4 = 'VERIFIER4' as const;

export type MembershipType = typeof GROUP_TYPE | typeof COMMUNITY_TYPE | typeof NORMAL_TYPE | typeof EQUITY_BASE_TYPE | typeof EQUITY_PLUS_TYPE | typeof EQUITY_PREMIUM_TYPE | typeof VERIFIER_1 | typeof VERIFIER_2 | typeof VERIFIER_3 | typeof VERIFIER_4;

// environment
export const DEV_ENV = 'development';
export const PROD_ENV = 'production';

// Operation time gap
export const MAX_TIMESTAMP_GAP_MS = 20000; // 20 seconds in milliseconds

// timeout
export const MAX_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// rate limit
export const MAX_REQUESTS_PER_SECOND = 20; // Adjust as needed

// data
export const DB_BATCH = 2;

// operations
export const UPDATE_REFERRAL = 'UPDATE_REFERRAL' as const;

// Decimal
export const TOKEN_DECIMAL = 18;

// TASK
export const TASK_RUNNING = 'running' as const;
export const TASK_COMPLETED = 'completed' as const;







