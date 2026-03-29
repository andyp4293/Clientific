"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/DatePicker";
import { CustomSelect } from "@/components/ui/CustomSelect";
import InStoreCheckInPanel from "@/components/checkins/InStoreCheckInPanel";
import { formatPhoneForDisplay } from "@/lib/phone";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lastVisit?: string | null;
};

type Service = {
  id: string;
  name: string;
  price: number | null;
};

type Staff = {
  id: string;
  fullName: string;
};

type CheckIn = {
  id: string;
  checkInTime: string;
  amountSpent: number | null;
  customer: Customer;
  service: Service | null;
  staff: Staff | null;
};

type LookupResponse =
  | { status: "new"; normalizedPhone: string; displayPhone: string }
  | { status: "existing"; customer: Customer }
  | { status: "multiple"; customers: Customer[] };

type CheckInsResponse = {
  checkIns: CheckIn[];
  timezone: string;
};

type CustomersResponse = {
  customers: Customer[];
};

type ServicesResponse = {
  services: Service[];
};

type StaffResponse = {
  staff: Staff[];
};

type BusinessInfoResponse = {
  business: {
    name: string;
    publicId: string | null;
  };
};

type QuickStep = "phone" | "new" | "multiple" | "success";
type CheckInMode = "quick" | "detailed";

type QuickSuccessState = {
  customerName: string;
  phoneDisplay: string;
  checkInTime: string;
  createdCustomer: boolean;
};

const PHONE_MAX_LENGTH = 10;
const SUCCESS_RESET_SECONDS = 8;
const DEFAULT_FORM_DATA = { customerId: "", serviceId: "", staffId: "" };
const DEFAULT_NEW_CUSTOMER_FORM = { name: "", email: "" };
const KEYPAD_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "clear",
  "0",
  "back",
] as const;

function formatDateLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function sanitizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.startsWith("1") && digits.length > 10) {
    return digits.slice(1, 11);
  }
  return digits.slice(0, 10);
}

function formatPhoneEntry(value: string) {
  const digits = sanitizePhoneDigits(value);
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!normalized) return "";
  if (normalized.length <= 3) return normalized;
  if (normalized.length <= 6)
    return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
}

function canLookupPhone(value: string) {
  return sanitizePhoneDigits(value).length === 10;
}

