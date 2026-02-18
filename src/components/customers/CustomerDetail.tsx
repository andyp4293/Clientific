"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import EditCustomerModal from "./EditCustomerModal";

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

export default function CustomerDetail({ customer }: { customer: Customer }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "points">(
    "overview"
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/dashboard/customers"
                className="text-gray-600 hover:text-gray-900"
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
                <h1 className="text-3xl font-bold text-gray-900">
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
                  <span className="text-sm text-gray-500">
                    Customer since {format(new Date(customer.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn-primary"
          >
            Edit Customer
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">
              Total Visits
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {customer._count.checkIns}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">
              Total Spent
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${customer.totalSpent.toFixed(2)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">
              Loyalty Points
            </div>            <div className="text-2xl font-bold text-purple-600">
              {customer.points.toLocaleString()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">
              Total Visits
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {customer._count.checkIns}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-600">Email</div>
              <div className="text-gray-900 mt-1">
                {customer.email || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Phone</div>
              <div className="text-gray-900 mt-1">
                {customer.phone || "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Birthday</div>
              <div className="text-gray-900 mt-1">
                {customer.birthday
                  ? format(new Date(customer.birthday), "MMMM d, yyyy")
                  : "Not provided"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Last Visit</div>
              <div className="text-gray-900 mt-1">
                {customer.lastVisit
                  ? format(new Date(customer.lastVisit), "MMM d, yyyy")
                  : "Never"}
              </div>
            </div>
          </div>
          {customer.notes && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-600">Notes</div>
              <div className="text-gray-900 mt-1">{customer.notes}</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "overview"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Visit History
              </button>
              <button
                onClick={() => setActiveTab("points")}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === "points"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Recent Check-Ins
                  </h3>
                  {customer.checkIns.length === 0 ? (
                    <p className="text-gray-500">No check-ins yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.checkIns.map((checkIn) => (
                        <div
                          key={checkIn.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {format(new Date(checkIn.createdAt), "MMM d, yyyy h:mm a")}
                            </div>
                            <div className="text-sm text-gray-500">
                              Spent: ${checkIn.amountSpent?.toFixed(2) || "0.00"} • Earned: {checkIn.pointsEarned} pts
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
                  <p className="text-gray-500">No appointments yet</p>
                ) : (
                  customer.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {appointment.service?.name || "General Appointment"}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {format(new Date(appointment.startTime), "MMM d, yyyy h:mm a")}
                            {appointment.staff && ` • with ${appointment.staff.fullName}`}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            appointment.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : appointment.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : appointment.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
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
                {/* Redemptions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Reward Redemptions
                  </h3>
                  {customer.redemptions.length === 0 ? (
                    <p className="text-gray-500">No redemptions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.redemptions.map((redemption) => (
                        <div
                          key={redemption.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {redemption.reward.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(redemption.createdAt), "MMM d, yyyy")}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-purple-600">
                            -{redemption.pointsSpent} pts
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Points History */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Points History
                  </h3>
                  {customer.pointsTransactions.length === 0 ? (
                    <p className="text-gray-500">No points transactions yet</p>
                  ) : (
                    <div className="space-y-2">                      {customer.pointsTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.description}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {format(new Date(transaction.createdAt), "MMM d, yyyy h:mm a")}
                            </div>
                          </div>
                          <div
                            className={`text-sm font-medium ${
                              transaction.amount > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {transaction.amount > 0 ? "+" : ""}
                            {transaction.amount} pts
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
