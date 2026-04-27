'use client';

import React, { useState } from 'react';

type CommunityUserItem = {
  id: string;
  walletAddress: string;
  type: 'COMMUNITY' | null;
  referralCode: string | null;
  superior: string | null;
  purchaseAt: string | null;
  equityActivedAt: string | null;
  createdAt: string;
};

const AdminStatisticsPage = () => {
  const [communityUsers, setCommunityUsers] = useState<CommunityUserItem[]>([]);
  const [communityCount, setCommunityCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [targetWallet, setTargetWallet] = useState('');
  const [targetType, setTargetType] = useState<'COMMUNITY' | 'NULL'>('COMMUNITY');
  const [typeLoading, setTypeLoading] = useState(false);
  const [typeMessage, setTypeMessage] = useState('');
  const [typeError, setTypeError] = useState('');

  const [compensateTxHash, setCompensateTxHash] = useState('');
  const [compensateLoading, setCompensateLoading] = useState(false);
  const [compensateMessage, setCompensateMessage] = useState('');
  const [compensateError, setCompensateError] = useState('');

  const fetchCommunityUsers = async (nextPage = page, nextPageSize = pageSize) => {
    setListLoading(true);
    setListError('');

    try {
      const response = await fetch(`/api/admin/community-users?page=${nextPage}&pageSize=${nextPageSize}`, {
        method: 'GET'
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`);
      }

      setCommunityUsers(data.users || []);
      setCommunityCount(data.count || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || nextPage);
      setPageSize(data.pageSize || nextPageSize);
    } catch (error) {
      setListError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setListLoading(false);
    }
  };

  const updateCommunityType = async () => {
    setTypeLoading(true);
    setTypeError('');
    setTypeMessage('');

    try {
      const response = await fetch('/api/admin/community-type', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: targetWallet,
          type: targetType === 'COMMUNITY' ? 'COMMUNITY' : null
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`);
      }

      setTypeMessage(`设置成功：${data.user?.walletAddress} -> ${data.user?.type ?? 'NULL'}`);
      await fetchCommunityUsers(page, pageSize);
    } catch (error) {
      setTypeError(error instanceof Error ? error.message : '设置失败');
    } finally {
      setTypeLoading(false);
    }
  };

  const compensateCommunityTransaction = async () => {
    setCompensateLoading(true);
    setCompensateError('');
    setCompensateMessage('');

    try {
      const response = await fetch('/api/points/community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          txHash: compensateTxHash
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`);
      }

      setCompensateMessage('补偿调用成功');
      await fetchCommunityUsers(page, pageSize);
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

        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">1) 查询验证者总人数和列表</h2>
            <button
              onClick={() => void fetchCommunityUsers(page, pageSize)}
              disabled={listLoading}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm disabled:bg-gray-600"
            >
              {listLoading ? '查询中...' : '刷新'}
            </button>
          </div>

          <div className="text-sm text-white/80">当前验证者总人数：{communityCount}</div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-white/20">
                  <th className="py-2 pr-3">walletAddress</th>
                  <th className="py-2 pr-3">type</th>
                  <th className="py-2 pr-3">referralCode</th>
                  <th className="py-2 pr-3">createdAt</th>
                </tr>
              </thead>
              <tbody>
                {communityUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/10">
                    <td className="py-2 pr-3 font-mono">{user.walletAddress}</td>
                    <td className="py-2 pr-3">{user.type === 'COMMUNITY' ? '验证者' : 'NULL'}</td>
                    <td className="py-2 pr-3">{user.referralCode ?? '-'}</td>
                    <td className="py-2 pr-3">{user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!listLoading && communityUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-white/60">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => void fetchCommunityUsers(Math.max(1, page - 1), pageSize)}
              disabled={listLoading || page <= 1}
              className="rounded bg-gray-700 px-3 py-1 disabled:bg-gray-800"
            >
              上一页
            </button>
            <span>第 {page} / {totalPages} 页</span>
            <button
              onClick={() => void fetchCommunityUsers(Math.min(totalPages, page + 1), pageSize)}
              disabled={listLoading || page >= totalPages}
              className="rounded bg-gray-700 px-3 py-1 disabled:bg-gray-800"
            >
              下一页
            </button>
          </div>

          {listError && <p className="text-red-400 text-sm">{listError}</p>}
        </section>

        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">2) 手动设置用户 type (验证者 / NULL)</h2>
          <input
            value={targetWallet}
            onChange={(e) => setTargetWallet(e.target.value)}
            placeholder="用户钱包地址"
            className="w-full rounded border border-white/20 bg-black/50 px-3 py-2 text-sm font-mono"
          />
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as 'COMMUNITY' | 'NULL')}
            className="rounded border border-white/20 bg-black/50 px-3 py-2 text-sm"
          >
            <option value="COMMUNITY">验证者</option>
            <option value="NULL">NULL</option>
          </select>
          <div>
            <button
              onClick={() => void updateCommunityType()}
              disabled={typeLoading || !targetWallet.trim()}
              className="rounded bg-emerald-600 px-4 py-2 text-sm disabled:bg-gray-600"
            >
              {typeLoading ? '提交中...' : '提交设置'}
            </button>
          </div>
          {typeMessage && <p className="text-green-400 text-sm">{typeMessage}</p>}
          {typeError && <p className="text-red-400 text-sm">{typeError}</p>}
        </section>

        <section className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">3) 交易补偿</h2>
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

export default AdminStatisticsPage;