"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import AddCustomerModal from "./AddCustomerModal";
import EditCustomerModal from "./EditCustomerModal";
import Link from "next/link";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  segment: string;
  points: number;
  totalSpent: number;
  lastVisit: Date | null;
  birthday: Date | null;
  notes: string | null;  createdAt: Date;
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
  NEW: "bg-blue-100 text-blue-800",
  REGULAR: "bg-green-100 text-green-800",
  VIP: "bg-purple-100 text-purple-800",
  AT_RISK: "bg-orange-100 text-orange-800",
  CHURNED: "bg-red-100 text-red-800",
};

const segmentLabels: Record<string, string> = {
  NEW: "New",
  REGULAR: "Regular",
  VIP: "VIP",
  AT_RISK: "At Risk",
  CHURNED: "Churned",
};

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
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {segmentLabels[segment]} ({getTotalForSegment(segment)})
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {customers.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No customers found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Segment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Visit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-medium text-sm">
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
                          className="text-sm font-medium text-gray-900 hover:text-primary"
                        >
                          {customer.name}
                        </Link>
                        <div className="text-sm text-gray-500">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer._count.checkIns}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.points.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${customer.totalSpent.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.lastVisit
                      ? format(new Date(customer.lastVisit), "MMM d, yyyy")
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingCustomer(customer)}
                      className="text-primary hover:text-primary-700 mr-3"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
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
    </>
  );
}
