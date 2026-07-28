/** 根据 token 名称获取对应的合约地址。 */
export function getTokenAddress(token: string): string {
  if (token === 'HAK') return process.env.NEXT_PUBLIC_TOKEN_ADDRESS!;
  if (token === 'HAKP') return process.env.NEXT_PUBLIC_HAKP_ADDRESS!;
  return process.env.NEXT_PUBLIC_USDT_ADDRESS!;
}
