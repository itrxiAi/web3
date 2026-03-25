import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, Keypair, VersionedTransaction, TransactionMessage, TransactionConfirmationStrategy, BlockheightBasedTransactionConfirmationStrategy, BaseTransactionConfirmationStrategy, ComputeBudgetProgram } from '@solana/web3.js';
import { bsc } from 'viem/chains';
import { MEMO_PROGRAM_ID, GROUP_TYPE, COMMUNITY_TYPE, MembershipType, NORMAL_TYPE, DEV_ENV, MAX_TRANSACTION_TIMEOUT_MS, EQUITY_BASE_TYPE, EQUITY_PLUS_TYPE, EQUITY_PREMIUM_TYPE } from '@/constants';
import { EquityType, TokenType, TxFlowStatus } from '@prisma/client';
import decimal from 'decimal.js';
import prisma from '@/lib/prisma';
import { getCommunityPriceDisplay, getCommunityPriceTransfer, getGroupPriceDisplay, getGroupPriceTransfer, getHotWalletAddress, getHotWalletKeypair, getBurningAddress, getEquityBasePriceDisplay, getEquityPlusPriceDisplay, getEquityPremiumPriceDisplay } from '@/lib/config';
import { getCurrentPrice } from './lbank';
import { truncateNumber } from './common';
// Ethereum imports
import { createPublicClient, http, parseUnits, formatUnits, getContract, decodeEventLog, createWalletClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { getPrice } from './bitget';
//import { getTokenPrice } from '@/lib/tokenPriceCandle';


export const SOLANA_RPC_URL = process.env.PRIVATE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS!; // TOKEN token address
const USDT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS!;

const TOKEN_USDT_DECIMAL = Number(process.env.NEXT_PUBLIC_USDT_DECIMAL || 18);
const TOKEN_DECIMAL = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMAL || 18);



// Ethereum configuration
const chain = process.env.NEXT_PUBLIC_CHAIN || 'bsc';

const CHAIN_RPC_URL = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://bnb-mainnet.g.alchemy.com/v2/your-api-key';

// ERC20 ABI for USDT transfers
const ERC20_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  }
] as const;

// Ethereum clients
const ethereumClient = createPublicClient({
  chain: mainnet,
  transport: http(CHAIN_RPC_URL)
});

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http()
});

// export async function mockVerifyTokenMining(address: string, amount: decimal, tokenType: TokenType) {
//   let usdtAmount = amount;
//   let tokenAmount = amount;
//   const price = await getTokenPrice()
//   if (tokenType == TokenType.TXT) {
//     usdtAmount = amount.mul(new decimal(price));
//   }
//   if (tokenType == TokenType.USDT) {
//     tokenAmount = amount.div(new decimal(price));
//   }

//   return {
//     isValid: true,
//     fromAddress: address,
//     amount: amount.toDecimalPlaces(2, decimal.ROUND_DOWN),
//     tokenAmount: tokenAmount.toDecimalPlaces(2, decimal.ROUND_DOWN),
//     usdtAmount: usdtAmount.toDecimalPlaces(2, decimal.ROUND_DOWN),
//     tokenPrice: price,
//     error: undefined
//   };
// }

/**
 * 
 * @param txHash 
 * @returns 
 */
