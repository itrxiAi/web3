import { TxFlowStatus, TxFlowType } from "@prisma/client";
import prisma from "@/lib/prisma";
//import { processOutTx } from "@/tasks/out";
import { processLockTx } from "@/tasks/lock";
//import { processMiningTx } from "@/tasks/mining";
//import { auditionOutBatch } from "@/lib/balance";
import { processEquityTx } from "./equity";


/**
 * handleInOutPointsBatch
 */
export async function handleTxSendingBatch() {
  //await auditionOutBatch();
}

/**
 * handleInOutPointsBatch
 */
export async function handleTxConfirmBatch() {

  // Get the tx_flow record
  const txs = await prisma.transaction.findMany({
    where: {
      type: {
        in: [TxFlowType.PURCHASE, TxFlowType.DEPOSIT, TxFlowType.EQUITY, TxFlowType.WITHDRAW]
      },
      status: TxFlowStatus.PENDING,
      txHash: {
        not: ''
      },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        lte: new Date(Date.now() - 10 * 1000) // Wait 10 seconds to ensure transaction is finalized
      }
    },
    take: 100
  });

  if (txs.length === 0) {
    return null;
  }

  console.log(`Processing ${txs.length} transactions...`);
  for (const tx of txs) {
    if (!tx.txHash) {
      continue;
    }

    await processLockTx(tx);
    await processEquityTx(tx);
    // await processOutTx(tx);
    // await processMiningTx(tx);

  }
}

/**
 * 
 * @param txHash 
 */
export async function manualTxConfirm(txHash: string) {
  const tx = await prisma.transaction.findFirst({
    where: {
      txHash: txHash
    }
  });

  if (!tx) {
    throw new Error('Transaction not found: ' + txHash);
  }

  await processLockTx(tx);
  await processEquityTx(tx);
  // await processOutTx(tx);
  // await processMiningTx(tx);

}

// export interface BalanceCheckResult {
//   status: 'ok' | 'warning';
//   messages: string[];
//   balances: {
//     usdt: {
//       current: string;
//       min: string;
//       max: string;
//       isWithinLimits: boolean;
//     };
//     token: {
//       current: string;
//       min: string;
//       max: string;
//       isWithinLimits: boolean;
//     };
//   };
// }