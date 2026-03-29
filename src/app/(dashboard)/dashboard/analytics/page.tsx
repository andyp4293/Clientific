'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageLoading } from '@/components/layout/DashboardPageLoading';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

type Range = '7d' | '30d' | '90d';

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#2563eb',
  completed: '#16a34a',
  pending: '#d97706',
  cancelled: '#dc2626',
  scheduled: '#7c3aed',
  no_show: '#6b7280',
};

const SEGMENT_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  REGULAR: '#22c55e',
  VIP: '#a855f7',
  AT_RISK: '#f97316',
  CHURNED: '#ef4444',
};

const FALLBACK_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?range=${range}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  const stats = data?.stats ?? { totalRevenue: 0, totalAppointments: 0, newCustomers: 0, avgRevenuePerVisit: 0 };
  const revenueByWeek = data?.revenueByWeek ?? [];
  const appointmentsByStatus = data?.appointmentsByStatus ?? [];
  const topServices = data?.topServices ?? [];
  const customerSegments = data?.customerSegments ?? [];
  const maxServiceCount = topServices[0]?.count ?? 1;

  if (isLoading) {
    return <DashboardPageLoading />;
  }

  return (
    <div className="space-y-6">
      {/* Header + Range Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track your business performance over time.</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      <>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <StatCard label="Appointments" value={stats.totalAppointments.toString()} />
          <StatCard label="New Customers" value={stats.newCustomers.toString()} />
          <StatCard label="Avg per Visit" value={`$${stats.avgRevenuePerVisit.toFixed(2)}`} />
        </div>

        {/* Revenue Chart */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue by Week</h2>
          {revenueByWeek.length === 0 || revenueByWeek.every((w: any) => w.revenue === 0) ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No revenue data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueByWeek} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appointments by Status */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Appointments by Status</h2>
              {appointmentsByStatus.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No appointments in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={appointmentsByStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {appointmentsByStatus.map((entry: any, index: number) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Customer Segments */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Customer Segments</h2>
              {customerSegments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No customer data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={customerSegments}
                      dataKey="count"
                      nameKey="segment"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                    >
                      {customerSegments.map((entry: any, index: number) => (
                        <Cell key={entry.segment} fill={SEGMENT_COLORS[entry.segment] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Services */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Services</h2>
            {topServices.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No service data for this period.</p>
            ) : (
              <div className="space-y-3">
                {topServices.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 truncate flex-shrink-0">{s.name}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-primary"
                        style={{ width: `${Math.round((s.count / maxServiceCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-6 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </>
    </div>
  );
}