export async function verifyTokenMining(txHash: string, tokenType: TokenType): Promise<{
  isValid: boolean;
  error?: string;
  fromAddress?: string;
  amount?: decimal;
  tokenAmount?: decimal;
  usdtAmount?: decimal;
  tokenPrice?: decimal;
}> {
  try {
    const targetAddress = tokenType === TokenType.USDT ? await getHotWalletAddress() : await getBurningAddress();
    if (!targetAddress) {
      return {
        isValid: false,
        error: 'Ethereum hot wallet not configured'
      };
    }
    // Check if transaction already exists in database
    const existingTx = await prisma.transaction.findFirst({
      where: {
        txHash: txHash
      }
    });

    if (existingTx) {
      console.warn(`Transaction ${txHash} already processed`);
      return {
        isValid: false,
        error: 'Transaction already processed'
      };
    }

    const result = await verifyChainTransfer(txHash, tokenType);
    if (!result.success) {
      return {
        isValid: false,
        error: result.error,
      };
    }
    const fromAddress = result.fromAddress as string;
    const toAddress = result.toAddress as string;
    const transferAmount = result.amount as bigint;

    // Verify the destination address matches our expected target address
    if (toAddress.toLowerCase() !== targetAddress.toLowerCase()) {
      return {
        isValid: false,
        error: 'Invalid destination address'
      };
    }

    // USDT on Ethereum has 6 decimals
    const amount = Number(formatUnits(transferAmount, TOKEN_DECIMAL));
    const amountDecimal = new decimal(amount);

    let usdtAmount = amountDecimal;
    let tokenAmount = amountDecimal;
    const price = 1//await getTokenPrice()
    if (tokenType == TokenType.HAK) {
      usdtAmount = amountDecimal.mul(new decimal(price));
    }
    if (tokenType == TokenType.USDT) {
      tokenAmount = amountDecimal.div(new decimal(price));
    }

    return {
      isValid: true,
      fromAddress,
      amount: amountDecimal.toDecimalPlaces(2, decimal.ROUND_DOWN),
      tokenAmount: tokenAmount.toDecimalPlaces(2, decimal.ROUND_DOWN),
      usdtAmount: usdtAmount.toDecimalPlaces(2, decimal.ROUND_DOWN),
      //tokenPrice: price
    };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return {
      isValid: false,
      error: `Failed to verify transaction: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function verifyChainTransfer(txHash: string, tokenType: TokenType): Promise<{
  success: boolean;
  error?: string;
  fromAddress?: string;
  toAddress?: string;
  amount?: bigint;
}> {

  let receipt = null;
  const delays = [2000, 4000, 4000, 8000, 8000, 8000]; // Delays in milliseconds

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      receipt = await ethereumClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (receipt) break; // If we got a receipt, exit the retry loop

      if (attempt < delays.length) {
        // Wait for the specified delay before retrying
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    } catch (error) {
      if (attempt < delays.length) {
        // If this isn't our last attempt, wait and try again
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      } else {
        // On the last attempt, if we still get an error, throw it
        throw error;
      }
    }
  }
  if (!receipt) {
    return {
      success: false,
      error: 'Transaction not found'
    };
  }

  // Check if transaction was successful
  if (receipt.status !== 'success') {
    return {
      success: false,
      error: 'Transaction failed'
    };
  }
  const tokenAddress = tokenType === TokenType.HAK ? TOKEN_ADDRESS : USDT_TOKEN_ADDRESS;

  // Find USDT transfer event
  const transferEvent = receipt.logs.find(log => {
    try {
      if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) {
        return false;
      }

      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics
      });

      return decoded.eventName === 'Transfer' &&
        decoded.args;
    } catch {
      return false;
    }
  });

  if (!transferEvent) {
    return {
      success: false,
      error: 'No USDT transfer to target address found'
    };
  }

  // Decode the transfer event
  const decoded = decodeEventLog({
    abi: ERC20_ABI,
    data: transferEvent.data,
    topics: transferEvent.topics
  });

  if (!decoded.args) {
    return {
      success: false,
      error: 'Invalid transfer event data'
    };
  }

  const decodedArgs = decoded.args as any;
  const fromAddress = decodedArgs.from as string;
  const toAddress = decodedArgs.to as string;
  const transferAmount = decodedArgs.value as bigint;

  return {
    success: true,
    error: '',
    fromAddress: fromAddress.toLowerCase(),
    toAddress: toAddress.toLowerCase(),
    amount: transferAmount
  };
}

/**
 * Verifies Ethereum USDT transfer transaction
 * @param txHash Ethereum transaction hash
 * @returns Verification result
 */
export async function verifyTokenTransfer(txHash: string, equity: boolean = false): Promise<{
  isValid: boolean;
  error?: string;
  fromAddress?: string;
  referralCode?: string;
  type?: MembershipType;
  amount?: number;
}> {

  // Check if transaction already exists in database
  const existingTx = await prisma.transaction.findFirst({
    where: {
      txHash: txHash
    }
  });

  if (existingTx) {
    console.warn(`Transaction ${txHash} already processed`);
    return {
      isValid: false,
      error: 'Transaction already processed'
    };
  }
  const targetAddress = await getHotWalletAddress();
  try {
    if (!targetAddress) {
      return {
        isValid: false,
        error: 'Ethereum target address not configured'
      };
    }

    const result = await verifyChainTransfer(txHash, TokenType.USDT);
    if (!result.success) {
      return {
        isValid: false,
        error: result.error,
      };
    }

    const fromAddress = result.fromAddress as string;
    const toAddress = result.toAddress as string;
    const transferAmount = result.amount as bigint;

    // Verify the destination address matches our expected target address
    if (toAddress.toLowerCase() !== targetAddress.toLowerCase()) {
      return {
        isValid: false,
        error: 'Invalid destination address'
      };
    }

    // USDT on Ethereum has 6 decimals
    const amount = Number(formatUnits(transferAmount, TOKEN_USDT_DECIMAL));
    const amountDecimal = new decimal(amount);

    // Get transaction details to check for memo in input data
    // const tx = await ethereumClient.getTransaction({ hash: txHash as `0x${string}` });

    let referralCode: string | undefined;
    let type: MembershipType | undefined;

    // Verify amount matches type (using same logic as Solana)
    if (!equity) {
      if (amountDecimal.equals(await getGroupPriceDisplay())) { // Compare decimal to decimal
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: GROUP_TYPE,
          amount
        };
      }

      if (amountDecimal.equals(await getCommunityPriceDisplay())) { // Convert to USDT decimals
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: COMMUNITY_TYPE,
          amount
        };
      }
    } else {
      if (amountDecimal.equals(await getEquityBasePriceDisplay())) { // Compare decimal to decimal
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: EQUITY_BASE_TYPE,
          amount
        };
      }
      if (amountDecimal.equals(await getEquityPlusPriceDisplay())) { // Compare decimal to decimal
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: EQUITY_PLUS_TYPE,
          amount
        };
      }
      if (amountDecimal.equals(await getEquityPremiumPriceDisplay())) { // Compare decimal to decimal
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: EQUITY_PREMIUM_TYPE,
          amount
        };
      }
    }


    return {
      isValid: false,
      error: 'Invalid amount',
      fromAddress,
      referralCode,
      type,
      amount
    };
  } catch (error) {
    console.error('Error verifying Ethereum transaction:', error);
    return {
      isValid: false,
      error: `Failed to verify Ethereum transaction: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function verifyTokenBurning(txHash: string): Promise<{
  isValid: boolean;
  error?: string;
  fromAddress?: string;
  amount?: decimal;
  realAmount?: decimal;
}> {
  // try {
  //   // Check if transaction already exists in database
  //   const existingTx = await prisma.transaction.findFirst({
  //     where: {
  //       tx_hash: txHash
  //     }
  //   });

  //   if (existingTx) {
  //     console.warn(`Transaction ${txHash} already processed`);
  //     return {
  //       isValid: false,
  //       error: 'Transaction already processed'
  //     };
  //   }

  //   // Get transaction details
  //   const maxRetries = 10;
  //   let retryCount = 0;
  //   const initialDelay = 3000; // 3 seconds

  //   let tx;
  //   while (retryCount < maxRetries) {
  //     tx = await connection.getParsedTransaction(txHash, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });

  //     if (tx) {
  //       break;
  //     }

  //     retryCount++;
  //     if (retryCount < maxRetries) {
  //       const delay = initialDelay;
  //       await new Promise(resolve => setTimeout(resolve, delay));
  //     }
  //   }

  //   if (!tx) {
  //     return {
  //       isValid: false,
  //       error: 'Transaction not found after multiple attempts'
  //     };
  //   }

  //   // Check if transaction is confirmed
  //   if (!tx.meta?.err) {
  //     // Find the SPL token burn instruction
  //     const burnInstruction = tx.transaction.message.instructions.find(
  //       instruction =>
  //         instruction.programId.toString() === TOKEN_PROGRAM_ID.toString() &&
  //         'parsed' in instruction &&
  //         instruction.parsed?.type === 'burn'
  //     );

  //     if (!burnInstruction || !('parsed' in burnInstruction)) {
  //       return {
  //         isValid: false,
  //         error: 'No token burn instruction found'
  //       };
  //     }

  //     // Get burn details from the parsed instruction
  //     const parsedBurn = burnInstruction.parsed as {
  //       type: string;
  //       info: {
  //         account: string;
  //         authority: string;
  //         amount: string;
  //       }
  //     };

  //     // Verify this is an TOKEN token burn by checking the token account
  //     const burnAccountInfo = await connection.getParsedAccountInfo(new PublicKey(parsedBurn.info.account));
  //     if (!burnAccountInfo.value || !('parsed' in burnAccountInfo.value.data)) {
  //       return {
  //         isValid: false,
  //         error: 'Invalid burn account'
  //       };
  //     }

  //     const burnAccountData = burnAccountInfo.value.data.parsed as {
  //       info: { mint: string; }
  //     };

  //     if (burnAccountData.info.mint !== TOKEN_TOKEN_ADDRESS) {
  //       return {
  //         isValid: false,
  //         error: 'Not an TOKEN token burn'
  //       };
  //     }

  //     const fromAddress = parsedBurn.info.authority;
  //     const amount = new decimal(parsedBurn.info.amount).div(new decimal(10).pow(TOKEN_TOKEN_DECIMAL));

  //     return {
  //       isValid: true,
  //       fromAddress,
  //       amount
  //     };
  //   }

  //   return {
  //     isValid: false,
  //     error: 'Transaction failed'
  //   };
  // } catch (error) {
  //   console.error('Error verifying burn transaction:', error);
  //   return {
  //     isValid: false,
  //     error: `Failed to verify burn transaction: ${error instanceof Error ? error.message : String(error)}`
  //   };
  // }·
  return {
    isValid: false,
    error: `Failed to verify burn transaction`
  };
}

export async function outTransferTokens(
  toAddress: string,
  amount: decimal,
  tokenType: TokenType = TokenType.USDT
): Promise<{ txHash: string }> {
  try {
    // Get Ethereum wallet from config
    const wallet = await getHotWalletKeypair();

    // Get token contract address based on token type
    const tokenAddress = tokenType === TokenType.HAK ? TOKEN_ADDRESS : USDT_TOKEN_ADDRESS;

    // Create wallet client for sending transaction

    // Determine which chain to use based on environment variable
    const selectedChain = chain === 'eth' ? mainnet : bsc;

    const walletClient = createWalletClient({
      account: wallet.account,
      chain: selectedChain,
      transport: http(CHAIN_RPC_URL)
    });

    // Convert amount to proper decimals (USDT has 6 decimals, TOKEN may have different)
    const decimals = tokenType === TokenType.USDT ? TOKEN_USDT_DECIMAL : TOKEN_DECIMAL; // Assuming TOKEN has 18 decimals
    const { parseUnits } = await import('viem');
    const transferAmount = parseUnits(amount.toString(), decimals);

    // Send ERC20 transfer transaction
    const txHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, transferAmount],
      account: wallet.account
    });

    console.log(`ERC20 token transfer sent: ${txHash}`);
    return { txHash };

  } catch (error: any) {
    console.error('Error in ERC20 token transfer:', error);
    throw new Error(`Failed to transfer ERC20 tokens: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function for Ethereum transaction status
export async function isTransactionFinalized(txHash: string, executionTime?: number): Promise<{
  status: TxFlowStatus;
  fee: decimal;
  error?: string;
}> {
  if (process.env.NODE_ENV === DEV_ENV) {
    return {
      status: TxFlowStatus.CONFIRMED,
      fee: new decimal(0.0005)
    };
  }
  try {
    // Get transaction receipt from Ethereum
    const receipt = await ethereumClient.getTransactionReceipt({
      hash: txHash as `0x${string}`
    });

    if (!receipt) {
      if (executionTime && new Date().getTime() > executionTime + MAX_TRANSACTION_TIMEOUT_MS) {
        return { status: TxFlowStatus.FAILED, fee: new decimal(0), error: 'Transaction execution timeout' };
      }
      return { status: TxFlowStatus.PENDING, fee: new decimal(0) };
    }

    // Check if transaction was successful
    if (receipt.status === 'success') {
      // Calculate fee in ETH (gasUsed * gasPrice)
      const feeInWei = receipt.gasUsed * (receipt.effectiveGasPrice || BigInt(0));
      const feeInEth = new decimal(feeInWei.toString()).div(new decimal('1000000000000000000')); // Convert wei to ETH

      return {
        status: TxFlowStatus.CONFIRMED,
        fee: feeInEth
      };
    } else {
      // Transaction failed
      const feeInWei = receipt.gasUsed * (receipt.effectiveGasPrice || BigInt(0));
      const feeInEth = new decimal(feeInWei.toString()).div(new decimal('1000000000000000000'));

      return {
        status: TxFlowStatus.FAILED,
        fee: feeInEth,
        error: 'Ethereum transaction failed'
      };
    }
  } catch (error) {
    console.error('Error checking Ethereum transaction status:', error);
    // If we can't find the receipt, it might still be pending
    if (executionTime && new Date().getTime() > executionTime + MAX_TRANSACTION_TIMEOUT_MS) {
      return { status: TxFlowStatus.FAILED, fee: new decimal(0), error: 'Transaction execution timeout' };
    }
    return {
      status: TxFlowStatus.PENDING,
      fee: new decimal(0)
    };
  }
}