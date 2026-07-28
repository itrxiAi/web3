import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, Keypair, VersionedTransaction, TransactionMessage, TransactionConfirmationStrategy, BlockheightBasedTransactionConfirmationStrategy, BaseTransactionConfirmationStrategy, ComputeBudgetProgram } from '@solana/web3.js';
import { bsc } from 'viem/chains';
import { MEMO_PROGRAM_ID, GROUP_TYPE, COMMUNITY_TYPE, MembershipType, NORMAL_TYPE, DEV_ENV, MAX_TRANSACTION_TIMEOUT_MS, EQUITY_BASE_TYPE, EQUITY_PLUS_TYPE, EQUITY_PREMIUM_TYPE, EQUITY_EXPERT_TYPE, EQUITY_VIP_TYPE, VERIFIER_1, VERIFIER_2, VERIFIER_3, VERIFIER_4 } from '@/constants';

import { EquityType, TokenType, TxFlowStatus } from '@prisma/client';
import decimal from 'decimal.js';
import prisma from '@/lib/prisma';
import { getCommunityPriceDisplay, getGroupPriceDisplay, getHotWalletAddress, getHotWalletKeypair, getBurningAddress, getEquityBasePriceDisplay, getEquityPlusPriceDisplay, getEquityPremiumPriceDisplay, getEquityExpertPriceDisplay, getEquityVipPriceDisplay, getVerifier1, getVerifier2, getVerifier3, getVerifier4 } from '@/lib/config';
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

const TOKEN_USDT_DECIMAL = 18;
const TOKEN_DECIMAL = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMAL || 18);

/** 根据 token 名称获取对应的合约地址 */
function getTokenAddressByName(token: string): string {
  if (token === 'HAK') return TOKEN_ADDRESS;
  if (token === 'HAKP') return process.env.NEXT_PUBLIC_HAKP_ADDRESS || TOKEN_ADDRESS;
  return USDT_TOKEN_ADDRESS;
}



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

/** 转账项：接收地址 + 金额（人类可读，带 2 位小数的字符串）+ 币种名称 */
export interface ActivationTransferItem {
  address: string;
  amount: string;
  token?: string;
}

/**
 * 校验用户激活的链上批量转账（Disperse / DualDisperse 模式）。
 *
 * 期望该交易调用了批量转账合约 `disperseToken` 或 `multiDisperse`：先 transferFrom(user -> 合约) 总额，
 * 再由合约 transfer(合约 -> 各接收者)。因此只统计 `from == 合约地址` 的 Transfer 事件，
 * 并与后端返回、保存在 Transaction.description 里的 transferList 逐项比对。
 *
 * 支持单币种（tokenAddress 参数）和多币种（expectedList 中带 token 字段）两种模式。
 *
 * @param txHash 交易哈希
 * @param expectedList 后端拼接的期望转账列表（address + amount + 可选 token）
 * @param contractAddress 批量转账合约地址
 * @param tokenAddress 单币种模式时的 token 合约地址（多币种时留空，按 expectedList 中 token 字段解析）
 */
