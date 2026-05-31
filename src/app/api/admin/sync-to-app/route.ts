import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UserType } from '@prisma/client';

/**
 * 一次性数据迁移：把 web3 全量 user 同步到 app/backend，按 depth ASC：
 *   1) POST /internal/sync/user           // 创建用户 + 推荐关系 + cards/points
 *   2) POST /internal/activations         // 若 cards>0，按 cards 映射写激活
 *   3) POST /internal/arbiters            // 若 type=COMMUNITY，写鉴定者
 *
 * 全量同步是为了保证子节点同步时上级一定已存在，避免 inviterId 缺失。
 * 调用方式：POST /api/admin/sync-to-app
 *   body: { dryRun?: boolean, limit?: number }   // 都可选
 */

// 按 cards 数量映射激活套餐（与 app 后端 HAKCARD_TO_PACKAGE 一致）
function cardsToPackage(cards: number): { package: string; amountUsdt: string } | null {
  if (cards >= 20) return { package: 'P10000', amountUsdt: '10000' };
  if (cards >= 10) return { package: 'P5000',  amountUsdt: '5000' };
  if (cards >= 2)  return { package: 'P1000',  amountUsdt: '1000' };
  if (cards >= 1)  return { package: 'P500',   amountUsdt: '500' };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const base = process.env.APP_BACKEND_URL;
    const key = process.env.INTERNAL_API_KEY;
    if (!base) return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    if (!key) return NextResponse.json({ error: 'INTERNAL_API_KEY not configured' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    const limit: number | undefined = typeof body?.limit === 'number' ? body.limit : undefined;

    // 全量同步：保证子节点同步时父级一定已存在
    const total = await prisma.user.count();
    const users = await prisma.user.findMany({
      orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
      ...(limit ? { take: limit } : {}),
      select: {
        walletAddress: true,
        referralCode: true,
        superior: true, // 上级钱包地址
        cards: true,
        points: true,
        type: true,
        equityActivedAt: true,
        purchaseAt: true,
        createdAt: true,
        depth: true,
      },
    });

    const stats = {
      total,
      scanned: users.length,
      userCreated: 0,
      userSkipped: 0,
      activationOk: 0,
      activationSkipped: 0,
      arbiterOk: 0,
      arbiterSkipped: 0,
      errors: [] as Array<{ address: string; step: string; error: string }>,
    };

    if (dryRun) {
      return NextResponse.json({ dryRun: true, ...stats, sample: users.slice(0, 5) });
    }

    const headers = { 'Content-Type': 'application/json', 'x-internal-key': key };
    const apiBase = base.replace(/\/$/, '');

    for (const u of users) {
      const address = (u.walletAddress || '').toLowerCase();
      if (!address || !u.referralCode) {
        stats.errors.push({ address, step: 'pre', error: 'missing address or referralCode' });
        continue;
      }

      // 1) 创建用户
      try {
        const resp = await fetch(`${apiBase}/internal/sync/user`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            address,
            shortCode: u.referralCode,
            hakcard: u.cards,
            tribute: String(u.points),
            inviterAddress: u.superior ? u.superior.toLowerCase() : null,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        const data = json?.data ?? json;
        if (!resp.ok) throw new Error(data?.message || data?.error || `sync/user ${resp.status}`);
        if (data?.created) stats.userCreated += 1;
        else stats.userSkipped += 1;
      } catch (e) {
        stats.errors.push({ address, step: 'sync/user', error: (e as Error).message });
        continue; // 用户没建成功，跳过后续步骤
      }

      // 2) 激活（按 cards 数量判断 + 映射 package）
      const map = u.cards > 0 ? cardsToPackage(u.cards) : null;
      if (map) {
        try {
          const resp = await fetch(`${apiBase}/internal/activations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              address,
              package: map.package,
              amountUsdt: map.amountUsdt,
              activatedAt: (u.equityActivedAt ?? u.purchaseAt ?? u.createdAt).toISOString(),
              txHash: null,
            }),
          });
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}));
            const data = json?.data ?? json;
            throw new Error(data?.message || data?.error || `activations ${resp.status}`);
          }
          stats.activationOk += 1;
        } catch (e) {
          stats.errors.push({ address, step: 'activations', error: (e as Error).message });
        }
      } else {
        stats.activationSkipped += 1;
      }

      // 3) 鉴定者
      if (u.type === UserType.COMMUNITY) {
        try {
          const resp = await fetch(`${apiBase}/internal/arbiters`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              address,
              becameAt: (u.purchaseAt ?? u.createdAt).toISOString(),
            }),
          });
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}));
            const data = json?.data ?? json;
            throw new Error(data?.message || data?.error || `arbiters ${resp.status}`);
          }
          stats.arbiterOk += 1;
        } catch (e) {
          stats.errors.push({ address, step: 'arbiters', error: (e as Error).message });
        }
      } else {
        stats.arbiterSkipped += 1;
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
