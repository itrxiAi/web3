import cron from 'node-cron';
//import { reRankAllUsers } from '@/tasks/user';
//import { calculateAllStaticRewards, cleanPerformanceHistory, handleDividendRewardBatch, handleDynamicRewardCap, updateDynamicRewards } from './reward';
import { handleTxConfirmBatch, handleTxSendingBatch } from '@/tasks/transactions';
import '@/utils/logger';
import { getAirdropCron, getSettlementCron, getTransactionConfirmCron } from '@/lib/config';
import prisma from '@/lib/prisma';
import { getSettlementStatus, setSettlementStatus } from '@/lib/taskCache';
import { TASK_COMPLETED, TASK_RUNNING } from '@/constants';
//import { processTokenPrice } from './tokenPrice';

// Use a global variable to track initialization across all instances
declare global {
  var cronJobsInitialized: boolean;
  var settlementRunning: boolean;
}

// Initialize global variables if they don't exist
if (typeof global.cronJobsInitialized === 'undefined') {
  global.cronJobsInitialized = false;
}

if (typeof global.settlementRunning === 'undefined') {
  global.settlementRunning = false;
}

export async function initCronJobs() {
  // Check the global initialization flag
  if (global.cronJobsInitialized) {
    console.log('Cron jobs already initialized')
    return;
  }
  console.log('Initializing cron jobs...');

  const txConfirmCron = await getTransactionConfirmCron();
  const settlementCron = await getSettlementCron();
  const airdropCron = await getAirdropCron();

  console.log(`Transaction confirm cron: ${txConfirmCron}, settlement cron: ${settlementCron}, airdrop cron: ${airdropCron}`)

  // Process transactions confirm every minute
  cron.schedule(txConfirmCron, async () => {
    try {
      await handleTxConfirmBatch();
      //await handleTxSendingBatch();
      //await processTokenPrice();
    } catch (error) {
      console.error(`Error running transaction processor: ${error}`);
    }
  });

  // Process airdrop every month
  /* cron.schedule(airdropCron, async () => {
    console.log(`Running airdrop processor... ${new Date()}`);
    try {
      await handleAirdropRewardBatch();
    } catch (error) {
      console.error(`Error running airdrop processor: ${error}`);
    }
  }); */

  // Process balance check every hour
  // cron.schedule(balanceCheckCron, async () => {
  //   console.log('Running balance check...');
  //   await balanceCheck();
  // });

  // Settlement every day
  cron.schedule(settlementCron, async () => {
    try {
      await settlement();
    } catch (error) {
      console.error(`Error running settlement: ${error}`);
    }
  }, {
    timezone: 'UTC'
  });
  // Set the global initialization flag
  global.cronJobsInitialized = true;
}


export async function settlement(utcYear?: number, utcMonth?: number, utcDay?: number) {
  const executedAt = new Date();
  const year = utcYear ?? executedAt.getUTCFullYear();
  const month = utcMonth ?? executedAt.getUTCMonth() + 1;
  const day = utcDay ?? executedAt.getUTCDate();
  const status = await getSettlementStatus(year, month, day);
  if (status === TASK_RUNNING || status === TASK_COMPLETED) {
    console.log(`settlement already running at ${new Date()}, settlement date: ${year}-${month}-${day}`);
    return;
  }
  await setSettlementStatus(year, month, day, TASK_RUNNING);
  console.log(`settlement started at ${new Date()}, settlement date: ${year}-${month}-${day}`);
  //await handleDividendRewardBatch(year, month, day);
  //await handleDynamicRewardCap(year, month, day);
  // Temporarily disabled

  //await reRankAllUsers(year, month, day);
  // should be enabled later
  // await calculateAllStaticRewards(year, month, day);
  // await updateDynamicRewards(year, month, day);
  // await cleanPerformanceHistory();
  await setSettlementStatus(year, month, day, TASK_COMPLETED);
  console.log(`settlement completed at ${new Date()}`)

}
