'use client';

import React, { useState } from 'react';

type ArbiterItem = {
  userId: string;
  address: string;
  nickname: string | null;
  shortCode: string | null;
  hakcard: number;
  tribute: string;
  becameAt: string;
  expiresAt: string;
  active: boolean;
  revokedAt: string | null;
};

type ActivationItem = {
  userId: string;
  address: string;
  nickname: string | null;
  shortCode: string | null;
  package: string;
  amountUsdt: string;
  activatedAt: string;
  expiresAt: string | null;
  txHash: string | null;
  hakcard: number;
  tribute: string;
};

type UserOverview = {
  id: string;
  address: string;
  nickname: string | null;
  shortCode: string | null;
  status: 'ACTIVE' | 'BANNED';
  hakcard: number;
  tribute: string;
  createdAt: string;
  depth: number;
  teamLevel: string;
  portionActivated: number;
  teamSize: number;
  ancestors: Array<{ shortCode: string; address: string; nickname: string | null }>;
  activation: {
    package: string;
    amountUsdt: string;
    activatedAt: string;
    expiresAt: string | null;
    txHash: string | null;
  } | null;
  arbiter: {
    becameAt: string;
    expiresAt: string;
    active: boolean;
    revokedAt: string | null;
  } | null;
};

type UserDetailResp = {
  user: UserOverview;
  directInvitees: UserOverview[];
  directInviteeCount: number;
};

type TeamRevenueBreakdown = {
  user: { id: string; address: string; nickname: string | null; shortCode: string | null };
  date: string;
  level: string;
  ratio: number;
  history: {
    level: string;
    selfRevenue: string;
    teamRevenue: string;
    totalRevenue: string;
    diffReward: string;
    peerReward: string;
  } | null;
  breakdown: {
    fromSelf: { selfRevenue: string; ratio: number; diffContribution: string };
    fromDirectChildren: Array<{
      userId: string;
      address: string;
      nickname: string | null;
      shortCode: string | null;
      level: string;
      ratio: number;
      selfRevenue: string;
      teamRevenue: string;
      totalRevenue: string;
      diffContribution: string;
      peerContribution: string;
    }>;
    sumDiffFromChildren: string;
    sumPeerFromChildren: string;
    reconstructedDiff: string;
  };
};

// 昨天的 YYYY-MM-DD（UTC，与后端结算口径一致）
function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

