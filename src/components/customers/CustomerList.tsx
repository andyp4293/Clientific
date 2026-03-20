"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import AddCustomerModal from "./AddCustomerModal";
import EditCustomerModal from "./EditCustomerModal";
import SendCustomerMessageModal from "./SendCustomerMessageModal";
import Link from "next/link";

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
  _count: {
    checkIns: number;
    appointments: number;
  };
};

type SegmentCount = {
  segment: string;
  _count: number;
};

interface CustomerListProps {
  customers: Customer[];
  segmentCounts: SegmentCount[];
  initialSearch?: string;
  initialSegment?: string;
}

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

function getSmsStatus(customer: Pick<Customer, "phone" | "smsConsent" | "smsOptedOut">) {
  if (!customer.phone) {
    return {
      label: "No phone",
      description: "No SMS number on file",
      className:
        "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    };
  }

  if (customer.smsOptedOut) {
    return {
      label: "Opted out",
      description: "Stopped SMS",
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };
  }

  if (customer.smsConsent) {
    return {
      label: "Subscribed",
      description: "Can receive SMS",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
  }

  return {
    label: "Not opted in",
    description: "No SMS consent yet",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  };
}

export default function CustomerList({
  customers,
  segmentCounts,
  initialSearch = "",
  initialSegment = "",
}: CustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [messagingCustomer, setMessagingCustomer] = useState<Customer | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    router.push(`/dashboard/customers?${params.toString()}`);
  };

  const handleSegmentFilter = (segment: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (segment === initialSegment) {
      params.delete("segment");
    } else {
      params.set("segment", segment);
    }
    router.push(`/dashboard/customers?${params.toString()}`);
  };

  const getTotalForSegment = (segment: string) => {
    return segmentCounts.find((s) => s.segment === segment)?._count || 0;
  };

  return (
    <>
      {/* Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary whitespace-nowrap"
          >
            + Add Customer
          </button>
        </div>

        {/* Segment Filters */}
        <div className="flex flex-wrap gap-2">
          {["NEW", "REGULAR", "VIP", "AT_RISK", "CHURNED"].map((segment) => (
            <button
              key={segment}
              onClick={() => handleSegmentFilter(segment)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                initialSegment === segment
                  ? segmentColors[segment]
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {segmentLabels[segment]} ({getTotalForSegment(segment)})
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {customers.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              No customers found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding your first customer.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary"
              >
                + Add Customer
              </button>
            </div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Segment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Visits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Visit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SMS Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer) => {
                const smsStatus = getSmsStatus(customer);

                return (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary-100 dark:bg-primary/15 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 dark:text-primary-300 font-medium text-sm">
                          {customer.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary"
                        >
                          {customer.name}
                        </Link>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.email || customer.phone || "No contact info"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        segmentColors[customer.segment]
                      }`}
                    >
                      {segmentLabels[customer.segment]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {customer._count.checkIns}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {customer.points.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    ${customer.totalSpent.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {customer.lastVisit
                      ? format(new Date(customer.lastVisit), "MMM d, yyyy")
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${smsStatus.className}`}
                      >
                        {smsStatus.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {smsStatus.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-1">
                      {customer.phone && (
                        <button
                          onClick={() => setMessagingCustomer(customer)}
                          disabled={!customer.smsConsent || customer.smsOptedOut}
                          title={
                            customer.smsOptedOut
                              ? "This customer has opted out of SMS"
                              : !customer.smsConsent
                                ? "This customer has not consented to SMS"
                                : "Send a text message"
                          }
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4-.823L3 20l1.055-3.165A7.421 7.421 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Text
                        </button>
                      )}
                      <button
                        onClick={() => setEditingCustomer(customer)}
                        title="Edit customer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        title="View profile"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          isOpen={true}
          onClose={() => setEditingCustomer(null)}
        />
      )}
      {messagingCustomer && (
        <SendCustomerMessageModal
          customer={messagingCustomer}
          isOpen={true}
          onClose={() => setMessagingCustomer(null)}
        />
      )}
    </>
  );
}
