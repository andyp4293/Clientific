"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";

type CustomerGroup = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
  _count?: {
    memberships: number;
  };
};

type BroadcastTarget = "all" | "groups";

type BroadcastPreview = {
  dryRun: boolean;
  target: BroadcastTarget;
  eligibleCount: number;
  skippedDuplicateCount: number;
  skippedInvalidPhoneCount: number;
  disabledGroupCount: number;
  selectedGroups: Array<{
    id: string;
    name: string;
    promotionSmsEnabled: boolean;
  }>;
  recipientsPreview: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  sent: number;
  failed: number;
};

interface SendCustomerBroadcastModalProps {
  groups: CustomerGroup[];
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void | Promise<void>;
}

const MAX_MESSAGE_LENGTH = 500;

function getAudienceLabel(target: BroadcastTarget, selectedGroupCount: number) {
  if (target === "groups") {
    return selectedGroupCount === 1 ? "1 group" : `${selectedGroupCount} groups`;
  }

  return "All SMS subscribers";
}

export default function SendCustomerBroadcastModal({
  groups,
  isOpen,
  onClose,
  onSent,
}: SendCustomerBroadcastModalProps) {
  const [target, setTarget] = useState<BroadcastTarget>("all");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const selectedGroupKey = selectedGroupIds.join("|");
  const canLoadPreview = target === "all" || selectedGroupIds.length > 0;
  const eligibleCount = preview?.eligibleCount ?? 0;
  const trimmedMessage = message.trim();
  const canSend =
    Boolean(trimmedMessage) &&
    trimmedMessage.length <= MAX_MESSAGE_LENGTH &&
    Boolean(preview) &&
    eligibleCount > 0;

  const selectedGroupNames = useMemo(() => {
    const selected = new Set(selectedGroupIds);
    return groups
      .filter((group) => selected.has(group.id))
      .map((group) => group.name)
      .join(", ");
  }, [groups, selectedGroupIds]);

  useEffect(() => {
    if (!isOpen) {
      setTarget("all");
      setSelectedGroupIds([]);
      setMessage("");
      setPreview(null);
      setPreviewLoading(false);
      setLoading(false);
      setError("");
      setConfirming(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setConfirming(false);
  }, [isOpen, message, selectedGroupKey, target]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!canLoadPreview) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setPreviewLoading(true);
      setError("");

      try {
        const response = await fetch("/api/customers/broadcast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dryRun: true,
            target,
            groupIds: target === "groups" ? selectedGroupIds : [],
          }),
          signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load broadcast audience");
        }

        setPreview(data);
      } catch (previewError: any) {
        if (!controller.signal.aborted) {
          setPreview(null);
          setError(previewError?.message || "Unable to load broadcast audience");
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [canLoadPreview, isOpen, selectedGroupIds, target]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((entry) => entry !== groupId)
        : [...current, groupId],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedMessage) {
      setError("Message is required");
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less`);
      return;
    }

    if (target === "groups" && selectedGroupIds.length === 0) {
      setError("Select at least one customer group");
      return;
    }

    if (!preview || eligibleCount === 0) {
      setError("There are no eligible SMS subscribers in this audience");
      return;
    }

    if (!confirming) {
      setError("");
      setConfirming(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/customers/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target,
          groupIds: target === "groups" ? selectedGroupIds : [],
          message: trimmedMessage,
          confirmSend: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send broadcast");
      }

      if (data.failed > 0) {
        setError(`${data.sent} texts sent. ${data.failed} failed and were logged.`);
        setPreview(data);
        setConfirming(false);
        return;
      }

      toast.success(`Broadcast sent to ${data.sent} SMS subscriber${data.sent === 1 ? "" : "s"}`);
      await onSent?.();
      onClose();
    } catch (sendError: any) {
      setError(sendError?.message || "Failed to send broadcast");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  const modal = (
    <div
      data-mobile-overlay="true"
      className="fixed inset-0 z-[70] overflow-hidden bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"
    >
      <div className="flex h-[100svh] min-h-[100svh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:min-h-0 sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 bg-gradient-to-b from-primary/[0.08] via-white to-white dark:border-gray-700 dark:from-primary/[0.14] dark:via-gray-800 dark:to-gray-800">
          <div className="h-[env(safe-area-inset-top)] bg-white/95 dark:bg-gray-800/95 sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-0 sm:pt-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary dark:border-primary/25 dark:bg-primary/[0.14]">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Bulk SMS
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Text subscribers
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                Send one message to customers with marketing SMS consent. Opt-outs, blocked deal SMS customers, disabled promotion groups, and duplicate phone numbers are excluded.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-gray-200/80 bg-white/80 p-2 text-gray-400 transition-colors hover:bg-white hover:text-gray-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close broadcast modal"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 sm:pb-0">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <section className="rounded-[28px] border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Audience
                  </h4>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {getAudienceLabel(target, selectedGroupIds.length)}
                    {target === "groups" && selectedGroupNames ? `: ${selectedGroupNames}` : ""}
                  </p>
                </div>
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(["all", "groups"] as const).map((option) => {
                  const selected = target === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTarget(option)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        selected
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:border-primary/30 hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                      aria-pressed={selected}
                    >
                      {option === "all" ? "All subscribers" : "Customer groups"}
                    </button>
                  );
                })}
              </div>

              {target === "groups" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {groups.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No customer groups yet.</p>
                  ) : (
                    groups.map((group) => {
                      const selected = selectedGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                            selected
                              ? "border-primary bg-primary/10 text-primary dark:bg-primary/15"
                              : "border-gray-200 bg-white text-gray-700 hover:border-primary/30 hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                          aria-pressed={selected}
                        >
                          <span>{group.name}</span>
                          <span className="text-xs font-medium opacity-75">
                            {group.promotionSmsEnabled ? `${group._count?.memberships ?? 0}` : "SMS off"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-gray-200 bg-white/70 p-4 dark:border-gray-700 dark:bg-gray-900/60 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Eligible recipients
                  </h4>
                  <p className="mt-1 text-3xl font-semibold text-gray-950 dark:text-white">
                    {previewLoading ? "..." : eligibleCount}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {previewLoading
                      ? "Checking consent and group settings..."
                      : eligibleCount === 1
                        ? "1 customer can receive this broadcast."
                        : `${eligibleCount} customers can receive this broadcast.`}
                  </p>
                  {preview && (preview.skippedDuplicateCount > 0 || preview.skippedInvalidPhoneCount > 0 || preview.disabledGroupCount > 0) ? (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Excluded {preview.skippedDuplicateCount} duplicate phone
                      {preview.skippedDuplicateCount === 1 ? "" : "s"}
                      {preview.skippedInvalidPhoneCount > 0
                        ? ` and ${preview.skippedInvalidPhoneCount} invalid phone ${
                            preview.skippedInvalidPhoneCount === 1 ? "number" : "numbers"
                          }`
                        : ""}
                      {preview.disabledGroupCount > 0
                        ? `; ${preview.disabledGroupCount} selected group ${
                            preview.disabledGroupCount === 1 ? "has" : "have"
                          } promotion SMS off`
                        : ""}
                      .
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40 sm:p-5">
              <label htmlFor="customer-broadcast-message" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Message
              </label>
              <textarea
                id="customer-broadcast-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Type the message you want to send..."
                className="input min-h-[180px] resize-none sm:min-h-[132px]"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="max-w-[70%] leading-5">
                  Your business name and opt-out language are added automatically.
                </span>
                <span className="shrink-0 text-right">
                  {message.trim().length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </section>

            {confirming ? (
              <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-200">
                Ready to send this exact text to {eligibleCount} SMS subscriber
                {eligibleCount === 1 ? "" : "s"}. This cannot be undone.
              </div>
            ) : null}
          </div>

          <div
            className="border-t border-gray-200 bg-white/95 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/95 sm:border-t-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-4 dark:sm:bg-transparent"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="grid gap-3 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading || previewLoading || !canSend}
                className="w-full btn-primary sm:flex-1"
              >
                {loading
                  ? "Sending..."
                  : confirming
                    ? `Send to ${eligibleCount} subscriber${eligibleCount === 1 ? "" : "s"}`
                    : "Review broadcast"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="w-full btn-outline sm:flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
