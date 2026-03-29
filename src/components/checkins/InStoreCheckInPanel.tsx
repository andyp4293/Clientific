"use client";

import { useMemo, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, ExternalLink, Smartphone } from "lucide-react";
import { toast } from "sonner";

type BusinessInfo = {
  name: string;
  publicId: string;
};

type InStoreCheckInPanelProps = {
  business: BusinessInfo | null;
};

export default function InStoreCheckInPanel({
  business,
}: InStoreCheckInPanelProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const checkInUrl = useMemo(() => {
    if (typeof window === "undefined" || !business?.publicId) return "";
    return `${window.location.origin}/check-in/${business.publicId}`;
  }, [business?.publicId]);

  function copyLink() {
    if (!checkInUrl) return;
    navigator.clipboard.writeText(checkInUrl);
    toast.success("In-store check-in link copied");
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientific-check-in-kiosk-qr.png";
    a.click();
  }

  return (
    <section className="card relative overflow-hidden rounded-[30px] p-5 sm:p-6">
      <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />

      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                Kiosk link
              </p>
              <h2 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">
                Share the check-in flow
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                One link and QR code for the front desk, tablet, or self-serve
                kiosk.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {business ? "Live" : "Loading"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr),280px]">
          <div className="space-y-4">
            <div className="rounded-[26px] border border-gray-200/80 bg-white/80 p-4 shadow-[0_20px_45px_-35px_rgba(16,72,56,0.32)] dark:border-white/10 dark:bg-white/[0.04]">
              <label
                htmlFor="in-store-checkin-link"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400"
              >
                Device link
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="in-store-checkin-link"
                  readOnly
                  value={checkInUrl}
                  className="input flex-1 text-sm"
                  placeholder={
                    business
                      ? "Generating front-desk link..."
                      : "Business profile still loading..."
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    disabled={!checkInUrl}
                    className="btn-secondary text-sm"
                  >
                    <Copy className="mr-1.5 h-4 w-4" />
                    Copy
                  </button>
                  <a
                    href={checkInUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn-primary text-sm ${!checkInUrl ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Open
                  </a>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-gray-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Front Desk
                </p>
                <p className="mt-2 text-sm font-medium text-gray-950 dark:text-white">
                  Open the link on the kiosk, tablet, or front-desk phone.
                </p>
              </div>
              <div className="rounded-[22px] border border-gray-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Self-Serve
                </p>
                <p className="mt-2 text-sm font-medium text-gray-950 dark:text-white">
                  Use the QR code when you want guests to launch it
                  themselves.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200/80 bg-white/80 p-5 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                  QR code
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Scan to open the same check-in page instantly.
                </p>
              </div>
            </div>
            {checkInUrl ? (
              <>
                <div
                  ref={qrRef}
                  className="mx-auto mt-5 inline-flex rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700"
                >
                  <QRCodeCanvas value={checkInUrl} size={180} level="M" />
                </div>
                <button
                  type="button"
                  onClick={downloadQr}
                  className="mt-4 text-sm font-semibold text-primary hover:text-primary/80"
                >
                  <Download className="mr-1 inline h-4 w-4" />
                  Download QR
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-gray-300 px-4 py-10 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Waiting for business profile data...
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
