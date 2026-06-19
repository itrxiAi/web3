import { EquityType } from '@prisma/client';
import {
  getEquityBasePriceDisplay,
  getEquityPlusPriceDisplay,
  getEquityPremiumPriceDisplay,
  getEquityExpertPriceDisplay,
  getEquityVipPriceDisplay,
} from '@/lib/config';
import {
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
  EQUITY_EXPERT_TYPE,
  EQUITY_VIP_TYPE,
} from '@/constants';

/** Equity 类型 -> App 激活套餐（与 app/backend ActivationPackage 对齐） */
export const EQUITY_TO_PACKAGE: Record<EquityType, string> = {
  BASE: 'P100',
  PLUS: 'P500',
  PREMIUM: 'P1000',
  EXPERT: 'P5000',
  VIP: 'P10000',
};

export interface ActivationTransferItem {
  address: string;
  amount: string;
}

/** 系统份额 shield 项：接收方为 RAILGUN 私密地址（0zk），金额为 USDT 人类可读字符串。 */
export interface ActivationShieldItem {
  recipient: string;
  amount: string;
}

export interface ActivationQuoteResult {
  /** 推荐奖励（直推/间推）：0x 公开地址，走 Disperse 批量转账。 */
  referralList: ActivationTransferItem[];
  /** 系统份额（销毁/国库/储备）：0zk 私密地址，走 RAILGUN shield。 */
  shieldList: ActivationShieldItem[];
  shieldTotalUsdt: string;
  amountUsdt: string;
  batchTransferContract: string;
}

/** 取某 equity 档位的展示价（USDT 人类可读金额）。 */
export async function getEquityDisplayPrice(equityType: EquityType): Promise<number> {
  switch (equityType) {
    case EQUITY_BASE_TYPE:
      return (await getEquityBasePriceDisplay()).toNumber();
    case EQUITY_PLUS_TYPE:
      return (await getEquityPlusPriceDisplay()).toNumber();
    case EQUITY_PREMIUM_TYPE:
      return (await getEquityPremiumPriceDisplay()).toNumber();
    case EQUITY_EXPERT_TYPE:
      return (await getEquityExpertPriceDisplay()).toNumber();
    case EQUITY_VIP_TYPE:
      return (await getEquityVipPriceDisplay()).toNumber();
    default:
      throw new Error(`Unknown equity type: ${equityType}`);
  }
}

/**
 * 调用 app/backend 拼接激活付款的链上拆分转账列表。
 * 后端负责解析 直推/间推 钱包地址并按比例计算金额（缺失时按系统钱包比例分摊）。
 */
export async function fetchActivationQuote(params: {
  address: string;
  package: string;
  amountUsdt: string;
}): Promise<ActivationQuoteResult> {
  const appBackendUrl = process.env.APP_BACKEND_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!appBackendUrl || !internalApiKey) {
    throw new Error('APP_BACKEND_URL or INTERNAL_API_KEY not configured');
  }

  const response = await fetch(`${appBackendUrl}/internal/activations/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': internalApiKey,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `App backend quote failed: ${response.status}`);
  }

  // app/backend 全局 TransformInterceptor 会把响应包成 { data: ... }
  const json = (await response.json()) as { data?: ActivationQuoteResult } & Partial<ActivationQuoteResult>;
  const result = (json.data ?? json) as ActivationQuoteResult;
  if (
    !result ||
    !Array.isArray(result.referralList) ||
    !Array.isArray(result.shieldList) ||
    !result.amountUsdt
  ) {
    throw new Error('App backend quote returned invalid payload');
  }
  return result;
}

/** 通知 app/backend 记录激活（链上验证通过后调用）。 */
export async function notifyActivation(params: {
  address: string;
  package: string;
  amountUsdt: string;
  activatedAt: string;
  txHash: string;
}): Promise<void> {
  const appBackendUrl = process.env.APP_BACKEND_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!appBackendUrl || !internalApiKey) {
    console.warn('APP_BACKEND_URL or INTERNAL_API_KEY not configured, skipping activation notify');
    return;
  }

  try {
    const response = await fetch(`${appBackendUrl}/internal/activations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalApiKey,
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      if (response.status === 404 && error.code === 'USER_NOT_FOUND') {
        console.log(`User ${params.address} not found in app backend, skipping activation notify`);
        return;
      }
      console.error('Failed to notify app backend activation:', error);
      return;
    }
    console.log('Successfully notified app backend activation:', params.address);
  } catch (error) {
    console.error('Error notifying app backend activation:', error);
  }
}
