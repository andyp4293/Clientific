"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CustomerGroup = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
  _count?: {
    memberships: number;
  };
};

interface CustomerGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: CustomerGroup | null;
}

export default function CustomerGroupModal({
  isOpen,
  onClose,
  group,
}: CustomerGroupModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [promotionSmsEnabled, setPromotionSmsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(group?.name ?? "");
    setPromotionSmsEnabled(group?.promotionSmsEnabled ?? true);
    setError("");
    setLoading(false);
  }, [group, isOpen]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(group ? `/api/customer-groups/${group.id}` : "/api/customer-groups", {
        method: group ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          promotionSmsEnabled,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || "Failed to save customer group");
      }

      router.refresh();
      onClose();
    } catch (saveError: any) {
      setError(saveError?.message || "Failed to save customer group");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!group) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${group.name}? Customers will stay in your database, but this group and its settings will be removed.`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/customer-groups/${group.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || "Failed to delete customer group");
      }

      router.refresh();
      onClose();
    } catch (deleteError: any) {
      setError(deleteError?.message || "Failed to delete customer group");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      data-mobile-overlay="true"
      className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-6"
    >
      <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-700 sm:border-b-0 sm:px-6 sm:pb-0 sm:pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Customer group
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {group ? "Edit group" : "Create group"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close customer group modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="customer-group-name"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Group name
              </label>
              <input
                id="customer-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="VIP regulars"
                maxLength={60}
                required
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Send promotions and deals by SMS to this group
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    When this is off, customers who only belong to this group are skipped during
                    deal text blasts.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={promotionSmsEnabled}
                  onClick={() => setPromotionSmsEnabled((current) => !current)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    promotionSmsEnabled
                      ? "bg-primary"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      promotionSmsEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {group ? (
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                {group._count?.memberships ?? 0} customer
                {(group._count?.memberships ?? 0) === 1 ? "" : "s"} currently assigned.
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 sm:px-6 sm:pb-6 sm:pt-4">
            {group ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="btn-danger w-full sm:w-auto"
              >
                Delete group
              </button>
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 btn-outline"
              >
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 btn-primary">
                {loading ? "Saving..." : group ? "Save group" : "Create group"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
