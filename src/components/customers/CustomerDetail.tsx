"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import EditCustomerModal from "./EditCustomerModal";
import SendCustomerMessageModal from "./SendCustomerMessageModal";

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
  totalSpent: number;
  lastVisit: Date | null;
  birthday: Date | null;
  notes: string | null;
  createdAt: Date;
  checkIns: Array<{
    id: string;
    createdAt: Date;
    amountSpent: number | null;
  }>;
  appointments: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
    service: { id: string; name: string } | null;
    staff: { id: string; fullName: string } | null;
  }>;
  _count: {
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
  confirmation: "Booking Confirmed",
  reminder: "Reminder",
  cancellation: "Cancellation",
  reschedule: "Reschedule",
  review_request: "Review Request",
  custom: "Direct Message",
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
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "messages">(
    "overview"
  );
  const [requestingReview, setRequestingReview] = useState(false);

  const canSendCustomSms = Boolean(customer.phone && customer.smsConsent && !customer.smsOptedOut);
  const canRequestReview = canSendCustomSms && Boolean(googleReviewUrl || yelpUrl);

  const { data: smsData, isLoading: smsLoading, refetch: refetchSmsLogs } = useQuery({
    queryKey: ["sms-logs", customer.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/sms-logs`);
      if (!res.ok) return { logs: [] };
      return res.json();
    },
    enabled: activeTab === "messages",
  });

  const smsLogs: SmsLog[] = smsData?.logs ?? [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Link
                href="/dashboard/customers"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Back to Customers
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary/15">
                <span className="text-xl font-bold text-primary-600 dark:text-primary-300">
                  {customer.name
                    .split(" ")
                    .map((namePart) => namePart[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {customer.name}
                </h1>
                <div className="mt-1 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${segmentColors[customer.segment]}`}
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
            {canRequestReview && (
              <button
                onClick={async () => {
                  setRequestingReview(true);
                  try {
                    const res = await fetch("/api/reviews/request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ customerId: customer.id }),
                    });
                    if (!res.ok) throw new Error();
                    toast.success("Review request sent!");
                  } catch {
                    toast.error("Failed to send review request");
                  } finally {
                    setRequestingReview(false);
                  }
                }}
                disabled={requestingReview}
                className="btn-outline text-sm"
              >
                {requestingReview ? "Sending..." : "Request Review"}
              </button>
            )}
            <button onClick={() => setIsEditModalOpen(true)} className="btn-primary">
              Edit Customer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Visits
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {customer._count.checkIns}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Spent
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${customer.totalSpent.toFixed(2)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Appointments
            </div>
            <div className="text-2xl font-bold text-primary">{customer._count.appointments}</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customer.email || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customer.phone || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Birthday</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customer.birthday
                  ? format(new Date(customer.birthday), "MMMM d, yyyy")
                  : "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Visit</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customer.lastVisit
                  ? format(new Date(customer.lastVisit), "MMM d, yyyy")
                  : "Never"}
              </div>
            </div>
          </div>
          {customer.notes && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">{customer.notes}</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab("overview")}
                className={`border-b-2 px-6 py-3 text-sm font-medium ${
                  activeTab === "overview"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`border-b-2 px-6 py-3 text-sm font-medium ${
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                Visit History
              </button>
              <button
                onClick={() => setActiveTab("messages")}
                className={`border-b-2 px-6 py-3 text-sm font-medium ${
                  activeTab === "messages"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                Messages
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Recent Check-Ins
                  </h3>
                  {customer.checkIns.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No check-ins yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.checkIns.map((checkIn) => (
                        <div
                          key={checkIn.id}
                          className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700"
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
                      className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {appointment.service?.name || "General Appointment"}
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(appointment.startTime), "MMM d, yyyy h:mm a")}
                            {appointment.staff ? ` - with ${appointment.staff.fullName}` : ""}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
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

            {activeTab === "messages" && (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Message History
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      View prior SMS activity and send one-off texts to this customer.
                    </p>
                  </div>
                  {canSendCustomSms && (
                    <button
                      type="button"
                      onClick={() => setIsMessageModalOpen(true)}
                      className="btn-primary w-full sm:w-auto"
                    >
                      Send Text
                    </button>
                  )}
                </div>

                {!customer.phone ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    No phone number on file - SMS history unavailable.
                  </p>
                ) : customer.smsOptedOut ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    This customer has opted out of SMS, so new messages are unavailable.
                  </p>
                ) : !customer.smsConsent ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    This customer has not consented to SMS yet, so new messages are unavailable.
                  </p>
                ) : smsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : smsLogs.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    No messages sent to this customer yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          <th className="pb-2 pr-4 font-medium">Date</th>
                          <th className="pb-2 pr-4 font-medium">Type</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 font-medium">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {smsLogs.map((log) => (
                          <tr key={log.id} className="align-top">
                            <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-400">
                              {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-gray-900 dark:text-gray-100">
                              {messageTypeLabels[log.messageType] ?? log.messageType}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  log.status === "delivered"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                    : log.status === "failed"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="max-w-xs truncate py-2 text-gray-600 dark:text-gray-400">
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

      <EditCustomerModal
        customer={customer}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
      <SendCustomerMessageModal
        customer={customer}
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        onSent={async () => {
          await refetchSmsLogs();
        }}
      />
    </>
  );
}