const AdminStatisticsPage = () => {
  // 验证者列表
  const [arbiters, setArbiters] = useState<ArbiterItem[]>([]);
  const [arbiterCount, setArbiterCount] = useState(0);
  const [arbiterPage, setArbiterPage] = useState(1);
  const [arbiterPageSize] = useState(20);
  const [arbiterTotalPages, setArbiterTotalPages] = useState(1);
  const [arbiterLoading, setArbiterLoading] = useState(false);
  const [arbiterError, setArbiterError] = useState('');

  // 激活者列表
  const [activations, setActivations] = useState<ActivationItem[]>([]);
  const [activationCount, setActivationCount] = useState(0);
  const [activationPage, setActivationPage] = useState(1);
  const [activationPageSize] = useState(20);
  const [activationTotalPages, setActivationTotalPages] = useState(1);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');

  // 手动设置 hakcard / tribute
  const [targetWallet, setTargetWallet] = useState('');
  const [targetHakcard, setTargetHakcard] = useState<string>('');
  const [targetTribute, setTargetTribute] = useState<string>('');
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditMessage, setCreditMessage] = useState('');
  const [creditError, setCreditError] = useState('');

  // 用户详情面板
  const [detailWallet, setDetailWallet] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState<UserDetailResp | null>(null);

  // 团队收益对账面板
  const [trWallet, setTrWallet] = useState('');
  const [trDate, setTrDate] = useState(yesterdayUTC());
  const [trLoading, setTrLoading] = useState(false);
  const [trError, setTrError] = useState('');
  const [tr, setTr] = useState<TeamRevenueBreakdown | null>(null);

  // 数据迁移（web3 → app）：一次性按钮
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  // 交易补偿（保留旧 web3 后端）
  const [compensateTxHash, setCompensateTxHash] = useState('');
  const [compensateLoading, setCompensateLoading] = useState(false);
  const [compensateMessage, setCompensateMessage] = useState('');
  const [compensateError, setCompensateError] = useState('');

  const fetchArbiters = async (nextPage = arbiterPage) => {
    setArbiterLoading(true);
    setArbiterError('');
    try {
      const response = await fetch(`/api/admin/arbiters?page=${nextPage}&pageSize=${arbiterPageSize}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Request failed: ${response.status}`);
      setArbiters(data.items || []);
      setArbiterCount(data.count || 0);
      setArbiterTotalPages(data.totalPages || 1);
      setArbiterPage(data.page || nextPage);
    } catch (error) {
      setArbiterError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setArbiterLoading(false);
    }
  };

  const fetchActivations = async (nextPage = activationPage) => {
    setActivationLoading(true);
    setActivationError('');
    try {
      const response = await fetch(`/api/admin/activations?page=${nextPage}&pageSize=${activationPageSize}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Request failed: ${response.status}`);
      setActivations(data.items || []);
      setActivationCount(data.count || 0);
      setActivationTotalPages(data.totalPages || 1);
      setActivationPage(data.page || nextPage);
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setActivationLoading(false);
    }
  };

  const updateCredit = async () => {
    setCreditLoading(true);
    setCreditError('');
    setCreditMessage('');
    try {
      const body: Record<string, unknown> = { address: targetWallet.trim() };
      if (targetHakcard.trim() !== '') body.hakcard = Number(targetHakcard);
      if (targetTribute.trim() !== '') body.tribute = targetTribute.trim();

      const response = await fetch('/api/admin/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
      const u = data.user || {};
      setCreditMessage(`设置成功：${u.address} -> hakcard=${u.hakcard}, tribute=${u.tribute}`);
      await Promise.all([fetchArbiters(arbiterPage), fetchActivations(activationPage)]);
    } catch (error) {
      setCreditError(error instanceof Error ? error.message : '设置失败');
    } finally {
      setCreditLoading(false);
    }
  };

  const fetchUserDetail = async () => {
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    try {
      const addr = detailWallet.trim();
      const response = await fetch(`/api/admin/user-detail?address=${encodeURIComponent(addr)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
      setDetail(data as UserDetailResp);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchTeamRevenue = async () => {
    setTrLoading(true);
    setTrError('');
    setTr(null);
    try {
      const addr = trWallet.trim();
      const url = `/api/admin/team-revenue?address=${encodeURIComponent(addr)}&date=${encodeURIComponent(trDate)}`;
      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
      setTr(data as TeamRevenueBreakdown);
    } catch (error) {
      setTrError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setTrLoading(false);
    }
  };

  const runSyncToApp = async () => {
    if (!confirm('确认从 web3 同步用户/激活/鉴定者数据到 app 后端？此操作可重复执行（已同步的会被跳过）。')) return;
    setSyncLoading(true);
    setSyncError('');
    setSyncMessage('');
    try {
      const response = await fetch('/api/admin/sync-to-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Request failed: ${response.status}`);
      setSyncMessage(
        `同步完成：扫描 ${data.scanned}/${data.total}，新建用户 ${data.userCreated} (跳过 ${data.userSkipped})，` +
          `激活 ${data.activationOk}，鉴定者 ${data.arbiterOk}，错误 ${data.errors?.length ?? 0}`,
      );
      if (data.errors?.length) {
        console.warn('sync-to-app errors:', data.errors);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '同步失败');
    } finally {
      setSyncLoading(false);
    }
  };

  const compensateCommunityTransaction = async () => {
    setCompensateLoading(true);
    setCompensateError('');
    setCompensateMessage('');
    try {
      const response = await fetch('/api/points/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: compensateTxHash }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Request failed: ${response.status}`);
      setCompensateMessage('补偿调用成功');
    } catch (error) {
      setCompensateError(error instanceof Error ? error.message : '补偿失败');
    } finally {
      setCompensateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Admin 管理</h1>

        {/* 1) 验证者列表 */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">1) 验证者（Arbiter）列表</h2>
            <button
              onClick={() => void fetchArbiters(arbiterPage)}
              disabled={arbiterLoading}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm disabled:bg-gray-600"
            >
              {arbiterLoading ? '查询中...' : '刷新'}
            </button>
          </div>

          <div className="text-sm text-white/80">当前活跃验证者总数：{arbiterCount}</div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-white/20">
                  <th className="py-2 pr-3">address</th>
                  <th className="py-2 pr-3">nickname</th>
                  <th className="py-2 pr-3">hakcard</th>
                  <th className="py-2 pr-3">tribute</th>
                  <th className="py-2 pr-3">becameAt</th>
                  <th className="py-2 pr-3">expiresAt</th>
                </tr>
              </thead>
              <tbody>
                {arbiters.map((a) => (
                  <tr key={a.userId} className="border-b border-white/10">
                    <td className="py-2 pr-3 font-mono">{a.address}</td>
                    <td className="py-2 pr-3">{a.nickname ?? '-'}</td>
                    <td className="py-2 pr-3">{a.hakcard}</td>
                    <td className="py-2 pr-3">{a.tribute}</td>
                    <td className="py-2 pr-3">{new Date(a.becameAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{new Date(a.expiresAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!arbiterLoading && arbiters.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-white/60">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => void fetchArbiters(Math.max(1, arbiterPage - 1))}
              disabled={arbiterLoading || arbiterPage <= 1}
              className="rounded bg-gray-700 px-3 py-1 disabled:bg-gray-800"
            >
              上一页
            </button>
            <span>第 {arbiterPage} / {arbiterTotalPages} 页</span>
            <button
              onClick={() => void fetchArbiters(Math.min(arbiterTotalPages, arbiterPage + 1))}
              disabled={arbiterLoading || arbiterPage >= arbiterTotalPages}
              className="rounded bg-gray-700 px-3 py-1 disabled:bg-gray-800"
            >
              下一页
            </button>
          </div>

          {arbiterError && <p className="text-red-400 text-sm">{arbiterError}</p>}
        </section>

        {/* 2) 激活者列表 */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">2) 激活者（Activation）列表</h2>
            <button
              onClick={() => void fetchActivations(activationPage)}
              disabled={activationLoading}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm disabled:bg-gray-600"
            >
              {activationLoading ? '查询中...' : '刷新'}
            </button>
          </div>

          <div className="text-sm text-white/80">当前激活者总数：{activationCount}</div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-white/20">
                  <th className="py-2 pr-3">address</th>
                  <th className="py-2 pr-3">package</th>
                  <th className="py-2 pr-3">amountUsdt</th>
                  <th className="py-2 pr-3">activatedAt</th>
                  <th className="py-2 pr-3">txHash</th>
                </tr>
              </thead>
              <tbody>
                {activations.map((a) => (
                  <tr key={a.userId + a.activatedAt} className="border-b border-white/10">
                    <td className="py-2 pr-3 font-mono">{a.address}</td>
                    <td className="py-2 pr-3">{a.package}</td>
                    <td className="py-2 pr-3">{a.amountUsdt}</td>
                    <td className="py-2 pr-3">{new Date(a.activatedAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{a.txHash ?? '-'}</td>
                  </tr>
                ))}
                {!activationLoading && activations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-white/60">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => void fetchActivations(Math.max(1, activationPage - 1))}
              disabled={activationLoading || activationPage <= 1}
              className="rounded bg-gray-700 px-3 py-1 disabled:bg-gray-800"
            >
              上一页
            </button>
            <span>第 {activationPage} / {activationTotalPages} 页</span>
            <button
              onClick={() => void fetchActivations(Math.min(activationTotalPages, activationPage + 1))}
              disabled={activationLoading || activationPage >= activationTotalPages}
              className="rounded bg-gray-700 px-3 py-1 disabled:bg-gray-800"
            >
              下一页
            </button>
          </div>

          {activationError && <p className="text-red-400 text-sm">{activationError}</p>}
        </section>

        {/* 3) 用户详情面板 */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-4">
          <h2 className="text-lg font-semibold">3) 用户详情（含直推）</h2>
          <div className="flex gap-2">
            <input
              value={detailWallet}
              onChange={(e) => setDetailWallet(e.target.value)}
              placeholder="用户钱包地址 (0x...)"
              className="flex-1 rounded border border-white/20 bg-black/50 px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={() => void fetchUserDetail()}
              disabled={detailLoading || !detailWallet.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm disabled:bg-gray-600"
            >
              {detailLoading ? '查询中...' : '查询'}
            </button>
          </div>
          {detailError && <p className="text-red-400 text-sm">{detailError}</p>}

          {detail && (
            <div className="space-y-4">
              <div className="rounded border border-white/20 p-3">
                <h3 className="font-semibold mb-2">主体用户</h3>
                <UserOverviewCard u={detail.user} showAncestors />
              </div>
              <div className="rounded border border-white/20 p-3">
                <h3 className="font-semibold mb-2">直推用户（{detail.directInviteeCount} 人）</h3>
                {detail.directInvitees.length === 0 ? (
                  <p className="text-sm text-white/60">无直推</p>
                ) : (
                  <div className="space-y-3">
                    {detail.directInvitees.map((u) => (
                      <UserOverviewCard key={u.id} u={u} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 4) 团队收益对账（级差 + 平级） */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-4">
          <h2 className="text-lg font-semibold">4) 团队收益对账（级差 + 平级）</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={trWallet}
              onChange={(e) => setTrWallet(e.target.value)}
              placeholder="用户钱包地址 (0x...)"
              className="flex-1 min-w-[280px] rounded border border-white/20 bg-black/50 px-3 py-2 text-sm font-mono"
            />
            <input
              type="date"
              value={trDate}
              onChange={(e) => setTrDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="rounded border border-white/20 bg-black/50 px-3 py-2 text-sm cursor-pointer"
            />
            <button
              onClick={() => void fetchTeamRevenue()}
              disabled={trLoading || !trWallet.trim() || !trDate}
              className="rounded bg-blue-600 px-4 py-2 text-sm disabled:bg-gray-600"
            >
              {trLoading ? '查询中...' : '查询'}
            </button>
          </div>
          <p className="text-xs text-white/60">
            日期按 UTC 计算（与后端结算口径一致）。返回当日 `team_revenue_history` 实际值，并按直推用户重算各自的贡献以便对账。
          </p>
          {trError && <p className="text-red-400 text-sm">{trError}</p>}

          {tr && (
            <div className="space-y-3 text-sm">
              <div className="rounded border border-white/20 p-3 space-y-1">
                <div className="font-semibold">主体当日汇总（{tr.date}）</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>地址: <AddressTag address={tr.user.address} /></span>
                  <span>昵称: {tr.user.nickname ?? '-'}</span>
                  <span>等级: <span className="text-yellow-300">{tr.level}</span> (比例 {tr.ratio}%)</span>
                </div>
                {tr.history ? (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-white/80">
                    <span>本人收益: {tr.history.selfRevenue}</span>
                    <span>团队收益: {tr.history.teamRevenue}</span>
                    <span>总收益: {tr.history.totalRevenue}</span>
                    <span>级差奖励: <span className="text-green-400">{tr.history.diffReward}</span></span>
                    <span>平级奖励: <span className="text-green-400">{tr.history.peerReward}</span></span>
                  </div>
                ) : (
                  <p className="text-white/40">当日无 team_revenue_history 记录（未结算/无收益）</p>
                )}
              </div>

              <div className="rounded border border-white/20 p-3 space-y-2">
                <div className="font-semibold">贡献明细</div>
                <div className="text-white/80">
                  本人挖矿贡献到级差：
                  <span className="ml-1">{tr.breakdown.fromSelf.selfRevenue} × {tr.breakdown.fromSelf.ratio}% = </span>
                  <span className="text-green-400">{tr.breakdown.fromSelf.diffContribution}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/20">
                        <th className="py-2 pr-3">直推地址</th>
                        <th className="py-2 pr-3">昵称</th>
                        <th className="py-2 pr-3">等级</th>
                        <th className="py-2 pr-3">比例%</th>
                        <th className="py-2 pr-3">selfRev</th>
                        <th className="py-2 pr-3">teamRev</th>
                        <th className="py-2 pr-3">totalRev</th>
                        <th className="py-2 pr-3">→ 级差贡献</th>
                        <th className="py-2 pr-3">→ 平级贡献</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tr.breakdown.fromDirectChildren.map((c) => (
                        <tr key={c.userId} className="border-b border-white/10">
                          <td className="py-2 pr-3"><AddressTag address={c.address} /></td>
                          <td className="py-2 pr-3">{c.nickname ?? '-'}</td>
                          <td className="py-2 pr-3 text-yellow-300">{c.level}</td>
                          <td className="py-2 pr-3">{c.ratio}</td>
                          <td className="py-2 pr-3">{c.selfRevenue}</td>
                          <td className="py-2 pr-3">{c.teamRevenue}</td>
                          <td className="py-2 pr-3">{c.totalRevenue}</td>
                          <td className="py-2 pr-3 text-green-400">{c.diffContribution}</td>
                          <td className="py-2 pr-3 text-green-400">{c.peerContribution}</td>
                        </tr>
                      ))}
                      {tr.breakdown.fromDirectChildren.length === 0 && (
                        <tr><td colSpan={9} className="py-4 text-white/60">无直推</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20 font-semibold">
                        <td className="py-2 pr-3" colSpan={7}>合计（来自直推）</td>
                        <td className="py-2 pr-3 text-green-400">{tr.breakdown.sumDiffFromChildren}</td>
                        <td className="py-2 pr-3 text-green-400">{tr.breakdown.sumPeerFromChildren}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {tr.history && (
                  <div className="text-xs text-white/70 space-y-0.5">
                    <div>重算级差(逐子 clamp) = 本人贡献 + Σ直推级差贡献 = <span className="text-yellow-300">{tr.breakdown.reconstructedDiff}</span></div>
                    <div>历史表 diffReward = <span className="text-green-400">{tr.history.diffReward}</span>（与重算一致表示对账通过；不一致说明结算时的直推集合或等级与现在不同）</div>
                    <div>Σ直推平级贡献 = <span className="text-yellow-300">{tr.breakdown.sumPeerFromChildren}</span> ; 历史表 peerReward = <span className="text-green-400">{tr.history.peerReward}</span></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 5) 手动设置 hakcard / tribute */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">5) 手动设置 hakcard / tribute</h2>
          <input
            value={targetWallet}
            onChange={(e) => setTargetWallet(e.target.value)}
            placeholder="用户钱包地址 (0x...)"
            className="w-full rounded border border-white/20 bg-black/50 px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-3">
            <input
              type="number"
              value={targetHakcard}
              onChange={(e) => setTargetHakcard(e.target.value)}
              placeholder="hakcard (cards)"
              className="w-40 rounded border border-white/20 bg-black/50 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={targetTribute}
              onChange={(e) => setTargetTribute(e.target.value)}
              placeholder="tribute (points, 支持小数)"
              className="w-56 rounded border border-white/20 bg-black/50 px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-white/60">
            为空的字段不会被修改。映射关系：旧 points → tribute，旧 cards → hakcard
          </p>
          <div>
            <button
              onClick={() => void updateCredit()}
              disabled={creditLoading || !targetWallet.trim() || (targetHakcard.trim() === '' && targetTribute.trim() === '')}
              className="rounded bg-emerald-600 px-4 py-2 text-sm disabled:bg-gray-600"
            >
              {creditLoading ? '提交中...' : '提交设置'}
            </button>
          </div>
          {creditMessage && <p className="text-green-400 text-sm">{creditMessage}</p>}
          {creditError && <p className="text-red-400 text-sm">{creditError}</p>}
        </section>

        {/* 6) web3 → app 数据迁移 */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">6) web3 → app 数据迁移</h2>
          <p className="text-xs text-white/60">
            扫描 web3 user 表（cards{'>'}0 或 points{'>'}0），按 depth ASC 同步到 app 后端：
            创建用户（保留 shortCode/推荐关系/cards/points） + 写激活（按 cards 数映射 package） + 写鉴定者（type=COMMUNITY）。
            幂等，可重复点击。
          </p>
          <div>
            <button
              onClick={() => void runSyncToApp()}
              disabled={syncLoading}
              className="rounded bg-purple-600 px-4 py-2 text-sm disabled:bg-gray-600"
            >
              {syncLoading ? '同步中...' : '执行同步'}
            </button>
          </div>
          {syncMessage && <p className="text-green-400 text-sm">{syncMessage}</p>}
          {syncError && <p className="text-red-400 text-sm">{syncError}</p>}
        </section>

        {/* 7) 交易补偿（保留旧 web3 后端） */}
        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">7) 交易补偿（保留旧 web3 后端）</h2>
          <input
            value={compensateTxHash}
            onChange={(e) => setCompensateTxHash(e.target.value)}
            placeholder="txHash（必填）"
            className="w-full rounded border border-white/20 bg-black/50 px-3 py-2 text-sm font-mono"
          />

          <div>
            <button
              onClick={() => void compensateCommunityTransaction()}
              disabled={compensateLoading || !compensateTxHash.trim()}
              className="rounded bg-orange-600 px-4 py-2 text-sm disabled:bg-gray-600"
            >
              {compensateLoading ? '补偿中...' : '执行补偿'}
            </button>
          </div>
          {compensateMessage && <p className="text-green-400 text-sm">{compensateMessage}</p>}
          {compensateError && <p className="text-red-400 text-sm">{compensateError}</p>}
        </section>
      </div>
    </div>
  );
};

function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

/**
 * 可点击复制完整地址的标签。
 * - 悬停显示完整地址
 * - 点击复制到剪贴板，短暂高亮提示「已复制」
 */
function AddressTag({ address, className = '' }: { address: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 降级：用临时 textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
      document.body.removeChild(ta);
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? '已复制' : `${address}（点击复制）`}
      className={`font-mono cursor-pointer hover:text-blue-300 active:text-blue-500 ${copied ? 'text-green-400' : ''} ${className}`}
    >
      {copied ? '已复制' : truncateAddress(address)}
    </button>
  );
}

function UserOverviewCard({ u, showAncestors = false }: { u: UserOverview; showAncestors?: boolean }) {
  const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '-');
  return (
    <div className="text-sm space-y-1">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span className="font-mono">{u.address}</span>
        <span>昵称: {u.nickname ?? '-'}</span>
        <span>shortCode: {u.shortCode ?? '-'}</span>
        <span>状态: <span className={u.status === 'BANNED' ? 'text-red-400' : 'text-green-400'}>{u.status}</span></span>
      </div>
      {showAncestors && (
        <div className="text-white/80">
          推荐链（根 → 自己）：
          {u.ancestors.length === 0 ? (
            <span className="text-white/40">无上级（根节点）</span>
          ) : (
            <span className="text-xs inline-flex flex-wrap items-center gap-1">
              {u.ancestors.map((a, idx) => (
                <span key={a.shortCode} className="inline-flex items-center gap-1">
                  {idx > 0 && <span className="text-white/40">→</span>}
                  <AddressTag address={a.address} />
                  {a.nickname && <span className="text-white/60">({a.nickname})</span>}
                </span>
              ))}
              <span className="text-white/40">→</span>
              <AddressTag address={u.address} className="text-yellow-300" />
              <span className="text-yellow-300">（自己）</span>
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-white/80">
        <span>团队等级: <span className="text-yellow-300">{u.teamLevel}</span></span>
        <span>团队人数(不含自己): <span className="text-yellow-300">{u.teamSize}</span></span>
        <span>小区激活: {u.portionActivated}</span>
        <span>hakcard: {u.hakcard}</span>
        <span>tribute: {u.tribute}</span>
      </div>
      <div className="text-white/80">
        激活：
        {u.activation ? (
          <span>
            {u.activation.package} / {u.activation.amountUsdt} USDT / 激活 {fmt(u.activation.activatedAt)} / 过期 {fmt(u.activation.expiresAt)}
          </span>
        ) : (
          <span className="text-white/40">未激活</span>
        )}
      </div>
      <div className="text-white/80">
        验证者：
        {u.arbiter ? (
          <span>
            {u.arbiter.active ? <span className="text-green-400">active</span> : <span className="text-red-400">inactive</span>}
            {' '}/ 成为 {fmt(u.arbiter.becameAt)} / 过期 {fmt(u.arbiter.expiresAt)}
          </span>
        ) : (
          <span className="text-white/40">非验证者</span>
        )}
      </div>
    </div>
  );
}

export default AdminStatisticsPage;