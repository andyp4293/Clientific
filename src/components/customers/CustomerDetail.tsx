"use client";

import { useEffect, useState } from "react";
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

type DirectMessageQuota = {
  limit: number;
  used: number;
  remaining: number;
  periodEnd: string;
  isActive: boolean;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsConsent: boolean;
  smsMarketingConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked?: boolean;
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
    serviceDisplayName?: string | null;
    staff: { id: string; fullName: string } | null;
  }>;
  _count: {
    checkIns: number;
    appointments: number;
  };
  groupMemberships?: Array<{
    group: {
      id: string;
      name: string;
      promotionSmsEnabled: boolean;
    };
  }>;
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
  customer_broadcast: "Customer Broadcast",
};

export default function CustomerDetail({
  customer,
  groups,
}: {
  customer: Customer;
  groups: Array<{
    id: string;
    name: string;
    promotionSmsEnabled: boolean;
  }>;
}) {
  const [customerRecord, setCustomerRecord] = useState(customer);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "messages">(
    "overview"
  );
  const [requestingReview, setRequestingReview] = useState(false);

  useEffect(() => {
    setCustomerRecord(customer);
  }, [customer]);

  const canSendCustomSms = Boolean(
    customerRecord.phone && customerRecord.smsConsent && !customerRecord.smsOptedOut
  );
  const canRequestReview = canSendCustomSms;

  const { data: smsData, isLoading: smsLoading, refetch: refetchSmsLogs } = useQuery({
    queryKey: ["sms-logs", customerRecord.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerRecord.id}/sms-logs`);
      if (!res.ok) return { logs: [] };
      return res.json();
    },
    enabled: activeTab === "messages",
  });

  const smsLogs: SmsLog[] = smsData?.logs ?? [];
  const directMessageQuota: DirectMessageQuota | null = smsData?.quota ?? null;

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
                  {customerRecord.name
                    .split(" ")
                    .map((namePart) => namePart[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {customerRecord.name}
                </h1>
                <div className="mt-1 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${segmentColors[customerRecord.segment]}`}
                  >
                    {segmentLabels[customerRecord.segment]}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Customer since {format(new Date(customerRecord.createdAt), "MMM d, yyyy")}
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
                      body: JSON.stringify({ customerId: customerRecord.id }),
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
              {customerRecord._count.checkIns}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Spent
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${customerRecord.totalSpent.toFixed(2)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Appointments
            </div>
            <div className="text-2xl font-bold text-primary">{customerRecord._count.appointments}</div>
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
                {customerRecord.email || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customerRecord.phone || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Birthday</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customerRecord.birthday
                  ? format(new Date(customerRecord.birthday), "MMMM d, yyyy")
                  : "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Visit</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customerRecord.lastVisit
                  ? format(new Date(customerRecord.lastVisit), "MMM d, yyyy")
                  : "Never"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Deals SMS</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customerRecord.dealSmsBlocked ? "Deals blocked by you" : "Deals SMS allowed"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Marketing SMS</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {customerRecord.smsMarketingConsent && !customerRecord.smsOptedOut
                  ? "Marketing SMS on"
                  : "Marketing SMS denied"}
              </div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {customerRecord.smsMarketingConsent && !customerRecord.smsOptedOut
                  ? "Included in subscriber broadcasts."
                  : "Not included in subscriber broadcasts."}
              </div>
            </div>
          </div>
          {customerRecord.notes && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</div>
              <div className="mt-1 text-gray-900 dark:text-gray-100">{customerRecord.notes}</div>
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
                  {customerRecord.checkIns.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No check-ins yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customerRecord.checkIns.map((checkIn) => (
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
                {customerRecord.appointments.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No appointments yet</p>
                ) : (
                  customerRecord.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {appointment.serviceDisplayName || appointment.service?.name || "General Appointment"}
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
                    {directMessageQuota && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {directMessageQuota.remaining} of {directMessageQuota.limit} direct customer
                        {" "}messages left this period. Resets{" "}
                        {format(new Date(directMessageQuota.periodEnd), "MMM d, yyyy")}.
                      </p>
                    )}
                  </div>
                  {canSendCustomSms && (
                    <button
                      type="button"
                      onClick={() => setIsMessageModalOpen(true)}
                      disabled={Boolean(directMessageQuota && directMessageQuota.remaining <= 0)}
                      className="btn-primary w-full sm:w-auto"
                    >
                      {directMessageQuota && directMessageQuota.remaining <= 0
                        ? "Direct Message Limit Reached"
                        : "Send Text"}
                    </button>
                  )}
                </div>

                {directMessageQuota && (
                  <div
                    className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                      directMessageQuota.remaining > 0
                        ? "border-primary/20 bg-primary/[0.05] text-gray-700 dark:border-primary/30 dark:bg-primary/[0.08] dark:text-gray-200"
                        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
                    }`}
                  >
                    {directMessageQuota.remaining > 0
                      ? "Direct customer texts count against your plan’s monthly message allowance."
                      : "This plan’s monthly direct customer message allowance has been used up for the current period."}
                  </div>
                )}

                {!customerRecord.phone ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    No phone number on file - SMS history unavailable.
                  </p>
                ) : customerRecord.smsOptedOut ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    This customer has opted out of SMS, so new messages are unavailable.
                  </p>
                ) : !customerRecord.smsConsent ? (
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
        customer={customerRecord}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        groups={groups}
        onSaved={(nextCustomer) =>
          setCustomerRecord((current) => ({
            ...current,
            ...nextCustomer,
            checkIns: nextCustomer.checkIns ?? current.checkIns,
            appointments: nextCustomer.appointments ?? current.appointments,
            _count: nextCustomer._count ?? current._count,
            groupMemberships: nextCustomer.groupMemberships ?? current.groupMemberships,
          }))
        }
      />
      <SendCustomerMessageModal
        customer={customerRecord}
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        onSent={async () => {
          await refetchSmsLogs();
        }}
      />
    </>
  );
}