export async function verifyBatchActivationTransfer(
  txHash: string,
  expectedList: ActivationTransferItem[],
  contractAddress: string,
  tokenAddress?: string,
): Promise<{ isValid: boolean; error?: string; fromAddress?: string }> {
  try {
    // 幂等：交易不可重复使用
    const existingTx = await prisma.transaction.findFirst({ where: { txHash } });
    if (existingTx && existingTx.status === TxFlowStatus.CONFIRMED) {
      return { isValid: false, error: 'Transaction already processed' };
    }

    const contract = contractAddress.toLowerCase();

    // 1. 获取交易收据（带重试）
    let receipt = null;
    const delays = [2000, 4000, 4000, 8000, 8000, 8000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        receipt = await ethereumClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        if (receipt) break;
      } catch {
        // ignore and retry
      }
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
    if (!receipt) return { isValid: false, error: 'Transaction not found' };
    if (receipt.status !== 'success') return { isValid: false, error: 'Transaction failed' };

    // 2. 校验交易调用的是批量转账合约
    if (receipt.to && receipt.to.toLowerCase() !== contract) {
      return { isValid: false, error: 'Transaction did not call batch transfer contract' };
    }

    // 3. 解析从合约发出的 Transfer 事件（合约 -> 接收者）
    //    多币种模式：收集所有 token 的 Transfer 事件；单币种模式：只收集指定 token
    const isMultiToken = expectedList.some((it) => it.token);
    const tokenAddressSet = new Set<string>();
    if (isMultiToken) {
      for (const it of expectedList) {
        if (it.token) tokenAddressSet.add(getTokenAddressByName(it.token).toLowerCase());
      }
    }
    const singleTokenAddr = (tokenAddress || USDT_TOKEN_ADDRESS).toLowerCase();

    const actual: ActivationTransferItem[] = [];
    for (const log of receipt.logs || []) {
      const logTokenAddr = log.address.toLowerCase();
      if (isMultiToken) {
        if (!tokenAddressSet.has(logTokenAddr)) continue;
      } else {
        if (logTokenAddr !== singleTokenAddr) continue;
      }
      let decoded;
      try {
        decoded = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
      } catch {
        continue;
      }
      if (decoded.eventName !== 'Transfer' || !decoded.args) continue;
      const args = decoded.args as unknown as { from: string; to: string; value: bigint };
      if (args.from.toLowerCase() !== contract) continue; // 仅统计合约 -> 接收者
      // 多币种模式：记录 token 地址作为标识，用于区分同地址不同币种的转账
      const tokenName = isMultiToken ? logTokenAddr : undefined;
      actual.push({
        address: args.to.toLowerCase(),
        amount: new decimal(formatUnits(args.value, TOKEN_USDT_DECIMAL)).toDecimalPlaces(2, decimal.ROUND_DOWN).toFixed(2),
        token: tokenName,
      });
    }

    // 4. 比对转账列表（地址 + 金额，允许 0.01 误差）
    //    多币种模式：将 expected 中的 token 名称统一转为小写地址，与 actual 一致
    const normalizedExpected = isMultiToken
      ? expectedList.map((it) => ({ ...it, token: getTokenAddressByName(it.token!).toLowerCase() }))
      : expectedList;
    if (!validateActivationTransferList(normalizedExpected, actual)) {
      return { isValid: false, error: 'Transfer list does not match' };
    }

    // 5. 付款人 = 交易发起者
    let fromAddress: string | undefined;
    try {
      const tx = await ethereumClient.getTransaction({ hash: txHash as `0x${string}` });
      fromAddress = tx?.from?.toLowerCase();
    } catch {
      fromAddress = undefined;
    }

    return { isValid: true, fromAddress };
  } catch (error) {
    console.error('Error verifying batch activation transfer:', error);
    return { isValid: false, error: `Failed to verify transaction: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * 校验系统份额的 RAILGUN shield 交易。
 *
 * shield 交易调用 RAILGUN 代理合约：合约通过 transferFrom 从付款人拉取 USDT 进私密池。
 *
 * ⚠️ 安全要点：shield 的 0zk 接收地址是加密在 calldata 内的，链上事件不可见。仅校验
 * "USDT 进了代理合约 + 金额" 并不能保证资金进了我们的 0zk 地址（攻击者可自建一笔等额、
 * 收款人为自己 0zk 的 shield 交易来骗过校验）。因此核心校验是：交易的 input(calldata)
 * 必须与服务端生成并持久化的 expectedCalldata 完全一致——服务端的 calldata 已将我们的
 * 0zk 接收地址固化其中，逐字节比对即可证明资金确实进入我方私密地址。
 *
 * 校验项：1) 交易成功且 to == 代理合约；2) tx.input === expectedCalldata（强保证收款人）；
 * 3) 付款人 -> 代理合约 的各币种 Transfer 金额合计约等于期望总额（防御纵深）。
 *
 * @param txHash shield 交易哈希
 * @param proxyContract RAILGUN 代理合约地址
 * @param expectedTokens 各币种期望 shield 总额（tokenAddress + amount，人类可读）
 * @param expectedCalldata 服务端生成并存档的 shield calldata（含我方 0zk 接收地址）
 */
export async function verifyShieldTransfer(
  txHash: string,
  proxyContract: string,
  expectedTokens: { tokenAddress: string; amount: string }[],
  expectedCalldata: string,
): Promise<{ isValid: boolean; error?: string; fromAddress?: string }> {
  try {
    const existingTx = await prisma.transaction.findFirst({ where: { txHash } });
    if (existingTx && existingTx.status === TxFlowStatus.CONFIRMED) {
      return { isValid: false, error: 'Transaction already processed' };
    }

    const proxy = proxyContract.toLowerCase();

    let receipt = null;
    const delays = [2000, 4000, 4000, 8000, 8000, 8000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        receipt = await ethereumClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        if (receipt) break;
      } catch {
        // ignore and retry
      }
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
    if (!receipt) return { isValid: false, error: 'Shield transaction not found' };
    if (receipt.status !== 'success') return { isValid: false, error: 'Shield transaction failed' };
    if (receipt.to && receipt.to.toLowerCase() !== proxy) {
      return { isValid: false, error: 'Transaction did not call RAILGUN proxy contract' };
    }

    // 付款人 = 交易发起者；同时取 calldata 做强校验
    let fromAddress: string | undefined;
    let onChainInput: string | undefined;
    try {
      const tx = await ethereumClient.getTransaction({ hash: txHash as `0x${string}` });
      fromAddress = tx?.from?.toLowerCase();
      onChainInput = tx?.input?.toLowerCase();
    } catch {
      fromAddress = undefined;
      onChainInput = undefined;
    }

    // 核心校验：链上 calldata 必须与服务端生成并存档的 calldata 完全一致。
    // 这保证 shield 的 0zk 接收方就是我方地址（攻击者无法换成自己的 0zk）。
    const expectedInput = (expectedCalldata || '').toLowerCase();
    if (!expectedInput || !expectedInput.startsWith('0x')) {
      return { isValid: false, error: 'Missing expected shield calldata' };
    }
    if (!onChainInput) {
      return { isValid: false, error: 'Failed to read shield transaction calldata' };
    }
    if (onChainInput !== expectedInput) {
      return { isValid: false, error: 'Shield calldata mismatch: recipients not verified' };
    }

    // 统计 付款人 -> 代理合约 的各币种 Transfer 金额合计
    for (const expectedToken of expectedTokens) {
      const tokenAddrLower = expectedToken.tokenAddress.toLowerCase();
      let movedToProxy = new decimal(0);
      for (const log of receipt.logs || []) {
        if (log.address.toLowerCase() !== tokenAddrLower) continue;
        let decoded;
        try {
          decoded = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
        } catch {
          continue;
        }
        if (decoded.eventName !== 'Transfer' || !decoded.args) continue;
        const args = decoded.args as unknown as { from: string; to: string; value: bigint };
        if (args.to.toLowerCase() !== proxy) continue;
        if (fromAddress && args.from.toLowerCase() !== fromAddress) continue;
        movedToProxy = movedToProxy.add(new decimal(formatUnits(args.value, TOKEN_USDT_DECIMAL)));
      }

      // 金额校验：进入代理合约的该币种应约等于期望总额（允许 0.5% 手续费 + 0.01 误差）
      const expected = new decimal(expectedToken.amount);
      const minAccepted = expected.mul(0.99).sub(0.01);
      if (movedToProxy.lt(minAccepted)) {
        return {
          isValid: false,
          error: `Shield amount mismatch for token ${expectedToken.tokenAddress}: moved ${movedToProxy.toFixed(2)} < expected ~${expected.toFixed(2)}`,
        };
      }
    }

    return { isValid: true, fromAddress };
  } catch (error) {
    console.error('Error verifying shield transfer:', error);
    return { isValid: false, error: `Failed to verify shield: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 比对期望与实际转账列表：数量一致、按 (address,token) 排序后逐项地址相同、金额误差 <= 0.01。 */
function validateActivationTransferList(expected: ActivationTransferItem[], actual: ActivationTransferItem[]): boolean {
  if (expected.length !== actual.length) return false;
  // 多币种模式：按 (address:token) 排序；单币种模式：按 address 排序
  const byKey = (a: ActivationTransferItem, b: ActivationTransferItem) => {
    const ka = `${a.address}:${a.token ?? ''}`;
    const kb = `${b.address}:${b.token ?? ''}`;
    return ka.localeCompare(kb);
  };
  const exp = [...expected].sort(byKey);
  const act = [...actual].sort(byKey);
  for (let i = 0; i < exp.length; i++) {
    if (exp[i].address.toLowerCase() !== act[i].address.toLowerCase()) return false;
    if ((exp[i].token ?? '') !== (act[i].token ?? '')) return false;
    const diff = Math.abs(parseFloat(exp[i].amount) - parseFloat(act[i].amount));
    if (diff > 0.01) return false;
  }
  return true;
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

    let referralCode: string | undefined;
    let type: MembershipType | undefined;

    // Verify amount matches type (using same logic as Solana)
    if (!equity) {
      if (amountDecimal.equals(await getVerifier1())) { // Compare decimal to decimal
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: VERIFIER_1,
          amount
        };
      }

      if (amountDecimal.equals(await getVerifier2())) { // Convert to USDT decimals
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: VERIFIER_2,
          amount
        };
      }

      if (amountDecimal.equals(await getVerifier3())) { // Convert to USDT decimals
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: VERIFIER_3,
          amount
        };
      }

      if (amountDecimal.equals(await getVerifier4())) { // Convert to USDT decimals
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: VERIFIER_4,
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
      if (amountDecimal.equals(await getEquityExpertPriceDisplay())) {
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: EQUITY_EXPERT_TYPE,
          amount
        };
      }
      if (amountDecimal.equals(await getEquityVipPriceDisplay())) {
        return {
          isValid: true,
          fromAddress,
          referralCode,
          type: EQUITY_VIP_TYPE,
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