import 'server-only';
import { keccak256, toUtf8Bytes } from 'ethers';
import {
  getShieldPrivateKeySignatureMessage,
  populateShield,
} from '@railgun-community/wallet';
import {
  TXIDVersion,
  NETWORK_CONFIG,
  type RailgunERC20AmountRecipient,
} from '@railgun-community/shared-models';
import { ensureRailgunEngine, RAILGUN_NETWORK } from './engine';

/** 一笔 shield 的接收项：RAILGUN 私密地址（0zk）+ 数量（最小单位 wei）+ 币种。 */
export interface ShieldRecipientWei {
  recipient: string; // 0zk...
  amountWei: bigint;
  tokenAddress: string;
}

/** 前端需要用户用钱包签名的固定消息（用于派生 shieldPrivateKey）。 */
export function getShieldSignatureMessage(): string {
  return getShieldPrivateKeySignatureMessage();
}

/** RAILGUN 在 BSC 上的代理合约地址（approve / shield 的目标）。 */
export function getRailgunProxyContract(): string {
  return NETWORK_CONFIG[RAILGUN_NETWORK].proxyContract;
}

/**
 * 在服务端构造 shield 交易 calldata（支持多币种）。
 *
 * 0zk 接收地址只存在于服务端、绝不下发到浏览器；浏览器只拿到 { to, data } 去用 MetaMask 广播。
 *
 * @param signature 用户用钱包对 getShieldSignatureMessage() 的签名（前端 MetaMask 产出）
 * @param recipients   各 0zk 接收方、金额（wei）与币种合约地址
 */
export async function buildShieldTransaction(params: {
  signature: string;
  recipients: ShieldRecipientWei[];
}): Promise<{ to: string; data: string; proxyContract: string; tokens: { token: string; totalWei: bigint }[] }> {
  const { signature, recipients } = params;
  if (!recipients.length) throw new Error('Empty shield recipients');

  await ensureRailgunEngine();

  // shieldPrivateKey = keccak256(用户对固定消息的签名)
  const shieldPrivateKey = keccak256(signature);

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = recipients.map((r) => ({
    tokenAddress: r.tokenAddress,
    amount: r.amountWei,
    recipientAddress: r.recipient,
  }));

  const { transaction } = await populateShield(
    TXIDVersion.V2_PoseidonMerkle,
    RAILGUN_NETWORK,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    undefined, // gasDetails：留空，由钱包估算 gasLimit
  );

  // 按币种汇总 totalWei
  const tokenMap = new Map<string, bigint>();
  for (const r of recipients) {
    tokenMap.set(r.tokenAddress, (tokenMap.get(r.tokenAddress) ?? BigInt(0)) + r.amountWei);
  }
  const tokens = Array.from(tokenMap.entries()).map(([tokenAddress, totalWei]) => ({
    token: tokenAddress,
    totalWei,
  }));

  return {
    to: transaction.to as string,
    data: transaction.data as string,
    proxyContract: getRailgunProxyContract(),
    tokens,
  };
}

// 引用 toUtf8Bytes 以保留依赖（部分 SDK 版本签名消息需手动编码，留作显式依赖标记）。
void toUtf8Bytes;
