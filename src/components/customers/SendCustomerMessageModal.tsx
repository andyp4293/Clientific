"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

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
        throw new Error(data.error || "Failed to send message");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Send Text to {customer.name}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              We automatically prepend your business name before the message.
            </p>
            {customer.phone && (
              <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {customer.phone}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close send text modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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
              className="input min-h-[132px] resize-y"
            />
            <div className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
              {message.trim().length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
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
              disabled={loading}
              className="flex-1 btn-primary"
            >
              {loading ? "Sending..." : "Send Text"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
