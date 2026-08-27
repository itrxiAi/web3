/** 测试钱包地址（不区分大小写）：命中时 USDT 用测试合约地址 */
const TEST_WALLET_ADDRESS = '0xfd58458f471cbe0474f0aa4a7ca027af8955db50';
const TEST_USDT_ADDRESS = '0xf43C9b40C9361b301019C98Fb535affB3ec6C673';

/** 判断钱包地址是否为测试地址（不区分大小写）。 */
export function isTestWallet(walletAddress?: string | null): boolean {
  if (!walletAddress) return false;
  return walletAddress.toLowerCase() === TEST_WALLET_ADDRESS.toLowerCase();
}

/**
 * 根据 token 名称获取对应的合约地址。
 * @param token       token 名称（USDT / HAK / HAKP）
 * @param walletAddress 当前钱包地址（可选）；测试地址时 USDT 返回测试合约
 */
export function getTokenAddress(token: string, walletAddress?: string | null): string {
  if (token === 'HAK') return process.env.NEXT_PUBLIC_TOKEN_ADDRESS!;
  if (token === 'HAKP') return process.env.NEXT_PUBLIC_HAKP_ADDRESS!;
  // USDT：测试钱包用测试合约地址
  if (isTestWallet(walletAddress)) return TEST_USDT_ADDRESS;
  return process.env.NEXT_PUBLIC_USDT_ADDRESS!;
}
