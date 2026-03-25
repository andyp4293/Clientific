"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import CustomerGroupSelector from "./CustomerGroupSelector";

type CustomerGroup = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
};

interface EditCustomerModalProps {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    birthday: Date | null;
    notes: string | null;
    groupMemberships?: Array<{
      group: CustomerGroup;
    }>;
  };
  isOpen: boolean;
  onClose: () => void;
  groups: CustomerGroup[];
}

export default function EditCustomerModal({
  customer,
  isOpen,
  onClose,
  groups,
}: EditCustomerModalProps) {
  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const fromDateInputValue = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: customer.name,
    email: customer.email || "",
    phone: customer.phone || "",
    birthday: customer.birthday ? toDateInputValue(new Date(customer.birthday)) : "",
    notes: customer.notes || "",
    groupIds: (customer.groupMemberships ?? []).map((membership) => membership.group.id),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update customer");
      }

      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this customer? This action cannot be undone."
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete customer");
      }

      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div data-mobile-overlay="true" className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-6">
      <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-700 sm:border-b-0 sm:px-6 sm:pb-0 sm:pt-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Edit Customer
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close edit customer modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:pb-0">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="birthday" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Birthday
              </label>
              <DatePicker
                value={formData.birthday ? fromDateInputValue(formData.birthday) : null}
                onChange={(date) =>
                  setFormData({
                    ...formData,
                    birthday: toDateInputValue(date),
                  })
                }
                onClear={() => setFormData({ ...formData, birthday: "" })}
                allowClear
                placeholder="Select birthday"
              />
            </div>

            <div>
              <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                className="input"
              />
            </div>

            <CustomerGroupSelector
              groups={groups}
              selectedGroupIds={formData.groupIds}
              onChange={(groupIds) => setFormData({ ...formData, groupIds })}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 sm:border-t-0 sm:px-6 sm:pb-6 sm:pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="btn-danger w-full sm:w-auto"
            >
              Delete
            </button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-primary"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