function formatSuccessTime(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function formatLastVisit(
  isoString: string | null | undefined,
  timezone: string,
) {
  if (!isoString) return "No previous visit yet";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

function KeypadButton({
  label,
  hint,
  onClick,
  className = "",
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-h-[84px] overflow-hidden rounded-[1.65rem] border border-gray-200 bg-white/80 text-left shadow-[0_18px_45px_-28px_rgba(16,72,56,0.42)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_50px_-28px_rgba(16,72,56,0.55)] dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-primary/40 ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3 py-4">
        <span className="text-2xl font-semibold text-gray-950 dark:text-white">
          {label}
        </span>
        {hint ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
            {hint}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function CheckInsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mode, setMode] = useState<CheckInMode>("quick");
  const [quickStep, setQuickStep] = useState<QuickStep>("phone");
  const [quickDigits, setQuickDigits] = useState("");
  const [quickPhoneDisplay, setQuickPhoneDisplay] = useState("");
  const [quickMatchedCustomers, setQuickMatchedCustomers] = useState<
    Customer[]
  >([]);
  const [quickLookupError, setQuickLookupError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<QuickSuccessState | null>(
    null,
  );
  const [successCountdown, setSuccessCountdown] = useState(
    SUCCESS_RESET_SECONDS,
  );
  const [newCustomerForm, setNewCustomerForm] = useState(
    DEFAULT_NEW_CUSTOMER_FORM,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const selectedDateKey = useMemo(
    () => formatDateLocal(selectedDate),
    [selectedDate],
  );
  const quickFormattedPhone = useMemo(
    () => formatPhoneEntry(quickDigits),
    [quickDigits],
  );
  const quickPhoneReady = useMemo(
    () => canLookupPhone(quickDigits),
    [quickDigits],
  );

  const { data: checkInsData, isLoading: isLoadingCheckIns } =
    useQuery<CheckInsResponse>({
      queryKey: ["checkins", selectedDateKey],
      queryFn: async () => {
        const res = await fetch(`/api/checkins?date=${selectedDateKey}`);
        if (!res.ok) throw new Error("Failed to fetch check-ins");
        return res.json();
      },
    });

  const { data: businessInfoData } = useQuery<BusinessInfoResponse>({
    queryKey: ["business-info"],
    queryFn: async () => {
      const res = await fetch("/api/business");
      if (!res.ok) throw new Error("Failed to fetch business info");
      return res.json();
    },
  });

  const { data: customersData } = useQuery<CustomersResponse>({
    queryKey: ["customers", searchTerm],
    queryFn: async () => {
      const res = await fetch(
        `/api/customers?search=${encodeURIComponent(searchTerm)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: showModal && mode === "detailed" && searchTerm.trim().length >= 2,
  });

  const { data: servicesData } = useQuery<ServicesResponse>({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    enabled: showModal && mode === "detailed",
  });

  const { data: staffData } = useQuery<StaffResponse>({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: showModal && mode === "detailed",
  });

  const checkIns = checkInsData?.checkIns ?? [];
  const timezone = checkInsData?.timezone ?? "America/New_York";
  const customers = customersData?.customers ?? [];
  const services = servicesData?.services ?? [];
  const staff = staffData?.staff ?? [];
  const selectedDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [selectedDate],
  );
  const uniqueGuests = useMemo(
    () => new Set(checkIns.map((checkIn) => checkIn.customer.id)).size,
    [checkIns],
  );
  const latestCheckIn = useMemo(
    () =>
      checkIns.reduce<CheckIn | null>((latest, current) => {
        if (!latest) return current;
        return new Date(current.checkInTime).getTime() >
          new Date(latest.checkInTime).getTime()
          ? current
          : latest;
      }, null),
    [checkIns],
  );
  const latestCheckInLabel = latestCheckIn
    ? formatSuccessTime(latestCheckIn.checkInTime, timezone)
    : "No check-ins yet";
  const inStoreBusiness =
    businessInfoData?.business?.publicId && businessInfoData.business.name
      ? {
          name: businessInfoData.business.name,
          publicId: businessInfoData.business.publicId,
        }
      : null;
  const quickStepMeta = useMemo(() => {
    switch (quickStep) {
      case "new":
        return {
          kicker: "New customer",
          title: "Add the name and keep moving",
          body: quickPhoneDisplay
            ? `No record matched ${quickPhoneDisplay}. Name is required. Email is optional.`
            : "Add a name now. Email can wait.",
          items: ["Name required", "Email optional", "Saved for next time"],
        };
      case "multiple":
        return {
          kicker: "Multiple matches",
          title: "Choose the right profile",
          body: quickPhoneDisplay
            ? `More than one customer matched ${quickPhoneDisplay}. Pick one to finish the check-in.`
            : "Select the customer to finish the check-in.",
          items: ["Phone and email shown", "Last visit visible", "Create new if needed"],
        };
      case "success":
        return {
          kicker: "Checked in",
          title: "Ready for the next arrival",
          body: quickSuccess
            ? `${quickSuccess.customerName} was checked in at ${formatSuccessTime(quickSuccess.checkInTime, timezone)}.`
            : "The front desk is ready for the next customer.",
          items: [
            quickSuccess?.createdCustomer
              ? "New customer saved"
              : "Existing profile matched",
            quickSuccess?.phoneDisplay ?? "Phone captured",
            `Resets in ${successCountdown}s`,
          ],
        };
      case "phone":
      default:
        return {
          kicker: "Quick mode",
          title: "Phone first. Everything else second.",
          body: "Enter a mobile number. Add more detail only when the visit needs it.",
          items: ["Keyboard ready", "Keypad ready", "Detailed mode stays optional"],
        };
    }
  }, [quickPhoneDisplay, quickStep, quickSuccess, successCountdown, timezone]);

  const resetQuickFlow = useCallback(() => {
    setQuickStep("phone");
    setQuickDigits("");
    setQuickPhoneDisplay("");
    setQuickMatchedCustomers([]);
    setQuickLookupError(null);
    setQuickSuccess(null);
    setSuccessCountdown(SUCCESS_RESET_SECONDS);
    setNewCustomerForm(DEFAULT_NEW_CUSTOMER_FORM);
  }, []);

  const resetDetailedFlow = useCallback(() => {
    setSearchTerm("");
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  const openQuickModal = useCallback(() => {
    resetQuickFlow();
    setMode("quick");
    setShowModal(true);
  }, [resetQuickFlow]);

  const openDetailedModal = useCallback(() => {
    resetDetailedFlow();
    setMode("detailed");
    setShowModal(true);
  }, [resetDetailedFlow]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setMode("quick");
    resetQuickFlow();
    resetDetailedFlow();
  }, [resetDetailedFlow, resetQuickFlow]);

  const invalidateCheckInQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["checkins"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  }, [queryClient]);

  const createCheckIn = useMutation({
    mutationFn: async (payload: {
      customerId?: string;
      phone?: string;
      customerName?: string;
      customerEmail?: string;
      serviceId?: string;
      staffId?: string;
      amountSpent?: number;
    }) => {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body.error || "Failed to create check-in");
        (error as Error & { code?: string; customers?: Customer[] }).code =
          body.code;
        (error as Error & { code?: string; customers?: Customer[] }).customers =
          body.customers;
        throw error;
      }
      return body as { checkIn: CheckIn };
    },
  });

  const lookupCustomer = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch(
        `/api/checkins/lookup?phone=${encodeURIComponent(phone)}`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to look up customer");
      return body as LookupResponse;
    },
  });

  const finalizeQuickCheckIn = useCallback(
    async (
      payload: {
        customerId?: string;
        phone?: string;
        customerName?: string;
        customerEmail?: string;
      },
      meta: {
        customerName: string;
        phoneDisplay: string;
        createdCustomer: boolean;
      },
    ) => {
      const result = await createCheckIn.mutateAsync(payload);
      await invalidateCheckInQueries();
      setQuickStep("success");
      setQuickSuccess({
        customerName: meta.customerName,
        phoneDisplay: meta.phoneDisplay,
        createdCustomer: meta.createdCustomer,
        checkInTime: result.checkIn.checkInTime,
      });
      setQuickLookupError(null);
      toast.success("Customer checked in");
    },
    [createCheckIn, invalidateCheckInQueries],
  );

  const handleQuickLookup = useCallback(async () => {
    if (!quickPhoneReady) {
      setQuickLookupError(
        "Enter a valid 10-digit US phone number to continue.",
      );
      return;
    }
    setQuickLookupError(null);
    setQuickMatchedCustomers([]);
    try {
      const response = await lookupCustomer.mutateAsync(quickDigits);
      if (response.status === "new") {
        setQuickPhoneDisplay(response.displayPhone || quickFormattedPhone);
        setQuickStep("new");
        return;
      }
      if (response.status === "multiple") {
        setQuickPhoneDisplay(quickFormattedPhone);
        setQuickMatchedCustomers(response.customers);
        setQuickStep("multiple");
        return;
      }
      await finalizeQuickCheckIn(
        { customerId: response.customer.id, phone: quickDigits },
        {
          customerName: response.customer.name,
          phoneDisplay:
            formatPhoneForDisplay(response.customer.phone) ||
            quickFormattedPhone,
          createdCustomer: false,
        },
      );
    } catch (error) {
      setQuickLookupError(
        error instanceof Error ? error.message : "Failed to look up customer",
      );
    }
  }, [
    finalizeQuickCheckIn,
    lookupCustomer,
    quickDigits,
    quickFormattedPhone,
    quickPhoneReady,
  ]);

  const appendQuickDigit = useCallback((digit: string) => {
    setQuickLookupError(null);
    setQuickDigits((current) =>
      sanitizePhoneDigits(`${current}${digit}`.slice(0, PHONE_MAX_LENGTH)),
    );
  }, []);
  const handleQuickPhoneInputChange = useCallback((value: string) => {
    setQuickLookupError(null);
    setQuickDigits(sanitizePhoneDigits(value));
  }, []);
  const backspaceQuickDigit = useCallback(() => {
    setQuickLookupError(null);
    setQuickDigits((current) => current.slice(0, -1));
  }, []);
  const clearQuickDigits = useCallback(() => {
    setQuickLookupError(null);
    setQuickDigits("");
  }, []);

  useEffect(() => {
    if (!showModal || mode !== "quick" || quickStep !== "phone") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        appendQuickDigit(event.key);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        backspaceQuickDigit();
        return;
      }
      if (event.key === "Enter" && quickPhoneReady) {
        event.preventDefault();
        void handleQuickLookup();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    appendQuickDigit,
    backspaceQuickDigit,
    handleQuickLookup,
    mode,
    quickPhoneReady,
    quickStep,
    showModal,
  ]);

  const handleQuickPhoneInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && quickPhoneReady) {
        event.preventDefault();
        void handleQuickLookup();
      }
    },
    [handleQuickLookup, quickPhoneReady],
  );

  useEffect(() => {
    if (!quickSuccess) return;
    setSuccessCountdown(SUCCESS_RESET_SECONDS);
    const interval = window.setInterval(
      () => setSuccessCountdown((current) => Math.max(current - 1, 0)),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [quickSuccess]);

  useEffect(() => {
    if (quickSuccess && successCountdown === 0) {
      resetQuickFlow();
    }
  }, [quickSuccess, resetQuickFlow, successCountdown]);

  const handleQuickKeypadPress = useCallback(
    (key: (typeof KEYPAD_KEYS)[number]) => {
      if (key === "clear") return clearQuickDigits();
      if (key === "back") return backspaceQuickDigit();
      appendQuickDigit(key);
    },
    [appendQuickDigit, backspaceQuickDigit, clearQuickDigits],
  );

  const handleQuickCreateCustomer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = newCustomerForm.name.trim();
      if (!trimmedName) {
        setQuickLookupError(
          "Customer name is required for a new phone number.",
        );
        return;
      }
      try {
        await finalizeQuickCheckIn(
          {
            phone: quickDigits,
            customerName: trimmedName,
            customerEmail: newCustomerForm.email.trim() || undefined,
          },
          {
            customerName: trimmedName,
            phoneDisplay: quickPhoneDisplay || quickFormattedPhone,
            createdCustomer: true,
          },
        );
      } catch (error) {
        setQuickLookupError(
          error instanceof Error
            ? error.message
            : "Failed to check in customer",
        );
      }
    },
    [
      finalizeQuickCheckIn,
      newCustomerForm.email,
      newCustomerForm.name,
      quickDigits,
      quickFormattedPhone,
      quickPhoneDisplay,
    ],
  );

  const handleQuickMatchSelect = useCallback(
    async (customer: Customer) => {
      try {
        await finalizeQuickCheckIn(
          { customerId: customer.id, phone: quickDigits },
          {
            customerName: customer.name,
            phoneDisplay:
              formatPhoneForDisplay(customer.phone) || quickPhoneDisplay,
            createdCustomer: false,
          },
        );
      } catch (error) {
        setQuickLookupError(
          error instanceof Error
            ? error.message
            : "Failed to check in customer",
        );
      }
    },
    [finalizeQuickCheckIn, quickDigits, quickPhoneDisplay],
  );

  const handleDetailedSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.customerId) {
      toast.error("Choose a customer first");
      return;
    }
    try {
      await createCheckIn.mutateAsync({
        customerId: formData.customerId,
        serviceId: formData.serviceId || undefined,
        staffId: formData.staffId || undefined,
      });
      await invalidateCheckInQueries();
      toast.success("Customer checked in");
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create check-in",
      );
    }
  };

  const quickIsBusy = lookupCustomer.isPending || createCheckIn.isPending;
  const detailedIsBusy = createCheckIn.isPending && mode === "detailed";
  const successProgressPercent = `${(successCountdown / SUCCESS_RESET_SECONDS) * 100}%`;

  return (
    <div data-testid="checkins-page" className="w-full space-y-5 sm:space-y-6">
      <section className="brand-hero relative overflow-hidden rounded-[34px] border border-gray-200/80 px-5 py-6 shadow-[0_32px_90px_-50px_rgba(16,72,56,0.22)] dark:border-white/10 sm:px-7 sm:py-7">
        <div className="absolute -right-20 top-0 h-56 w-56 rounded-full bg-white/45 blur-3xl dark:bg-primary/20" />
        <div className="relative space-y-6">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
              Check ins
            </h1>
            <p className="brand-hero-muted max-w-2xl text-sm leading-6 sm:text-base">
              Quick check-in is the default. Use detailed entry only when you
              need more detail.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openQuickModal}
              className="btn-primary min-h-[52px] gap-2 px-5 text-sm sm:text-base"
            >
              Quick check-in
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openDetailedModal}
              className="btn-secondary min-h-[52px] gap-2 px-5 text-sm sm:text-base"
            >
              Detailed entry
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-gray-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Logged
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white">
                {checkIns.length}
              </p>
            </div>
            <div className="rounded-[24px] border border-gray-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Customers
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950 dark:text-white">
                {uniqueGuests}
              </p>
            </div>
            <div className="rounded-[24px] border border-gray-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Latest
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                {latestCheckInLabel}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {latestCheckIn ? latestCheckIn.customer.name : "No check-ins yet"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        <InStoreCheckInPanel business={inStoreBusiness} />
      </div>

      <section className="card overflow-hidden rounded-[30px]">
        <div className="border-b border-gray-200/80 bg-gradient-to-r from-white/65 via-white/35 to-transparent px-5 py-5 dark:border-white/10 dark:from-white/[0.04] dark:via-white/[0.02] dark:to-transparent sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                  {checkIns.length} logged
                </span>
                <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                  {uniqueGuests} customers
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  Daily log
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">
                  Check-ins for {selectedDateLabel}
                </h2>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-[24px] border border-gray-200/80 bg-white/75 p-4 shadow-[0_20px_45px_-35px_rgba(16,72,56,0.3)] dark:border-white/10 dark:bg-white/[0.04]">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                  Date
                </label>
                <DatePicker value={selectedDate} onChange={setSelectedDate} />
              </div>
              <button
                type="button"
                onClick={openQuickModal}
                className="btn-outline min-h-[48px] text-sm"
              >
                Start next check-in
              </button>
            </div>
          </div>
        </div>

        {isLoadingCheckIns ? (
          <div className="p-10 text-center sm:p-14">
            <div className="inline-block h-9 w-9 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : checkIns.length === 0 ? (
          <div className="p-10 text-center sm:p-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="h-8 w-8" />
            </div>
            <p className="mt-4 text-base font-medium text-gray-950 dark:text-white">
              No check-ins for this date yet
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Use the quick keypad flow when the next customer arrives.
            </p>
            <button
              type="button"
              onClick={openQuickModal}
              className="btn-primary mt-5 min-h-[48px] px-5 text-sm"
            >
              Start check-in
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 p-4 sm:hidden">
              {checkIns.map((checkIn) => (
                <article
                  key={checkIn.id}
                  className="rounded-[28px] border border-gray-200/80 bg-white/80 p-4 shadow-[0_22px_55px_-42px_rgba(16,72,56,0.38)] dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                        {getInitials(checkIn.customer.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-gray-950 dark:text-white">
                          {checkIn.customer.name}
                        </p>
                        <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                          {checkIn.customer.phone
                            ? formatPhoneForDisplay(checkIn.customer.phone)
                            : "No phone on file"}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full border border-gray-200/80 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200">
                      {new Date(checkIn.checkInTime).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: timezone,
                        },
                      )}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] border border-gray-200/70 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Service
                      </p>
                      <p className="mt-2 text-sm font-medium text-gray-950 dark:text-white">
                        {checkIn.service?.name || "Not tracked"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-gray-200/70 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Staff
                      </p>
                      <p className="mt-2 text-sm font-medium text-gray-950 dark:text-white">
                        {checkIn.staff?.fullName || "Open front desk"}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto px-4 pb-4 pt-1 sm:block">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      Staff
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/80 dark:divide-white/10">
                  {checkIns.map((checkIn) => (
                    <tr
                      key={checkIn.id}
                      className="transition hover:bg-white/55 dark:hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-4 py-4 align-middle">
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200">
                          {new Date(checkIn.checkInTime).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: timezone,
                            },
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                            {getInitials(checkIn.customer.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-950 dark:text-white">
                              {checkIn.customer.name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                              Customer
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {checkIn.customer.phone
                          ? formatPhoneForDisplay(checkIn.customer.phone)
                          : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-gray-50/90 px-3 py-1 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                          {checkIn.service?.name || "Not tracked"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-gray-50/90 px-3 py-1 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                          {checkIn.staff?.fullName || "Open front desk"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {showModal ? (
        <div
          data-mobile-overlay="true"
          className="fixed inset-0 z-[70] bg-black/55 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"
        >
          <div className="relative flex h-full w-full flex-col overflow-hidden bg-[rgb(var(--color-gray-50))] text-gray-950 dark:bg-[rgb(var(--color-gray-900))] dark:text-gray-50 sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[32px] sm:border sm:border-gray-200/80 sm:shadow-[0_36px_90px_-48px_rgba(6,17,24,0.55)] dark:border-white/10">
            <div className="border-b border-gray-200/80 bg-white/80 px-4 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[rgb(var(--color-gray-900))]/80 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex rounded-full border border-gray-200/80 bg-white/70 p-1 text-sm shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => {
                      resetQuickFlow();
                      setMode("quick");
                    }}
                    className={`rounded-full px-4 py-2 font-medium transition ${
                      mode === "quick"
                        ? "bg-primary text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    Quick check-in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetDetailedFlow();
                      setMode("detailed");
                    }}
                    className={`rounded-full px-4 py-2 font-medium transition ${
                      mode === "detailed"
                        ? "bg-primary text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    Detailed entry
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-500 transition hover:text-gray-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:text-white"
                  aria-label="Close check-in modal"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {mode === "quick" ? (
                <section className="grid min-h-full gap-0 xl:grid-cols-[0.84fr,1.16fr]">
                  <div className="brand-hero hidden border-r border-gray-200/80 px-8 py-9 dark:border-white/10 xl:flex xl:flex-col xl:justify-between">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <p className="brand-hero-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                          {quickStepMeta.kicker}
                        </p>
                        <h2 className="text-4xl font-bold leading-tight text-gray-950 dark:text-white">
                          {quickStepMeta.title}
                        </h2>
                        <p className="brand-hero-muted max-w-xl text-base leading-7">
                          {quickStepMeta.body}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {quickStepMeta.items.map((item) => (
                          <span
                            key={item}
                            className="inline-flex rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-200"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="brand-hero-card rounded-[26px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                        Desk note
                      </p>
                      <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-white/80">
                        Quick mode is the default path. Use detailed entry only
                        when the visit needs service or staff attached at
                        check-in.
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-9">
                    {quickStep === "phone" ? (
                      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6">
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                              Quick check-in
                            </p>
                            <h2 className="text-3xl font-bold text-gray-950 dark:text-white sm:text-4xl">
                              Check in customer
                            </h2>
                            <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                              Enter a mobile number. Existing customers go
                              straight through. New numbers only need a name
                              once.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-[30px] border border-gray-200/80 bg-white/85 p-5 shadow-[0_24px_60px_-40px_rgba(16,72,56,0.35)] dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <label
                                htmlFor="quick-checkin-phone"
                                className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400"
                              >
                                Customer phone number
                              </label>
                              <div className="mt-3 flex min-h-[78px] items-center gap-3 rounded-[24px] border border-gray-200/80 bg-gray-50/85 px-5 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 dark:border-white/10 dark:bg-white/[0.06]">
                                <span className="shrink-0 text-2xl font-semibold tracking-tight text-gray-500 dark:text-gray-300">
                                  +1
                                </span>
                                <input
                                  id="quick-checkin-phone"
                                  type="tel"
                                  inputMode="numeric"
                                  autoFocus
                                  value={quickFormattedPhone}
                                  onChange={(event) =>
                                    handleQuickPhoneInputChange(
                                      event.target.value,
                                    )
                                  }
                                  onKeyDown={handleQuickPhoneInputKeyDown}
                                  placeholder="(555) 123-4567"
                                  className="w-full border-0 bg-transparent px-0 text-3xl font-bold tracking-tight text-gray-950 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-gray-500"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={clearQuickDigits}
                              className="mt-7 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:text-gray-950 dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-gray-200/80 bg-gray-50/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                              {quickDigits.length}/10 digits
                            </span>
                            <span className="inline-flex rounded-full border border-gray-200/80 bg-gray-50/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                              {quickPhoneReady
                                ? "Ready to continue"
                                : "Waiting for 10 digits"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {KEYPAD_KEYS.map((key) => (
                            <KeypadButton
                              key={key}
                              label={
                                key === "clear"
                                  ? "Clear"
                                  : key === "back"
                                    ? "Delete"
                                    : key
                              }
                              hint={key === "back" ? "Backspace" : undefined}
                              onClick={() => handleQuickKeypadPress(key)}
                              className={
                                key === "clear" || key === "back"
                                  ? "text-primary"
                                  : ""
                              }
                            />
                          ))}
                        </div>

                        {quickLookupError ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                            {quickLookupError}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Use the keyboard or keypad to enter a 10-digit
                            mobile number.
                          </p>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={closeModal}
                            className="btn-outline min-h-[58px] flex-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleQuickLookup()}
                            disabled={!quickPhoneReady || quickIsBusy}
                            className="btn-primary min-h-[58px] flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {quickIsBusy ? "Checking number..." : "Continue"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {quickStep === "new" ? (
                      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center space-y-6">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                            New customer
                          </p>
                          <h2 className="text-3xl font-bold text-gray-950 dark:text-white">
                            Add the customer name
                          </h2>
                          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                            No match for {quickPhoneDisplay}. Save the name
                            once, then keep the line moving.
                          </p>
                        </div>

                        <form
                          onSubmit={handleQuickCreateCustomer}
                          className="space-y-5"
                        >
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                              {quickPhoneDisplay || quickFormattedPhone}
                            </span>
                            <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                              Name required
                            </span>
                            <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                              Email optional
                            </span>
                          </div>

                          <div className="rounded-[28px] border border-gray-200/80 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="grid gap-5 sm:grid-cols-2">
                              <div>
                                <label
                                  className="label"
                                  htmlFor="quick-customer-name"
                                >
                                  Full name{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="quick-customer-name"
                                  type="text"
                                  value={newCustomerForm.name}
                                  onChange={(event) =>
                                    setNewCustomerForm((current) => ({
                                      ...current,
                                      name: event.target.value,
                                    }))
                                  }
                                  className="input min-h-[56px] text-base"
                                  placeholder="Jane Smith"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label
                                  className="label"
                                  htmlFor="quick-customer-phone"
                                >
                                  Mobile number
                                </label>
                                <input
                                  id="quick-customer-phone"
                                  value={
                                    quickPhoneDisplay || quickFormattedPhone
                                  }
                                  readOnly
                                  className="input min-h-[56px] cursor-default bg-gray-100/80 dark:bg-white/[0.06]"
                                />
                              </div>
                            </div>
                            <div className="mt-5">
                              <label
                                className="label"
                                htmlFor="quick-customer-email"
                              >
                                Email (optional)
                              </label>
                              <input
                                id="quick-customer-email"
                                type="email"
                                value={newCustomerForm.email}
                                onChange={(event) =>
                                  setNewCustomerForm((current) => ({
                                    ...current,
                                    email: event.target.value,
                                  }))
                                }
                                className="input min-h-[56px] text-base"
                                placeholder="customer@example.com"
                              />
                            </div>
                          </div>

                          {quickLookupError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                              {quickLookupError}
                            </div>
                          ) : null}

                          <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={resetQuickFlow}
                              className="btn-outline min-h-[58px] flex-1"
                            >
                              Back
                            </button>
                            <button
                              type="submit"
                              disabled={quickIsBusy}
                              className="btn-primary min-h-[58px] flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {quickIsBusy
                                ? "Saving customer..."
                                : "Save and check in"}
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}

                    {quickStep === "multiple" ? (
                      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center space-y-6">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                            Pick the right customer
                          </p>
                          <h2 className="text-3xl font-bold text-gray-950 dark:text-white">
                            We found more than one record for{" "}
                            {quickPhoneDisplay}
                          </h2>
                          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                            Choose the correct customer and we will finish the
                            check-in right away.
                          </p>
                        </div>

                        <div className="grid gap-3">
                          {quickMatchedCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() =>
                                void handleQuickMatchSelect(customer)
                              }
                              className="rounded-[26px] border border-gray-200/80 bg-white/85 px-5 py-4 text-left shadow-[0_20px_50px_-36px_rgba(16,72,56,0.4)] transition hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary/40"
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                                    {getInitials(customer.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-lg font-semibold text-gray-950 dark:text-white">
                                      {customer.name}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                      {formatPhoneForDisplay(customer.phone) ||
                                        quickPhoneDisplay}
                                    </p>
                                    {customer.email ? (
                                      <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                                        {customer.email}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                                    Last visit
                                  </span>
                                  <span className="mt-2 block font-medium text-gray-950 dark:text-white">
                                    {formatLastVisit(
                                      customer.lastVisit,
                                      timezone,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {quickLookupError ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                            {quickLookupError}
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={resetQuickFlow}
                            className="btn-outline min-h-[58px] flex-1"
                          >
                            Back to keypad
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickMatchedCustomers([]);
                              setQuickStep("new");
                            }}
                            className="btn-secondary min-h-[58px] flex-1"
                          >
                            None of these customers
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {quickStep === "success" && quickSuccess ? (
                      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center space-y-6 text-center">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/12 text-primary">
                          <svg
                            className="h-12 w-12"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.4}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                            Check-in complete
                          </p>
                          <h2 className="text-4xl font-bold tracking-tight text-gray-950 dark:text-white">
                            Thanks, {quickSuccess.customerName.split(/\s+/)[0]}.
                          </h2>
                          <p className="text-base leading-7 text-gray-600 dark:text-gray-300">
                            Checked in at{" "}
                            {formatSuccessTime(
                              quickSuccess.checkInTime,
                              timezone,
                            )}{" "}
                            using {quickSuccess.phoneDisplay}.
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {quickSuccess.createdCustomer
                              ? "This was a brand new customer record, so the front desk will be faster next time."
                              : "We found the existing customer record and moved the visit through instantly."}
                          </p>
                        </div>
                        <div className="rounded-[28px] border border-primary/20 bg-primary/8 p-5 text-left">
                          <p className="text-sm font-semibold text-gray-950 dark:text-white">
                            Ready for the next customer in {successCountdown}{" "}
                            second{successCountdown === 1 ? "" : "s"}.
                          </p>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-linear"
                              style={{ width: successProgressPercent }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={resetQuickFlow}
                            className="btn-primary mt-4 min-h-[52px] w-full"
                          >
                            Check in another customer
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : (
                <section className="grid min-h-full gap-0 xl:grid-cols-[0.88fr,1.12fr]">
                  <div className="brand-hero hidden border-r border-gray-200/80 px-8 py-9 dark:border-white/10 xl:flex xl:flex-col xl:justify-between">
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <p className="brand-hero-kicker text-xs font-semibold uppercase tracking-[0.28em]">
                          Detailed entry
                        </p>
                        <h2 className="text-4xl font-bold leading-tight text-gray-950 dark:text-white">
                          Capture detail only when it matters.
                        </h2>
                        <p className="brand-hero-muted max-w-xl text-base leading-7">
                          Customer is required. Service and staff stay optional
                          until the visit needs attribution.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-200">
                          Search by name or phone
                        </span>
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-200">
                          Service optional
                        </span>
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-200">
                          Staff optional
                        </span>
                      </div>
                    </div>

                    <div className="brand-hero-card rounded-[26px] p-5">
                      <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-white/80">
                        Use this when a walk-in already needs attribution at
                        the front desk.
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-9">
                    <div className="mx-auto max-w-3xl">
                      <div className="space-y-2 xl:hidden">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                          Detailed entry
                        </p>
                        <h2 className="text-3xl font-bold text-gray-950 dark:text-white">
                          Add service or staff when needed
                        </h2>
                        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                          Customer is required. Everything else stays optional.
                        </p>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                          Customer required
                        </span>
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                          Service optional
                        </span>
                        <span className="inline-flex rounded-full border border-gray-200/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
                          Staff optional
                        </span>
                      </div>

                      <form
                        onSubmit={handleDetailedSubmit}
                        className="mt-6 space-y-5"
                      >
                        <div className="rounded-[28px] border border-gray-200/80 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                          <label className="label" htmlFor="detailed-search">
                            Customer <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="detailed-search"
                            type="text"
                            value={searchTerm}
                            onChange={(event) =>
                              setSearchTerm(event.target.value)
                            }
                            className="input"
                            placeholder="Search by name or phone..."
                            autoComplete="off"
                          />
                          {searchTerm.trim().length > 0 &&
                          searchTerm.trim().length < 2 ? (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                              Type at least 2 characters to search.
                            </p>
                          ) : null}
                          {searchTerm.trim().length >= 2 ? (
                            <div className="mt-3 max-h-64 overflow-y-auto rounded-[24px] border border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
                              {customers.length > 0 ? (
                                customers.map((customer) => {
                                  const selected =
                                    formData.customerId === customer.id;
                                  return (
                                    <button
                                      key={customer.id}
                                      type="button"
                                      onClick={() => {
                                        setFormData((current) => ({
                                          ...current,
                                          customerId: customer.id,
                                        }));
                                        setSearchTerm(customer.name);
                                      }}
                                      className={`w-full border-b border-gray-200/70 px-4 py-4 text-left transition last:border-b-0 dark:border-white/10 ${
                                        selected
                                          ? "bg-primary/10"
                                          : "hover:bg-gray-50/80 dark:hover:bg-white/[0.04]"
                                      }`}
                                    >
                                      <p className="text-sm font-semibold text-gray-950 dark:text-white">
                                        {customer.name}
                                      </p>
                                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                        {customer.phone
                                          ? formatPhoneForDisplay(
                                              customer.phone,
                                            )
                                          : customer.email || "No contact info"}
                                      </p>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-4 py-5 text-sm text-gray-600 dark:text-gray-300">
                                  No customers match that search yet.
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="rounded-[28px] border border-gray-200/80 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                            <label className="label" htmlFor="detailed-service">
                              Service (optional)
                            </label>
                            <CustomSelect
                              id="detailed-service"
                              value={formData.serviceId}
                              onChange={(serviceId) => {
                                setFormData((current) => ({
                                  ...current,
                                  serviceId,
                                }));
                              }}
                              placeholder="No service"
                              options={services.map((service) => ({
                                value: service.id,
                                label: service.name,
                              }))}
                            />
                          </div>
                          <div className="rounded-[28px] border border-gray-200/80 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                            <label className="label" htmlFor="detailed-staff">
                              Staff (optional)
                            </label>
                            <CustomSelect
                              id="detailed-staff"
                              value={formData.staffId}
                              onChange={(value) =>
                                setFormData((current) => ({
                                  ...current,
                                  staffId: value,
                                }))
                              }
                              placeholder="No staff"
                              options={staff.map((member) => ({
                                value: member.id,
                                label: member.fullName,
                              }))}
                            />
                          </div>
                        </div>

                        {createCheckIn.isError ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                            {createCheckIn.error instanceof Error
                              ? createCheckIn.error.message
                              : "Failed to create check-in"}
                          </div>
                        ) : null}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={closeModal}
                            className="btn-outline min-h-[56px] flex-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!formData.customerId || detailedIsBusy}
                            className="btn-primary min-h-[56px] flex-1 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {detailedIsBusy
                              ? "Saving check-in..."
                              : "Save check-in"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
