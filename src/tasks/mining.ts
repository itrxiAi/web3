import { TokenType, Transaction, TxFlowStatus, TxFlowType } from "@prisma/client";
import { isTransactionFinalized } from "@/utils/chain";
import prisma from "@/lib/prisma";
//import { processBalanceUpdate } from "@/lib/balance";
//import { cleanUserMiningLevelPerformanceCache } from "@/lib/user";
//import { getUserLevel } from "@/lib/userCache";
import { getBurningAddress, getHotWalletAddress } from "@/lib/config";
import decimal from "decimal.js";

/**
 * Helper function to stake points
 * @param params - Parameters for the stake operation
 * @param duration - Duration of the stake in days
 */
// export async function processMiningTx(tx: Transaction) {
//     console.log(`mining`)


//     if (!tx || tx.status !== TxFlowStatus.PENDING || tx.type !== TxFlowType.STAKE || !tx.tx_hash) {
//         return;
//     }

//     let { status, fee, error } = await isTransactionFinalized(tx.tx_hash, tx.created_at.getTime());

//     if (status === TxFlowStatus.PENDING) {
//         return;
//     }

//     const userLevel = await getUserLevel(tx.from_address)


//     // Start transaction
//     await prisma.$transaction(async (prisma) => {
//         if (status === TxFlowStatus.FAILED) {
//             await prisma.transaction.update({
//                 where: { id: tx.id },
//                 data: {
//                     status: status,
//                     tx_fee: fee,
//                     description: JSON.stringify({ "error": error })
//                 }
//             });
//         } else if (status === TxFlowStatus.CONFIRMED) {
//             console.log(`confirmed`)
//             if (tx.description) {
//                 const burnAddress = await getBurningAddress()
//                 try {
//                     const description = JSON.parse(tx.description);
//                     console.log(`description: ${JSON.stringify(description)}`)
//                     const tokenType = tx.token_type;
//                     const tokenAmount = description.tokenAmount
//                     const usdtAmount = description.usdtAmount
//                     if (tokenType === TokenType.USDT) {
//                         console.log(`Burning flash swaped token, from:${burnAddress}, amount:${tx.amount}`);
//                         // TxFlowType.IN
//                         // await processBalanceUpdate({
//                         //     address: burnAddress,
//                         //     amount: tokenAmount,
//                         //     type: TxFlowType.IN,
//                         //     tokenType: TokenType.TXT,
//                         // }, prisma);
//                         // await prisma.transaction.create({
//                         //     data: {
//                         //         tx_hash: "",
//                         //         from_address: tx.from_address,
//                         //         to_address: await getBurningAddress(),
//                         //         amount: new decimal(tokenAmount),
//                         //         amount_fee: new decimal(0),
//                         //         description: JSON.stringify({
//                         //             hotWallet: (await getHotWalletAddress()).toString()
//                         //         }),
//                         //         token_type: TokenType.TXT,
//                         //         type: TxFlowType.BURNING,
//                         //         status: TxFlowStatus.AUDITING,
//                         //     }
//                         // });
//                     }
//                     // Process balance update
//                     await processBalanceUpdate({
//                         address: tx.from_address,
//                         amount: usdtAmount,
//                         type: TxFlowType.STAKE,
//                         tokenType: TokenType.USDT,
//                         level: userLevel
//                     }, prisma);
//                 } catch (error) {
//                     console.error('Error processing transaction description:', error);
//                     console.error('Transaction description:', tx.description);
//                 }
//             }
//             // Set transaction confirmed
//             await prisma.transaction.update({
//                 where: { id: tx.id },
//                 data: {
//                     status: status,
//                     tx_fee: fee,
//                 }
//             });
//         }
//     });
//     if (status === TxFlowStatus.CONFIRMED) {
//         try {
//             await cleanUserMiningLevelPerformanceCache(tx.from_address)
//         } catch (error) {
//             console.error(`Error cleaning user mining level performance cache for address ${tx.from_address}:`, error);
//         }
//     }
// }