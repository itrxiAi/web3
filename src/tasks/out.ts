// import { transaction, TxFlowStatus, TxFlowType } from "@prisma/client";
// import { isTransactionFinalized } from "@/utils/chain";
// import prisma from "@/lib/prisma";
// import { processBalanceUpdate } from "@/lib/balance";


// export async function processOutTx(tx: transaction) {
//   if (!tx || tx.status !== TxFlowStatus.PENDING || (tx.type !== TxFlowType.OUT && tx.type !== TxFlowType.ASSEMBLE && tx.type !== TxFlowType.BURNING) || !tx.tx_hash) {
//     return;
//   }

//   const { status, fee, error } = await isTransactionFinalized(tx.tx_hash, tx.created_at.getTime());

//   if (status === TxFlowStatus.PENDING) {
//     return;
//   }

//   // Update tx_flow status to confirmed
//   await prisma.transaction.update({
//     where: { id: tx.id },
//     data: {
//       status: status,
//       tx_fee: fee
//     }
//   });
// }

// export async function manualOutAbort(txId: number, pointsBack: boolean) {
//     const tx = await prisma.transaction.findUnique({
//       where: {
//         id: txId,
//         type: TxFlowType.OUT,
//         status: TxFlowStatus.FAILED
//       }
//     });
//     if (!tx) {
//       return false
//     }
//     const amount = tx.amount_fee ? tx.amount.add(tx.amount_fee) : tx.amount;
//     const type = tx.token_type;
//     if (pointsBack) {
//       await processBalanceUpdate({
//         address: tx.from_address,
//         amount,
//         tokenType: type,
//         type: TxFlowType.IN // Since we're adding points back, this is an incoming transaction
//       }, prisma);
//     }
//     await prisma.transaction.update({
//       where: { id: txId },
//       data: {
//         status: TxFlowStatus.ABORT
//       }
//     });
//     return true
//   }