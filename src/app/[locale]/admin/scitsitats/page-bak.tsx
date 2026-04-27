'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import Link from 'next/link';
import { useAppKitAccount } from '@reown/appkit/react';
import ExcelJS from 'exceljs';
import { generateOperationHash } from '@/utils/auth';
import { TokenType } from '@prisma/client';
import { useSignMessage } from 'wagmi';

// Define types for our statistics data
interface TransactionStat {
  total_amount: number;
  type: string;
  token_type: string;
}

interface UserLevelStat {
  count: number;
  level: number;
}

interface UserTypeCount {
  count: number;
  type?: string;
}

interface OperationRecord {
  id: string;
  type: string;
  from_address?: string;
  to_address?: string;
  user_address?: string;
  amount: number;
  created_at: string;
  token_type: string;
  status?: string;
  description?: string;
}

const AdminStatisticsPage = () => {
  const [transactionStats, setTransactionStats] = useState<TransactionStat[]>([]);
  const [userLevelStats, setUserLevelStats] = useState<UserLevelStat[]>([]);
  const [adminAddress, setAdminAddress] = useState<string[]>([]);
  const [operationRecords, setOperationRecords] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedType, setSelectedType] = useState('STAKE');
  const [isSuperior, setIsSuperior] = useState('false');
  const [recordStartDate, setRecordStartDate] = useState('');
  const [recordEndDate, setRecordEndDate] = useState('');

  // Format date for API calls
  const formatDateForApi = (dateTimeString: string) => {
    if (!dateTimeString) return undefined;
    // If it already has a T, it's already in ISO format
    if (dateTimeString.includes('T')) {
      return dateTimeString;
    }
    // Otherwise, add time component
    return `${dateTimeString}T00:00:00`;
  };

  // Format datetime string for API in ISO format, converting local time to UTC
  const formatDateTimeForAPI = (dateTimeString: string) => {
    if (!dateTimeString) return undefined;

    // Parse the local datetime string
    let [datePart, timePart] = ['', '00:00'];

    if (dateTimeString.includes('T')) {
      [datePart, timePart] = dateTimeString.split('T');
    } else {
      datePart = dateTimeString;
    }

    // Ensure time has seconds
    if (timePart.length === 5) { // HH:MM format
      timePart = `${timePart}:00`;
    }

    // Create a Date object from local datetime
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);

    // Create date in local time
    const localDate = new Date(year, month - 1, day, hours, minutes, seconds);

    // Convert to UTC ISO string
    return localDate.toISOString();
  };
  const [statsStartDate, setStatsStartDate] = useState(getLocalTwoWeeksAgo() + 'T00:00');
  const [statsEndDate, setStatsEndDate] = useState(new Date().toLocaleDateString('en-CA') + 'T23:59');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);

  // User type counts state
  const [userTypeCounts, setUserTypeCounts] = useState<UserTypeCount[]>([]);
  const [userCountsLoading, setUserCountsLoading] = useState(false);
  const [userCountsError, setUserCountsError] = useState('');

  // Auditing transactions state
  const [auditingTransactions, setAuditingTransactions] = useState<OperationRecord[]>([]);
  const [auditingLoading, setAuditingLoading] = useState(false);
  const [auditingError, setAuditingError] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<OperationRecord | null>(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Performance statistics state
  const [performanceAddress, setPerformanceAddress] = useState('');
  const [performanceStartDate, setPerformanceStartDate] = useState(getLocalTwoWeeksAgo() + 'T00:00');
  const [performanceEndDate, setPerformanceEndDate] = useState(new Date().toLocaleDateString('en-CA') + 'T23:59');
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState('');

  // Min level update state
  const [minLevelAddress, setMinLevelAddress] = useState('');
  const [minLevel, setMinLevel] = useState(0);
  const [minLevelLoading, setMinLevelLoading] = useState(false);
  const [minLevelError, setMinLevelError] = useState('');
  const [minLevelSuccess, setMinLevelSuccess] = useState('');
  const [userCountAddress, setUserCountAddress] = useState('');
  const [userCountNodeType, setUserCountNodeType] = useState('NORMAL');
  const [userCountIsDirect, setUserCountIsDirect] = useState(true);
    const { signMessageAsync } = useSignMessage();
  

  // Get date from two weeks ago for default start date
  function getTwoWeeksAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toISOString().split('T')[0];
  }

  // Get local date from two weeks ago for default start date
  function getLocalTwoWeeksAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toLocaleDateString('en-CA'); // Format as YYYY-MM-DD
  }

  // Fetch user level statistics
  const fetchUserLevelStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/statistic', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user level statistics');
      }

      const data = await response.json();
      setUserLevelStats(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Load user level statistics on component mount
  useEffect(() => {
    fetchUserLevelStats();
  }, []);

  // Update transaction hash
  const updateTransactionHash = async () => {
    if (!selectedTransaction || !txHashInput.trim()) {
      setUpdateError('Please select a transaction and enter a transaction hash');
      return;
    }

    setUpdateLoading(true);
    setUpdateError('');
    setUpdateSuccess('');

    try {
      const response = await fetch('/api/admin/update-tx-hash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          txHash: txHashInput.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction hash');
      }

      const data = await response.json();
      setUpdateSuccess('Transaction hash updated successfully');
      
      // Refresh the auditing transactions
      await fetchAuditingTransactions();
      
      // Clear selection
      setSelectedTransaction(null);
      setTxHashInput('');
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Fetch auditing transactions
  const fetchAuditingTransactions = async () => {
    setAuditingLoading(true);
    setAuditingError('');

    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch auditing transactions');
      }

      const data = await response.json();
      setAuditingTransactions(data.data || []);
    } catch (err) {
      setAuditingError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setAuditingLoading(false);
    }
  };

  // Fetch transaction statistics
  const fetchTransactionStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/statistic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: statsStartDate ? formatDateTimeForAPI(statsStartDate) : undefined,
          endDate: statsEndDate ? formatDateTimeForAPI(statsEndDate) : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setTransactionStats(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminAddress = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/admin-address', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch special address');
      }

      const data = await response.json();
      setAdminAddress(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch operation records
  const fetchOperationRecords = async () => {

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/operation-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: selectedAddress,
          isSuperior: isSuperior,
          type: selectedType,
          page: page,
          pageSize: pageSize,
          startDate: formatDateTimeForAPI(recordStartDate) || undefined,
          endDate: formatDateTimeForAPI(recordEndDate) || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch operation records');
      }

      const data = await response.json();
      setOperationRecords(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Format amount with token type
  const formatAmount = (amount: number, tokenType: string) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${tokenType}`;
  };

  // Export operation records to Excel
  const exportToExcel = async () => {
    if (operationRecords.length === 0) return;
    
    setExportLoading(true);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Operation Records');
    
    // Define columns with headers
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Address', key: 'address', width: 42 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Token Type', key: 'tokenType', width: 12 },
      { header: 'Description', key: 'description', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];
    
    // Add style to header row
    worksheet.getRow(1).font = { bold: true };
    
    // Add data rows
    operationRecords.forEach(record => {
      worksheet.addRow({
        id: record.id,
        type: record.type,
        address: record.from_address || record.user_address || '',
        amount: record.amount,
        tokenType: record.token_type,
        description: record.description || '',
        status: record.status || '',
        createdAt: format(new Date(record.created_at), 'yyyy-MM-dd HH:mm:ss')
      });
    });
    
    // Generate file name with current date
    const fileName = `operation_records_${selectedType}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
    
    try {
      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create blob and download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    } finally {
      setExportLoading(false);
    }
  };

  // Get the current user's wallet address
  const { address } = useAppKitAccount();

  // Check if the current user's address is in the adminAddress array
  const isAuthorized = true //address && adminAddress.map(addr => addr.toLowerCase()).includes(address.toLowerCase());

  // Update user minimum level
  const updateUserMinLevel = async () => {
    if (!minLevelAddress) {
      setMinLevelError('钱包地址必填');
      return;
    }

    if (minLevel < 0 || minLevel > 9) {
      setMinLevelError('等级必须在 0-10 之间');
      return;
    }

    setMinLevelLoading(true);
    setMinLevelError('');
    setMinLevelSuccess('');

    // Prepare claim info
    const info = {
      operationType: "minLevel",
      amount: 0, // The backend will determine the actual amount
      walletAddress: minLevelAddress,
      timestamp: 0,
      tokenType: TokenType.USDT,
    };

    // Generate and sign operation hash
    const hash = await generateOperationHash(info);
    const signature = await signMessageAsync({ message: hash });

    try {
      const response = await fetch('/api/admin/user-min-level', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address,
          minLevelAddress: minLevelAddress,
          minLevel: minLevel,
          signature: signature
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新用户最低等级失败');
      }

      setMinLevelSuccess(`成功将用户 ${minLevelAddress} 的最低等级设置为 ${minLevel}`);

      // Clear inputs after successful update
      setMinLevelAddress('');
      setMinLevel(0);
    } catch (err) {
      setMinLevelError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setMinLevelLoading(false);
    }
  };

  // Fetch performance statistics
  const fetchPerformanceStats = async () => {
    if (!performanceAddress) {
      setPerformanceError('钱包地址必填');
      return;
    }

    setPerformanceLoading(true);
    setPerformanceError('');
    setPerformanceStats(null);

    try {
      const response = await fetch('/api/admin/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: performanceAddress,
          startDate: performanceStartDate ? formatDateTimeForAPI(performanceStartDate) : undefined,
          endDate: performanceEndDate ? formatDateTimeForAPI(performanceEndDate) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取业绩数据失败');
      }

      const data = await response.json();
      setPerformanceStats(data);
    } catch (err) {
      setPerformanceError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setPerformanceLoading(false);
    }
  };

  // Fetch user counts by type
  const fetchUserTypeCounts = async () => {
    if (!userCountAddress) {
      setUserCountsError('Wallet address is required');
      return;
    }

    setUserCountsLoading(true);
    setUserCountsError('');

    try {
      const counts: UserTypeCount[] = [];

      // Get count for the selected node type
      const response = await fetch('/api/user/subordinates-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: userCountAddress,
          isDirect: userCountIsDirect,
          nodeType: userCountNodeType
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${userCountNodeType} user count`);
      }

      const data = await response.json();
      counts.push({ count: data.count, type: userCountNodeType });

      setUserTypeCounts(counts);
    } catch (err) {
      setUserCountsError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setUserCountsLoading(false);
    }
  };

  // Fetch admin addresses when component mounts
  useEffect(() => {
    fetchAdminAddress();
  }, []);

  // Fetch operation records when page changes
  useEffect(() => {
    if (selectedType && page > 0) {
      fetchOperationRecords();
    }
  }, [page]);

  // If not authorized, show access denied page
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 pb-24 flex flex-col items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4 text-red-500">Access Denied</h1>
          <p className="mb-6">You do not have permission to view this page.</p>
          <Link href="/" className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Platform Statistics</h1>

        {/* User Level Statistics Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">用户等级统计</h2>

          {userLevelStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="py-3 px-4 text-left">等级</th>
                    <th className="py-3 px-4 text-right">数目</th>
                  </tr>
                </thead>
                <tbody>
                  {userLevelStats.map((stat, index) => (
                    <tr key={`level-${stat.level}`} className={index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-750'}>
                      <td className="py-3 px-4">{stat.level}</td>
                      <td className="py-3 px-4 text-right">{stat.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">不存在</div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={fetchUserLevelStats}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              刷新
            </button>
          </div>
        </div>

        {/* User Performance Statistics Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">用户业绩统计</h2>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1">
              <label className="block mb-2">钱包地址</label>
              <input
                type="text"
                value={performanceAddress}
                onChange={(e) => setPerformanceAddress(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="输入钱包地址"
              />
            </div>
            <div className="w-64">
              <label className="block mb-2">起始日期</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={performanceStartDate.split('T')[0] || ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const time = performanceStartDate.includes('T') ? performanceStartDate.split('T')[1] : '00:00';
                    // Use local date format
                    setPerformanceStartDate(date ? `${date}T${time}` : '');
                  }}
                  className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
                <input
                  type="time"
                  value={performanceStartDate.includes('T') ? performanceStartDate.split('T')[1] : '00:00'}
                  onChange={(e) => {
                    // Get local date or use current date
                    const date = performanceStartDate.split('T')[0] || new Date().toLocaleDateString('en-CA');
                    setPerformanceStartDate(`${date}T${e.target.value}`);
                  }}
                  className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="w-64">
              <label className="block mb-2">截止日期</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={performanceEndDate.split('T')[0] || ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const time = performanceEndDate.includes('T') ? performanceEndDate.split('T')[1] : '23:59';
                    // Use local date format
                    setPerformanceEndDate(date ? `${date}T${time}` : '');
                  }}
                  className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
                <input
                  type="time"
                  value={performanceEndDate.includes('T') ? performanceEndDate.split('T')[1] : '23:59'}
                  onChange={(e) => {
                    // Get local date or use current date
                    const date = performanceEndDate.split('T')[0] || new Date().toLocaleDateString('en-CA');
                    setPerformanceEndDate(`${date}T${e.target.value}`);
                  }}
                  className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchPerformanceStats}
                disabled={performanceLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                {performanceLoading ? '加载中...' : '查询业绩'}
              </button>
            </div>
          </div>

          {performanceError && <div className="text-red-500 mb-4">{performanceError}</div>}

          {performanceStats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">行星节点</h3>
                  <div className="flex justify-between mb-2">
                    <span>数量:</span>
                    <span className="font-bold">{performanceStats.groupCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>金额:</span>
                    <span className="font-bold">{Number(performanceStats.groupAmount).toLocaleString()} USDT</span>
                  </div>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">恒星节点</h3>
                  <div className="flex justify-between mb-2">
                    <span>数量:</span>
                    <span className="font-bold">{performanceStats.communityCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>金额:</span>
                    <span className="font-bold">{Number(performanceStats.communityAmount).toLocaleString()} USDT</span>
                  </div>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg md:col-span-2">
                  <h3 className="text-lg font-semibold mb-2">总业绩</h3>
                  <div className="flex justify-between">
                    <span>总金额:</span>
                    <span className="font-bold">
                      {(Number(performanceStats.groupAmount) + Number(performanceStats.communityAmount)).toLocaleString()} USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Group Users Table */}
              {performanceStats.groupUsers && performanceStats.groupUsers.length > 0 && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">行星节点详情</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                      <thead className="bg-gray-600">
                        <tr>
                          <th className="py-2 px-4 text-left">地址</th>
                          <th className="py-2 px-4 text-left">类型</th>
                          <th className="py-2 px-4 text-left">日期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceStats.groupUsers.map((user: any, index: number) => (
                          <tr key={user.address} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                            <td className="py-2 px-4 font-mono text-sm">{user.address}</td>
                            <td className="py-2 px-4">{user.type}</td>
                            <td className="py-2 px-4">{new Date(user.buy_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Community Users Table */}
              {performanceStats.communityUsers && performanceStats.communityUsers.length > 0 && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">恒星节点详情</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                      <thead className="bg-gray-600">
                        <tr>
                          <th className="py-2 px-4 text-left">地址</th>
                          <th className="py-2 px-4 text-left">类型</th>
                          <th className="py-2 px-4 text-left">日期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceStats.communityUsers.map((user: any, index: number) => (
                          <tr key={user.address} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                            <td className="py-2 px-4 font-mono text-sm">{user.address}</td>
                            <td className="py-2 px-4">{user.type}</td>
                            <td className="py-2 px-4">{new Date(user.buy_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">请输入地址和日期范围查询业绩数据</div>
          )}
        </div>

        {/* User Min Level Update Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">用户最低等级设置</h2>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1">
              <label className="block mb-2">钱包地址</label>
              <input
                type="text"
                value={minLevelAddress}
                onChange={(e) => setMinLevelAddress(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="输入钱包地址"
              />
            </div>
            <div className="w-64">
              <label className="block mb-2">最低等级</label>
              <input
                type="number"
                min="0"
                max="10"
                value={minLevel}
                onChange={(e) => setMinLevel(parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="输入等级 (0-10)"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={updateUserMinLevel}
                disabled={minLevelLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                {minLevelLoading ? '更新中...' : '更新等级'}
              </button>
            </div>
          </div>

          {minLevelError && <div className="text-red-500 mb-4">{minLevelError}</div>}
          {minLevelSuccess && <div className="text-green-500 mb-4">{minLevelSuccess}</div>}
        </div>

        {/* User Type Counts Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">用户类型统计</h2>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1">
              <label className="block mb-2">地址</label>
              <input
                type="text"
                value={userCountAddress}
                onChange={(e) => setUserCountAddress(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="Enter wallet address"
              />
            </div>
            <div className="w-48">
              <label className="block mb-2">节点类型</label>
              <select
                value={userCountNodeType}
                onChange={(e) => setUserCountNodeType(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="NORMAL">未激活节点 (NORMAL)</option>
                <option value="GROUP">行星节点 (GROUP)</option>
                <option value="COMMUNITY">恒星节点 (COMMUNITY)</option>
                <option value="GALAXY">银河节点 (GALAXY)</option>
              </select>
            </div>
            <div className="w-48">
              <label className="block mb-2">Relationship</label>
              <select
                value={userCountIsDirect ? 'true' : 'false'}
                onChange={(e) => setUserCountIsDirect(e.target.value === 'true')}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="true">直推 (Direct)</option>
                <option value="false">伞下 (All)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchUserTypeCounts}
                disabled={userCountsLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                {userCountsLoading ? 'Loading...' : 'Fetch User Counts'}
              </button>
            </div>
          </div>

          {userCountsError && <div className="text-red-500 mb-4">{userCountsError}</div>}

          {userTypeCounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="py-3 px-4 text-left">用户类型</th>
                    <th className="py-3 px-4 text-right">数目</th>
                  </tr>
                </thead>
                <tbody>
                  {userTypeCounts.map((stat, index) => (
                    <tr key={`type-${stat.type}`} className={index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-750'}>
                      <td className="py-3 px-4">
                        {stat.type === 'NORMAL' && '未激活节点 (NORMAL)'}
                        {stat.type === 'GROUP' && '行星节点 (GROUP)'}
                        {stat.type === 'COMMUNITY' && '恒星节点 (COMMUNITY)'}
                        {stat.type === 'GALAXY' && '银河节点 (GALAXY)'}
                      </td>
                      <td className="py-3 px-4 text-right">{stat.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">No user type counts available. Please fetch data.</div>
          )}
        </div>

        {/* Transaction Statistics Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">出入金统计</h2>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="mb-6">
              <label className="block mb-2">日期范围</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block mb-2">起始</label>
                  {/* <div className="flex gap-2">
                    <input
                      type="date"
                      value={statsStartDate.split('T')[0] || ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = statsStartDate.includes('T') ? statsStartDate.split('T')[1] : '00:00';
                        // Use local date format
                        setStatsStartDate(date ? `${date}T${time}` : '');
                      }}
                      className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                    <input
                      type="time"
                      value={statsStartDate.includes('T') ? statsStartDate.split('T')[1] : '00:00'}
                      onChange={(e) => {
                        // Get local date or use current date
                        const date = statsStartDate.split('T')[0] || new Date().toLocaleDateString('en-CA');
                        setStatsStartDate(`${date}T${e.target.value}`);
                      }}
                      className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                  </div> */}
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={statsStartDate.split('T')[0] || ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = statsStartDate.includes('T') ? statsStartDate.split('T')[1] : '00:00';
                        // Use local date format
                        setStatsStartDate(date ? `${date}T${time}` : '');
                      }}
                      className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                    <input
                      type="time"
                      value={statsStartDate.includes('T') ? statsStartDate.split('T')[1] : '00:00'}
                      onChange={(e) => {
                        // Get local date or use current date
                        const date = statsStartDate.split('T')[0] || new Date().toLocaleDateString('en-CA');
                        setStatsStartDate(`${date}T${e.target.value}`);
                      }}
                      className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block mb-2">截止</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={statsEndDate.split('T')[0] || ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = statsEndDate.includes('T') ? statsEndDate.split('T')[1] : '23:59';
                        // Use local date format
                        setStatsEndDate(date ? `${date}T${time}` : '');
                      }}
                      className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                    <input
                      type="time"
                      value={statsEndDate.includes('T') ? statsEndDate.split('T')[1] : '23:59'}
                      onChange={(e) => {
                        // Get local date or use current date
                        const date = statsEndDate.split('T')[0] || new Date().toLocaleDateString('en-CA');
                        setStatsEndDate(`${date}T${e.target.value}`);
                      }}
                      className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchTransactionStats}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {loading ? 'Loading...' : 'Fetch Statistics'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="text-red-500 mb-4">{error}</div>}

          {transactionStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="py-3 px-4 text-left">交易类型</th>
                    <th className="py-3 px-4 text-left">代币类型</th>
                    <th className="py-3 px-4 text-right">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionStats.map((stat, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-750'}>
                      <td className="py-3 px-4">{stat.type === 'LOCK' ? '节点入金' : stat.type === 'OUT' ? '提现' : stat.type}</td>
                      <td className="py-3 px-4">{stat.token_type}</td>
                      <td className="py-3 px-4 text-right">{formatAmount(stat.total_amount, stat.token_type)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">No statistics available. Please fetch data.</div>
          )}
        </div>

        {/* Operation Records Section */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">操作记录</h2>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1">
              <label className="block mb-2">地址</label>              <input
                type="text"
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="Enter user address"
              />
            </div>
            <div className="w-48">
              <label className="block mb-2">操作类型</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="STAKE">质押</option>
                <option value="FLASH_SWAP">闪兑</option>
                <option value="OUT">提现</option>
                <option value="LOCK">节点入金</option>
              </select>
            </div>
            <div className="w-48">
              <label className="block mb-2">Transaction Scope</label>
              <select
                value={isSuperior}
                onChange={(e) => setIsSuperior(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="false">Personal (本人)</option>
                <option value="true">Subordinates (伞下)</option>
              </select>
            </div>
            <div className="w-64">
              <label className="block mb-2">起始</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={recordStartDate.split('T')[0] || ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const time = recordStartDate.includes('T') ? recordStartDate.split('T')[1] : '00:00';
                    setRecordStartDate(date ? `${date}T${time}` : '');
                  }}
                  className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
                <input
                  type="time"
                  value={recordStartDate.includes('T') ? recordStartDate.split('T')[1] : '00:00'}
                  onChange={(e) => {
                    const date = recordStartDate.split('T')[0] || new Date().toISOString().split('T')[0];
                    setRecordStartDate(`${date}T${e.target.value}`);
                  }}
                  className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="w-64">
              <label className="block mb-2">截止</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={recordEndDate.split('T')[0] || ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const time = recordEndDate.includes('T') ? recordEndDate.split('T')[1] : '23:59';
                    setRecordEndDate(date ? `${date}T${time}` : '');
                  }}
                  className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
                <input
                  type="time"
                  value={recordEndDate.includes('T') ? recordEndDate.split('T')[1] : '23:59'}
                  onChange={(e) => {
                    const date = recordEndDate.split('T')[0] || new Date().toISOString().split('T')[0];
                    setRecordEndDate(`${date}T${e.target.value}`);
                  }}
                  className="w-24 p-2 bg-gray-700 rounded border border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="w-32">
              <label className="block mb-2">Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <button
                onClick={fetchOperationRecords}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                {loading ? 'Loading...' : 'Fetch Records'}
              </button>
              <button
                onClick={() => exportToExcel()}
                disabled={loading || exportLoading || operationRecords.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                {exportLoading ? 'Exporting...' : 'Export to Excel'}
              </button>
            </div>
          </div>

          {operationRecords.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-600">
                    <tr>
                      <th className="py-3 px-4 text-left">ID</th>
                      <th className="py-3 px-4 text-left">Type</th>
                      <th className="py-3 px-4 text-left">Address</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-left">Description</th>
                      <th className="py-3 px-4 text-left">Date</th>
                      {selectedType === 'FLASH_SWAP' && (
                        <th className="py-3 px-4 text-left">Status</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {operationRecords.map((record, index) => (
                      <tr key={record.id} className={index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-750'}>
                        <td className="py-3 px-4">{record.id}</td>
                        <td className="py-3 px-4">{record.type}</td>
                        <td className="py-3 px-4 font-mono text-sm">
                          {record.from_address || record.user_address}
                        </td>
                        <td className="py-3 px-4 text-right">{formatAmount(record.amount, record.token_type)}</td>
                        <td className="py-3 px-4">{record.description || '-'}</td>
                        <td className="py-3 px-4">
                          {new Date(record.created_at).toLocaleString()}
                        </td>
                        {selectedType === 'FLASH_SWAP' && (
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${record.status === 'CONFIRMED' ? 'bg-green-800' :
                                record.status === 'PENDING' ? 'bg-yellow-800' :
                                  record.status === 'FAILED' ? 'bg-red-800' : 'bg-gray-600'
                              }`}>
                              {record.status}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-center mt-6">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="flex space-x-2">
                  <span className="px-3 py-1">
                    Total Amount: {totalAmount}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-center py-8">No records available. Please fetch data.</div>
          )}
        </div>

        {/* Auditing Transactions Section */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">审核中的提现交易</h2>

          <div className="mb-6">
            <button
              onClick={fetchAuditingTransactions}
              disabled={auditingLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              {auditingLoading ? 'Loading...' : 'Fetch Auditing Transactions'}
            </button>
          </div>

          {auditingError && <div className="text-red-500 mb-4">{auditingError}</div>}

          {auditingTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="py-3 px-4 text-left">ID</th>
                    <th className="py-3 px-4 text-left">发送地址</th>
                    <th className="py-3 px-4 text-left">接收地址</th>
                    <th className="py-3 px-4 text-left">类型</th>
                    <th className="py-3 px-4 text-right">金额</th>
                    <th className="py-3 px-4 text-left">代币类型</th>
                    <th className="py-3 px-4 text-left">状态</th>
                    <th className="py-3 px-4 text-left">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {auditingTransactions.map((transaction, index) => (
                    <tr 
                      key={transaction.id} 
                      className={`cursor-pointer transition-colors ${
                        index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-750'
                      } ${
                        selectedTransaction?.id === transaction.id ? 'ring-2 ring-blue-500' : ''
                      } hover:bg-gray-600`}
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <td className="py-3 px-4">{transaction.id}</td>
                      <td className="py-3 px-4 font-mono text-xs max-w-xs break-all">
                        {transaction.from_address || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs max-w-xs break-all">
                        {transaction.to_address || '-'}
                      </td>
                      <td className="py-3 px-4">{transaction.type}</td>
                      <td className="py-3 px-4 text-right">{formatAmount(transaction.amount, transaction.token_type)}</td>
                      <td className="py-3 px-4">{transaction.token_type}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">
                          {transaction.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {transaction.created_at ? new Date(transaction.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">No auditing transactions available.</div>
          )}

          {/* Transaction Hash Update Section */}
          {selectedTransaction && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-blue-500">
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                Update Transaction Hash - ID: {selectedTransaction.id}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">From Address:</label>
                  <div className="font-mono text-xs bg-gray-800 p-2 rounded break-all">
                    {selectedTransaction.from_address || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">To Address:</label>
                  <div className="font-mono text-xs bg-gray-800 p-2 rounded break-all">
                    {selectedTransaction.to_address || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount:</label>
                  <div className="bg-gray-800 p-2 rounded">
                    {formatAmount(selectedTransaction.amount, selectedTransaction.token_type)} {selectedTransaction.token_type}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Created At:</label>
                  <div className="bg-gray-800 p-2 rounded">
                    {selectedTransaction.created_at ? new Date(selectedTransaction.created_at).toLocaleString() : '-'}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Transaction Hash:</label>
                <input
                  type="text"
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  placeholder="Enter transaction hash (e.g., 0x...)"
                  className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-white font-mono text-sm"
                />
              </div>

              {updateError && <div className="text-red-500 mb-4">{updateError}</div>}
              {updateSuccess && <div className="text-green-500 mb-4">{updateSuccess}</div>}

              <div className="flex gap-2">
                <button
                  onClick={updateTransactionHash}
                  disabled={updateLoading || !txHashInput.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  {updateLoading ? 'Updating...' : 'Update Hash'}
                </button>
                <button
                  onClick={() => {
                    setSelectedTransaction(null);
                    setTxHashInput('');
                    setUpdateError('');
                    setUpdateSuccess('');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStatisticsPage;
