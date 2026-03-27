"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

interface SendCustomerMessageModalProps {
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void | Promise<void>;
}

type DirectMessageQuota = {
  limit: number;
  used: number;
  remaining: number;
  periodEnd: string;
  isActive: boolean;
};

const MAX_MESSAGE_LENGTH = 500;

export default function SendCustomerMessageModal({
  customer,
  isOpen,
  onClose,
  onSent,
}: SendCustomerMessageModalProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<DirectMessageQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setError("");
      setLoading(false);
      setQuota(null);
      setQuotaLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const loadQuota = async () => {
      setQuotaLoading(true);

      try {
        const response = await fetch(`/api/customers/${customer.id}/sms-logs`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setQuota(data.quota ?? null);
        }
      } catch {
        if (!cancelled) {
          setQuota(null);
        }
      } finally {
        if (!cancelled) {
          setQuotaLoading(false);
        }
      }
    };

    void loadQuota();

    return () => {
      cancelled = true;
    };
  }, [customer.id, isOpen]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Message is required");
      return;
    }

    if (quota && quota.remaining <= 0) {
      setError("Monthly direct message limit reached for this subscription period");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/customers/${customer.id}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data?.quota) {
          setQuota(data.quota);
        }
        throw new Error(data.error || "Failed to send message");
      }

      if (data?.quota) {
        setQuota(data.quota);
      }
      toast.success(`Message sent to ${customer.name}`);
      await onSent?.();
      onClose();
    } catch (submitError: any) {
      setError(submitError?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div data-mobile-overlay="true" className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-6">
      <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 bg-gradient-to-b from-primary/[0.08] via-white to-white dark:border-gray-700 dark:from-primary/[0.14] dark:via-gray-800 dark:to-gray-800">
          <div className="h-[env(safe-area-inset-top)] bg-white/95 dark:bg-gray-800/95 sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-0 sm:pt-6">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary dark:border-primary/25 dark:bg-primary/[0.14]">
                Direct message
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Send text to {customer.name}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
                We prepend your business name automatically so the customer immediately knows who the text is from.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {customer.phone ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200">
                    {customer.phone}
                  </span>
                ) : null}
                {quotaLoading ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400">
                    Checking direct message allowance...
                  </span>
                ) : quota ? (
                  <>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                        quota.remaining > 0
                          ? "bg-primary/10 text-primary dark:bg-primary/15"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {quota.remaining} of {quota.limit} direct messages left
                    </span>
                    <span className="inline-flex items-center rounded-full border border-gray-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400">
                      Resets {format(new Date(quota.periodEnd), "MMM d")}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-gray-200/80 bg-white/80 p-2 text-gray-400 transition-colors hover:bg-white hover:text-gray-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close send text modal"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 sm:pb-0">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="rounded-[28px] border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40 sm:p-5">
              <label htmlFor="customer-message" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Message
              </label>
              <textarea
                id="customer-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Type the message you want to send..."
                className="input min-h-[180px] resize-none sm:min-h-[132px]"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="max-w-[70%] leading-5">
                  Keep it concise. Direct customer texts are counted separately from deal and promotion SMS.
                </span>
                <span className="shrink-0 text-right">
                  {message.trim().length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            {quota && (
              <div className="rounded-[28px] border border-gray-200 bg-white/70 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
                This direct-message allowance resets with the current subscription period and does not affect deals SMS messages.
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 sm:flex-row sm:border-t-0 sm:px-6 sm:pb-6 sm:pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || quotaLoading || Boolean(quota && quota.remaining <= 0)}
              className="flex-1 btn-primary"
            >
              {loading ? "Sending..." : quota && quota.remaining <= 0 ? "Limit Reached" : "Send Text"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
