"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import EditCustomerModal from "./EditCustomerModal";

type SmsLog = {
  id: string;
  createdAt: string;
  messageType: string;
  status: string;
  message: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsConsent: boolean;
  smsOptedOut: boolean;
  segment: string;
  points: number;
  totalSpent: number;
  lastVisit: Date | null;
  birthday: Date | null;
  notes: string | null;
  createdAt: Date;
  checkIns: Array<{
    id: string;
    createdAt: Date;
    amountSpent: number | null;    pointsEarned: number;
  }>;
  appointments: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
    service: { id: string; name: string } | null;
    staff: { id: string; fullName: string } | null;
  }>;
  redemptions: Array<{
    id: string;
    createdAt: Date;
    code: string;
    pointsSpent: number;
    reward: {
      name: string;
    };
  }>;
  pointsTransactions: Array<{
    id: string;
    amount: number;
    description: string;
    createdAt: Date;
  }>;  _count: {
    checkIns: number;
    appointments: number;
  };
};

const segmentColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  REGULAR: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  VIP: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  AT_RISK: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  CHURNED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

const segmentLabels: Record<string, string> = {
  NEW: "New",
  REGULAR: "Regular",
  VIP: "VIP",
  AT_RISK: "At Risk",
  CHURNED: "Churned",
};

const messageTypeLabels: Record<string, string> = {
  confirmation: 'Booking Confirmed',
  reminder: 'Reminder',
  cancellation: 'Cancellation',
  reschedule: 'Reschedule',
  review_request: 'Review Request',
};

export default function CustomerDetail({
  customer,
  googleReviewUrl,
  yelpUrl,
}: {
  customer: Customer;
  googleReviewUrl?: string | null;
  yelpUrl?: string | null;
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "messages" | "points">(
    "overview"
  );
  const [requestingReview, setRequestingReview] = useState(false);

  const { data: smsData, isLoading: smsLoading } = useQuery({
    queryKey: ['sms-logs', customer.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/sms-logs`);
      if (!res.ok) return { logs: [] };
      return res.json();
    },
    enabled: activeTab === 'messages',
  });

  const smsLogs: SmsLog[] = smsData?.logs ?? [];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/dashboard/customers"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                ← Back to Customers
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-bold text-xl">
                  {customer.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {customer.name}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      segmentColors[customer.segment]
                    }`}
                  >
                    {segmentLabels[customer.segment]}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Customer since {format(new Date(customer.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {customer.phone && customer.smsConsent && !customer.smsOptedOut && (googleReviewUrl || yelpUrl) && (
              <button
                onClick={async () => {
                  setRequestingReview(true);
                  try {
                    const res = await fetch('/api/reviews/request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerId: customer.id }),
                    });
                    if (!res.ok) throw new Error();
                    toast.success('Review request sent!');
                  } catch {
                    toast.error('Failed to send review request');
                  } finally {
                    setRequestingReview(false);
                  }
                }}
                disabled={requestingReview}
                className="btn-outline text-sm"
              >
                {requestingReview ? 'Sending…' : 'Request Review'}
              </button>
            )}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-primary"
            >
              Edit Customer
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Visits
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {customer._count.checkIns}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Spent
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${customer.totalSpent.toFixed(2)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Appointments
            </div>
            <div className="text-2xl font-bold text-primary">
              {customer._count.appointments}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">
                {customer.email || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">
                {customer.phone || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Birthday</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">
                {customer.birthday
                  ? format(new Date(customer.birthday), "MMMM d, yyyy")
                  : "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Visit</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">
                {customer.lastVisit
                  ? format(new Date(customer.lastVisit), "MMM d, yyyy")
                  : "Never"}
              </div>
            </div>
          </div>
          {customer.notes && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{customer.notes}</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "overview"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                Visit History
              </button>
              <button
                onClick={() => setActiveTab("messages")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "messages"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                Messages
              </button>
              <button
                onClick={() => setActiveTab("points")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "points"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                Points & Rewards
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Recent Check-Ins */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Recent Check-Ins
                  </h3>
                  {customer.checkIns.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No check-ins yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.checkIns.map((checkIn) => (
                        <div
                          key={checkIn.id}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {format(new Date(checkIn.createdAt), "MMM d, yyyy h:mm a")}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Spent: ${checkIn.amountSpent?.toFixed(2) || "0.00"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-4">
                {customer.appointments.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No appointments yet</p>
                ) : (
                  customer.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {appointment.service?.name || "General Appointment"}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {format(new Date(appointment.startTime), "MMM d, yyyy h:mm a")}
                            {appointment.staff && ` • with ${appointment.staff.fullName}`}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            appointment.status === "COMPLETED"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                              : appointment.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                              : appointment.status === "CANCELLED"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                          }`}
                        >
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "points" && (
              <div className="space-y-6">
                {/* Points Balance */}
                <div className="flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary/10 rounded-lg">
                  <div className="text-4xl font-bold text-primary">{customer.points}</div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Points Balance</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Available to redeem</div>
                  </div>
                </div>

                {/* Points Transactions */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Points History</h3>
                  {customer.pointsTransactions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No points activity yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-2 pr-4 font-medium">Date</th>
                            <th className="pb-2 pr-4 font-medium">Description</th>
                            <th className="pb-2 font-medium text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {customer.pointsTransactions.map((tx) => (
                            <tr key={tx.id}>
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {format(new Date(tx.createdAt), 'MMM d, yyyy')}
                              </td>
                              <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{tx.description}</td>
                              <td className={`py-2 text-right font-medium whitespace-nowrap ${tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {tx.amount >= 0 ? '+' : ''}{tx.amount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Redemptions */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Rewards Redeemed</h3>
                  {customer.redemptions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No rewards redeemed yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.redemptions.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.reward.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {format(new Date(r.createdAt), 'MMM d, yyyy')} · Code: <span className="font-mono">{r.code}</span>
                            </div>
                          </div>
                          <div className="text-sm font-medium text-red-600 dark:text-red-400">−{r.pointsSpent} pts</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "messages" && (
              <div>
                {!customer.phone ? (
                  <p className="text-gray-500 dark:text-gray-400">No phone number on file — SMS history unavailable.</p>
                ) : smsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : smsLogs.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No messages sent to this customer yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-2 pr-4 font-medium">Date</th>
                          <th className="pb-2 pr-4 font-medium">Type</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 font-medium">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {smsLogs.map((log) => (
                          <tr key={log.id} className="align-top">
                            <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                            </td>
                            <td className="py-2 pr-4 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {messageTypeLabels[log.messageType] ?? log.messageType}
                            </td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.status === 'delivered'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                  : log.status === 'failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                              {log.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditCustomerModal
        customer={customer}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </>
  );
}
