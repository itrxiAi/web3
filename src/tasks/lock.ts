import { TokenType, Transaction, TxFlowStatus, TxFlowType } from "@prisma/client";
import { isTransactionFinalized } from "@/utils/chain";
import prisma from "@/lib/prisma";
// import { cleanUserMiningLevelPerformanceCache, updateSuperiorNodeReward } from "@/lib/user";
// import { processBalanceUpdate } from "@/lib/balance";

export async function processLockTx(tx: Transaction) {
  if (!tx || tx.status !== TxFlowStatus.PENDING || tx.type !== TxFlowType.PURCHASE || !tx.txHash) {
    return;
  }

  const { status, fee, error } = await isTransactionFinalized(tx.txHash, tx.createdAt.getTime());

  console.debug('Processing lock transaction:', tx.txHash, { status, fee, error });
  if (status === TxFlowStatus.PENDING) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: {
      walletAddress: tx.fromAddress
    },
    select: {
      superior: true,
      type: true,
      path: true
    }
  });


  if (!user) {
    console.error('User not found:', tx.fromAddress);
    return;
  }

  await prisma.$transaction(async (prisma) => {



    if (status === TxFlowStatus.FAILED) {

      // Update tx_flow status to confirmed
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: status,
          txFee: fee,
          description: JSON.stringify({ "error": error })
        }
      });
      await prisma.user.update({
        where: {
          walletAddress: tx.fromAddress.toLowerCase()
        },
        data: {
          type: null
        }
      });
      return
    } else if (status === TxFlowStatus.CONFIRMED && user.superior && user.type) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: status,
          txFee: fee,
          description: JSON.stringify({ "rewarded": true })
        }
      });
      
      // await updateSuperiorNodeReward({
      //   walletAddress: tx.from_address.toLowerCase(),
      //   superiorAddress: user.superior,
      //   type: user.type,
      //   tx: prisma
      // });
    } else if (status === TxFlowStatus.CONFIRMED) {
      // await processBalanceUpdate({
      //   address: tx.from_address,
      //   amount: tx.amount,
      //   type: TxFlowType.STAKE,
      //   tokenType: TokenType.TXT,
      // }, prisma);
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: status,
          txFee: fee,
        }
      });
    }
  });
  //await cleanUserMiningLevelPerformanceCache(tx.from_address)
}