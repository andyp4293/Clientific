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
      className="fixed inset-0 z-[70] bg-gray-50 p-0 dark:bg-gray-900 sm:bg-black/50 sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-6"
    >
      <div className="flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-gray-50 shadow-none dark:bg-gray-900 sm:h-auto sm:min-h-0 sm:max-h-[90vh] sm:max-w-xl sm:rounded-[28px] sm:border sm:border-gray-200 sm:bg-white sm:shadow-2xl dark:sm:border-gray-700 dark:sm:bg-gray-900">
        <div className="bg-gray-50 dark:bg-gray-900">
          <div className="h-[env(safe-area-inset-top)] bg-gray-50 dark:bg-gray-900 sm:hidden" />
          <div className="flex items-center justify-between border-b border-gray-200/80 px-5 py-4 dark:border-gray-800 sm:px-6 sm:pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Customer group
            </p>
            <h3 className="mt-1 text-[2rem] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {group ? "Edit group" : "Create group"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6 sm:pb-0">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="rounded-[28px] border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950/60">
              <label
                htmlFor="customer-group-name"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400"
              >
                Group name
              </label>
              <input
                id="customer-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
                placeholder="VIP regulars"
                maxLength={60}
                required
              />
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Promotion SMS
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Include this group in deal and promotion blasts.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={promotionSmsEnabled}
                  aria-label="Toggle promotion SMS"
                  onClick={() => setPromotionSmsEnabled((current) => !current)}
                  className={`relative inline-flex h-12 min-w-[112px] shrink-0 items-center overflow-hidden rounded-full border p-1 text-sm font-semibold transition-colors ${
                    promotionSmsEnabled
                      ? "border-primary/40 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/15"
                      : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                  }`}
                >
                  <span
                    className={`absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-full shadow-sm transition-transform ${
                      promotionSmsEnabled
                        ? "translate-x-[calc(100%+0.25rem)] bg-primary"
                        : "translate-x-0 bg-white dark:bg-gray-800"
                    }`}
                  />
                  <span
                    className={`relative z-10 flex-1 text-center transition-colors ${
                      promotionSmsEnabled ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    Off
                  </span>
                  <span
                    className={`relative z-10 flex-1 text-center transition-colors ${
                      promotionSmsEnabled ? "text-white" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    On
                  </span>
                </button>
              </div>
            </div>

            {group ? (
              <div className="rounded-[28px] border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-300">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Members
                </p>
                <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                  {group._count?.memberships ?? 0} customer
                  {(group._count?.memberships ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-gray-200/80 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-800 sm:px-6 sm:pb-6">
            {group ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="mb-3 inline-flex w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
              >
                Delete group
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-transparent px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Saving..." : group ? "Save group" : "Create group"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
