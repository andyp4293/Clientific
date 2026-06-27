"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import AddCustomerModal from "./AddCustomerModal";
import CustomerGroupModal from "./CustomerGroupModal";
import EditCustomerModal from "./EditCustomerModal";
import SendCustomerBroadcastModal from "./SendCustomerBroadcastModal";
import SendCustomerMessageModal from "./SendCustomerMessageModal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { formatPhoneForDisplay } from "@/lib/phone";
import {
  type CustomerContactFilter,
  type CustomerSmsFilter,
  type CustomerVisitFilter,
} from "@/lib/customer-filter-options";
import { MessageSquare } from "lucide-react";

type CustomerTab = "customers" | "groups";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked?: boolean;
  totalSpent: number;
  lastVisit: Date | null;
  birthday: Date | null;
  notes: string | null;
  createdAt: Date;
  _count: {
    checkIns: number;
    appointments: number;
  };
  groupMemberships: Array<{
    group: CustomerGroup;
  }>;
};

type CustomerGroup = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
  _count?: {
    memberships: number;
  };
};

type CustomerSearchMatch = Pick<Customer, "id" | "name" | "email" | "phone">;

interface CustomerListProps {
  businessName?: string;
  customers: Customer[];
  groups: CustomerGroup[];
  initialSearch?: string;
  initialGroupFilter?: string;
  initialSmsFilter?: CustomerSmsFilter | "";
  initialContactFilter?: CustomerContactFilter | "";
  initialVisitFilter?: CustomerVisitFilter | "";
  initialTab?: CustomerTab;
  currentPage?: number;
  pageSize?: number;
  totalCustomers?: number;
  totalPages?: number;
}

const smsFilterOptions: Array<{ value: CustomerSmsFilter; label: string }> = [
  { value: "enabled", label: "SMS enabled" },
  { value: "opted_out", label: "Opted out" },
  { value: "denied", label: "Denies SMS" },
  { value: "no_phone", label: "No phone" },
];

const contactFilterOptions: Array<{ value: CustomerContactFilter; label: string }> = [
  { value: "email", label: "Has email" },
  { value: "phone", label: "Has phone" },
  { value: "both", label: "Has both" },
];

const visitFilterOptions: Array<{ value: CustomerVisitFilter; label: string }> = [
  { value: "visited", label: "Visited before" },
  { value: "never", label: "Never visited" },
];

const SEARCH_DROPDOWN_MIN_LENGTH = 2;
const SEARCH_DROPDOWN_LIMIT = 8;
const SEARCH_QUERY_SYNC_DELAY_MS = 250;
const EXTERNAL_CUSTOMER_REFRESH_INTERVAL_MS = 15000;

function buildCustomersHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/dashboard/customers?${query}` : "/dashboard/customers";
}

function getSmsStatus(customer: Pick<Customer, "phone" | "smsConsent" | "smsOptedOut">) {
  if (!customer.phone) {
    return {
      label: "No phone",
      description: "No SMS number on file",
      className:
        "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    };
  }

  if (customer.smsOptedOut) {
    return {
      label: "Opted out",
      description: "Stopped SMS",
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };
  }

  if (customer.smsConsent) {
    return {
      label: "SMS Enabled",
      description: "Can receive SMS",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
  }

  return {
    label: "Denies SMS",
    description: "SMS permission has not been given",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  };
}

function getCustomerInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDateLabel(value: Date | null) {
  return value ? format(new Date(value), "MMM d, yyyy") : "Never";
}

function formatLastVisit(lastVisit: Date | null) {
  return lastVisit ? format(new Date(lastVisit), "MMM d, yyyy") : "Never";
}

function renderCustomerContactInfo(customer: Pick<Customer, "email" | "phone">) {
  const contactLines = [customer.email, customer.phone].filter(Boolean) as string[];

  if (contactLines.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No contact info</p>;
  }

  return (
    <div className="space-y-0.5">
      {contactLines.map((line) => (
        <p key={line} className="break-words text-sm text-gray-500 dark:text-gray-400">
          {line}
        </p>
      ))}
    </div>
  );
}

function getDealSmsStatus(customer: Pick<Customer, "dealSmsBlocked">) {
  if (customer.dealSmsBlocked) {
    return {
      label: "Deals blocked by you",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    };
  }

  return {
    label: "Deals SMS allowed",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
}

function renderCustomerGroups(customer: Pick<Customer, "groupMemberships">) {
  if (customer.groupMemberships.length === 0) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        Ungrouped
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {customer.groupMemberships.map(({ group }) => (
        <span
          key={group.id}
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            group.promotionSmsEnabled
              ? "bg-primary/10 text-primary dark:bg-primary/20"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          }`}
        >
          {group.name}
        </span>
      ))}
    </div>
  );
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const visiblePages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  visiblePages.forEach((page, index) => {
    const previousPage = visiblePages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

export default function CustomerList({
  businessName = "Your business",
  customers,
  groups,
  initialSearch = "",
  initialGroupFilter = "",
  initialSmsFilter = "",
  initialContactFilter = "",
  initialVisitFilter = "",
  initialTab = "customers",
  currentPage = 1,
  pageSize = customers.length || 25,
  totalCustomers = customers.length,
  totalPages = 1,
}: CustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = initialTab;
  const [search, setSearch] = useState(initialSearch);
  const [customerRecords, setCustomerRecords] = useState(customers);
  const [groupRecords, setGroupRecords] = useState(groups);
  const [searchMatches, setSearchMatches] = useState<CustomerSearchMatch[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasSearchLoaded, setHasSearchLoaded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [messagingCustomer, setMessagingCustomer] = useState<Customer | null>(null);
  const searchCacheRef = useRef<Map<string, CustomerSearchMatch[]>>(new Map());
  const searchBlurTimeoutRef = useRef<number | null>(null);
  const hasOverlayOpen =
    isAddModalOpen ||
    isGroupModalOpen ||
    isBroadcastModalOpen ||
    editingCustomer !== null ||
    messagingCustomer !== null;
  const groupFilterOptions = groupRecords.map((group) => ({
    value: group.id,
    label: group.name,
  }));

  useEffect(() => {
    setCustomerRecords(customers);
  }, [customers]);

  useEffect(() => {
    setGroupRecords(groups);
  }, [groups]);

  useEffect(() => {
    const normalizedSearch = search.trim();
    const normalizedInitialSearch = initialSearch.trim();

    if (normalizedSearch === normalizedInitialSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("segment");
      params.delete("page");
      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      } else {
        params.delete("search");
      }

      startTransition(() => {
        router.replace(buildCustomersHref(params));
      });
    }, SEARCH_QUERY_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [initialSearch, router, search, searchParams]);

  useEffect(() => {
    if (activeTab !== "customers" || hasOverlayOpen) {
      return;
    }

    const refreshCustomerData = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    };

    const intervalId = window.setInterval(
      refreshCustomerData,
      EXTERNAL_CUSTOMER_REFRESH_INTERVAL_MS,
    );

    window.addEventListener("focus", refreshCustomerData);
    document.addEventListener("visibilitychange", refreshCustomerData);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCustomerData);
      document.removeEventListener("visibilitychange", refreshCustomerData);
    };
  }, [activeTab, hasOverlayOpen, router]);

  useEffect(() => {
    if (activeTab !== "customers" || !isSearchFocused) {
      setSearchMatches([]);
      setIsSearchLoading(false);
      setHasSearchLoaded(false);
      return;
    }

    const query = search.trim();

    if (query.length < SEARCH_DROPDOWN_MIN_LENGTH) {
      setSearchMatches([]);
      setIsSearchLoading(false);
      setHasSearchLoaded(false);
      return;
    }

    const cacheKey = query.toLowerCase();
    const cachedMatches = searchCacheRef.current.get(cacheKey);
    if (cachedMatches) {
      setSearchMatches(cachedMatches);
      setIsSearchLoading(false);
      setHasSearchLoaded(true);
      return;
    }

    const abortController = new AbortController();

    async function loadSearchMatches() {
      setIsSearchLoading(true);
      setHasSearchLoaded(false);

      try {
        const response = await fetch(
          `/api/customers?search=${encodeURIComponent(query)}&limit=${SEARCH_DROPDOWN_LIMIT}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch customer matches");
        }

        const payload = (await response.json()) as { customers?: CustomerSearchMatch[] };
        const matches = Array.isArray(payload.customers) ? payload.customers : [];

        searchCacheRef.current.set(cacheKey, matches);
        setSearchMatches(matches);
      } catch (error) {
        if (!abortController.signal.aborted) {
          setSearchMatches([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearchLoading(false);
          setHasSearchLoaded(true);
        }
      }
    }

    void loadSearchMatches();

    return () => abortController.abort();
  }, [activeTab, isSearchFocused, search]);

  useEffect(
    () => () => {
      if (searchBlurTimeoutRef.current) {
        window.clearTimeout(searchBlurTimeoutRef.current);
      }
    },
    [],
  );

  const updateQueryParam = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("segment");
    params.delete("page");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(buildCustomersHref(params));
  };

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  const handleSearchFocus = () => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
    }
    searchBlurTimeoutRef.current = window.setTimeout(() => {
      setIsSearchFocused(false);
      searchBlurTimeoutRef.current = null;
    }, 120);
  };

  const handleSearchMatchSelect = (customer: CustomerSearchMatch) => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    setSearch(customer.name);
    setIsSearchFocused(false);
  };

  const hasActiveFilters = Boolean(
    search ||
      initialGroupFilter ||
      initialSmsFilter ||
      initialContactFilter ||
      initialVisitFilter,
  );

  const clearAllFilters = () => {
    setSearch("");
    router.push("/dashboard/customers");
  };

  const handleTabChange = (tab: CustomerTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "groups") {
      params.set("tab", "groups");
    } else {
      params.delete("tab");
    }
    router.push(buildCustomersHref(params));
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.push(buildCustomersHref(params));
  };

  const handleViewGroupMembers = (groupId: string) => {
    const params = new URLSearchParams();
    params.set("group", groupId);
    startTransition(() => {
      router.push(buildCustomersHref(params));
    });
  };

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: CustomerGroup) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(false);
  };

  const handleCustomerCreated = (customer: Customer) => {
    searchCacheRef.current.clear();
    setCustomerRecords((current) => [
      {
        ...customer,
        _count: customer._count ?? {
          checkIns: 0,
          appointments: 0,
        },
        lastVisit: customer.lastVisit ?? null,
        birthday: customer.birthday ?? null,
        notes: customer.notes ?? null,
        groupMemberships: customer.groupMemberships ?? [],
      },
      ...current,
    ]);
  };

  const handleCustomerSaved = (customer: Customer) => {
    searchCacheRef.current.clear();
    setCustomerRecords((current) =>
      current.map((entry) =>
        entry.id === customer.id
          ? {
              ...entry,
              ...customer,
              _count: customer._count ?? entry._count,
              groupMemberships: customer.groupMemberships ?? entry.groupMemberships,
            }
          : entry
      )
    );
    setEditingCustomer((current) =>
      current?.id === customer.id
        ? {
            ...current,
            ...customer,
            groupMemberships: customer.groupMemberships ?? current.groupMemberships,
          }
        : current
    );
  };

  const handleCustomerDeleted = (customerId: string) => {
    searchCacheRef.current.clear();
    setCustomerRecords((current) => current.filter((customer) => customer.id !== customerId));
    setEditingCustomer((current) => (current?.id === customerId ? null : current));
    setMessagingCustomer((current) => (current?.id === customerId ? null : current));
  };

  const handleGroupSaved = (group: CustomerGroup) => {
    setGroupRecords((current) => {
      const next = current.some((entry) => entry.id === group.id)
        ? current.map((entry) => (entry.id === group.id ? group : entry))
        : [...current, group];

      const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));

      setCustomerRecords((customersCurrent) =>
        customersCurrent.map((customer) => ({
          ...customer,
          groupMemberships: customer.groupMemberships.map((membership) => ({
            group:
              sorted.find((entry) => entry.id === membership.group.id) ?? membership.group,
          })),
        }))
      );

      return sorted;
    });
    setEditingGroup(group);
  };

  const handleGroupDeleted = (groupId: string) => {
    setGroupRecords((current) => current.filter((group) => group.id !== groupId));
    setCustomerRecords((current) =>
      current.map((customer) => ({
        ...customer,
        groupMemberships: customer.groupMemberships.filter(
          (membership) => membership.group.id !== groupId
        ),
      }))
    );
    setEditingGroup((current) => (current?.id === groupId ? null : current));
  };

  const paginationItems = buildPaginationItems(currentPage, totalPages);
  const resultsStart = totalCustomers === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const resultsEnd =
    totalCustomers === 0 ? 0 : resultsStart + Math.max(customerRecords.length - 1, 0);

  const renderCustomerActions = (customer: Customer, compact = false) => (
    <div
      className={
        compact ? "grid grid-cols-3 gap-2" : "flex flex-wrap justify-center gap-1.5"
      }
    >
      {customer.phone && (
        <button
          onClick={() => setMessagingCustomer(customer)}
          disabled={!customer.smsConsent || customer.smsOptedOut}
          title={
            customer.smsOptedOut
              ? "This customer has opted out of SMS"
              : !customer.smsConsent
                ? "This customer has not consented to SMS"
                : "Send a text message"
          }
          className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-50 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:disabled:bg-gray-700 dark:disabled:text-gray-500 ${
            compact ? "px-3 py-2" : "px-2 py-1.5 xl:px-2.5"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4-.823L3 20l1.055-3.165A7.421 7.421 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Text
        </button>
      )}

      <button
        onClick={() => setEditingCustomer(customer)}
        title="Edit customer"
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 ${
          compact ? "px-3 py-2" : "px-2 py-1.5 xl:px-2.5"
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit
      </button>

      <Link
        href={`/dashboard/customers/${customer.id}`}
        title="View profile"
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-primary/10 text-xs font-medium text-primary transition-colors hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 ${
          compact ? "px-3 py-2" : "px-2 py-1.5 xl:px-2.5"
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        View
      </Link>
    </div>
  );

  return (
    <>
      <section className="card relative overflow-hidden rounded-[30px] p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="tablist"
              aria-label="Customer sections"
              className="inline-flex w-fit rounded-full border border-gray-200/80 bg-white/70 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "customers"}
                onClick={() => handleTabChange("customers")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "customers"
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                Customers
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    activeTab === "customers"
                      ? "bg-white/15 text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
                  }`}
                >
                  {totalCustomers}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "groups"}
                onClick={() => handleTabChange("groups")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "groups"
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                Groups
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    activeTab === "groups"
                      ? "bg-white/15 text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
                  }`}
                >
                  {groupRecords.length}
                </span>
              </button>
            </div>

            {activeTab === "customers" ? (
              <div className="grid gap-2 sm:flex sm:items-center">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 text-sm font-semibold text-gray-900 shadow-[0_1px_0_rgba(255,255,255,0.55)] transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-primary dark:border-gray-700 dark:bg-gray-900/85 dark:text-gray-100 dark:shadow-none dark:hover:border-primary/40 dark:hover:bg-primary/[0.08] dark:hover:text-primary sm:rounded-full sm:px-4 sm:py-2.5"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Text subscribers
                </button>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn-primary whitespace-nowrap"
                >
                  + Add Customer
                </button>
              </div>
            ) : (
              <button
                onClick={openCreateGroupModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 text-sm font-semibold text-gray-900 shadow-[0_1px_0_rgba(255,255,255,0.55)] transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-primary dark:border-gray-700 dark:bg-gray-900/85 dark:text-gray-100 dark:shadow-none dark:hover:border-primary/40 dark:hover:bg-primary/[0.08] dark:hover:text-primary sm:w-auto sm:rounded-full sm:px-4 sm:py-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/15">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                  </svg>
                </span>
                <span className="text-left leading-none">
                  <span className="block sm:hidden">New group</span>
                  <span className="hidden sm:block">Add group</span>
                </span>
              </button>
            )}
          </div>

          {activeTab === "customers" ? (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-gray-200/80 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={search}
                  onChange={(event) => handleSearch(event.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={
                    isSearchFocused && search.trim().length >= SEARCH_DROPDOWN_MIN_LENGTH
                  }
                  aria-controls="customer-search-dropdown"
                  aria-autocomplete="list"
                  className="input w-full"
                />
                {search.trim().length > 0 &&
                search.trim().length < SEARCH_DROPDOWN_MIN_LENGTH ? (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Type at least 2 characters to search.
                  </p>
                ) : null}
                {isSearchFocused && search.trim().length >= SEARCH_DROPDOWN_MIN_LENGTH ? (
                  <div
                    id="customer-search-dropdown"
                    className="mt-3 max-h-64 overflow-y-auto rounded-[24px] border border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    {isSearchLoading ? (
                      <div className="px-4 py-5 text-sm text-gray-600 dark:text-gray-300">
                        Searching customers...
                      </div>
                    ) : searchMatches.length > 0 ? (
                      searchMatches.map((customer) => {
                        const selected =
                          search.trim().toLowerCase() === customer.name.trim().toLowerCase();

                        return (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchMatchSelect(customer)}
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
                                ? formatPhoneForDisplay(customer.phone)
                                : customer.email || "No contact info"}
                            </p>
                          </button>
                        );
                      })
                    ) : hasSearchLoaded ? (
                      <div className="px-4 py-5 text-sm text-gray-600 dark:text-gray-300">
                        No customers match that search yet.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[28px] border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Filter customers
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Narrow by group, texting status, contact details, and visit history.
                    </p>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Group
                    </span>
                    <CustomSelect
                      ariaLabel="Customer group"
                      value={initialGroupFilter}
                      onChange={(value) => updateQueryParam("group", value || undefined)}
                      className="input w-full"
                      placeholder="All groups"
                      options={groupFilterOptions}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      SMS status
                    </span>
                    <CustomSelect
                      ariaLabel="SMS status"
                      value={initialSmsFilter}
                      onChange={(value) => updateQueryParam("sms", value || undefined)}
                      className="input w-full"
                      placeholder="All SMS statuses"
                      options={smsFilterOptions}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Contact details
                    </span>
                    <CustomSelect
                      ariaLabel="Contact details"
                      value={initialContactFilter}
                      onChange={(value) => updateQueryParam("contact", value || undefined)}
                      className="input w-full"
                      placeholder="All contacts"
                      options={contactFilterOptions}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Visit history
                    </span>
                    <CustomSelect
                      ariaLabel="Visit history"
                      value={initialVisitFilter}
                      onChange={(value) => updateQueryParam("visit", value || undefined)}
                      className="input w-full"
                      placeholder="All visits"
                      options={visitFilterOptions}
                    />
                  </label>
                </div>

                {hasActiveFilters && (
                  <div className="flex flex-wrap gap-2">
                    {search && (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        Search: {search}
                      </span>
                    )}
                    {initialGroupFilter && (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        Group: {groups.find((group) => group.id === initialGroupFilter)?.name ?? "Unknown"}
                      </span>
                    )}
                    {initialSmsFilter && (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        SMS: {smsFilterOptions.find((option) => option.value === initialSmsFilter)?.label}
                      </span>
                    )}
                    {initialContactFilter && (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        Contact: {contactFilterOptions.find((option) => option.value === initialContactFilter)?.label}
                      </span>
                    )}
                    {initialVisitFilter && (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        Visits: {visitFilterOptions.find((option) => option.value === initialVisitFilter)?.label}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-[28px] border border-gray-200/80 bg-white/78 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                {customerRecords.length === 0 ? (
                  <div className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              No customers found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
          <>
            <div className="grid gap-4 p-4 md:hidden" data-testid="customer-mobile-list">
              {customerRecords.map((customer) => {
                const smsStatus = getSmsStatus(customer);
                const dealSmsStatus = getDealSmsStatus(customer);

                return (
                  <article
                    key={customer.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary/15">
                        <span className="text-sm font-semibold text-primary-600 dark:text-primary-300">
                          {getCustomerInitials(customer.name)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/customers/${customer.id}`}
                              className="block truncate text-base font-semibold text-gray-900 hover:text-primary dark:text-gray-100"
                            >
                              {customer.name}
                            </Link>
                            <div className="mt-1">
                              {renderCustomerContactInfo(customer)}
                            </div>
                            <div className="mt-3">{renderCustomerGroups(customer)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        SMS status
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${smsStatus.className}`}
                        >
                          {smsStatus.label}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${dealSmsStatus.className}`}
                        >
                          {dealSmsStatus.label}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {smsStatus.description}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      <div
                        data-testid="customer-mobile-stat-card"
                        className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          Joined
                        </dt>
                        <dd className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatDateLabel(customer.createdAt)}
                        </dd>
                      </div>
                      <div
                        data-testid="customer-mobile-stat-card"
                        className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          Visits
                        </dt>
                        <dd className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {customer._count.checkIns}
                        </dd>
                      </div>
                      <div
                        data-testid="customer-mobile-stat-card"
                        className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          Total spent
                        </dt>
                        <dd className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          ${customer.totalSpent.toFixed(2)}
                        </dd>
                      </div>
                      <div
                        data-testid="customer-mobile-stat-card"
                        className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          Last visit
                        </dt>
                        <dd className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatLastVisit(customer.lastVisit)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4">{renderCustomerActions(customer, true)}</div>
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <table
                data-testid="customer-desktop-table"
                className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700"
              >
                <colgroup>
                  <col className="w-[27%]" />
                  <col className="w-[14%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[170px]" />
                </colgroup>
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Groups
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Visits
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Total Spent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Last Visit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      SMS Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {customerRecords.map((customer) => {
                    const smsStatus = getSmsStatus(customer);
                    const dealSmsStatus = getDealSmsStatus(customer);

                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-4 align-top xl:px-6">
                          <div className="flex items-start">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary/15">
                              <span className="text-sm font-medium text-primary-600 dark:text-primary-300">
                                {getCustomerInitials(customer.name)}
                              </span>
                            </div>
                            <div className="ml-4 min-w-0">
                              <Link
                                href={`/dashboard/customers/${customer.id}`}
                                className="block break-words text-sm font-medium text-gray-900 hover:text-primary dark:text-gray-100"
                              >
                                {customer.name}
                              </Link>
                              <div className="mt-1">
                                {renderCustomerContactInfo(customer)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top xl:px-6">
                          {renderCustomerGroups(customer)}
                        </td>
                        <td className="px-4 py-4 align-top xl:px-6">
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {formatDateLabel(customer.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-900 dark:text-gray-100 xl:px-6">
                          {customer._count.checkIns}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-900 dark:text-gray-100 xl:px-6">
                          ${customer.totalSpent.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-500 dark:text-gray-400 xl:px-6">
                          {formatLastVisit(customer.lastVisit)}
                        </td>
                        <td className="px-4 py-4 align-top xl:px-6">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${smsStatus.className}`}
                              >
                                {smsStatus.label}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${dealSmsStatus.className}`}
                              >
                                {dealSmsStatus.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {smsStatus.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-center xl:px-6">
                          {renderCustomerActions(customer)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
                {totalCustomers > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-gray-200/80 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Showing {resultsStart}-{resultsEnd} of {totalCustomers} customers
                    </p>

                    {totalPages > 1 ? (
                      <nav
                        aria-label="Customers pagination"
                        className="flex items-center gap-2 self-start sm:self-auto"
                      >
                        <button
                          type="button"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200"
                          aria-label="Previous page"
                        >
                          &larr;
                        </button>
                        {paginationItems.map((item, index) =>
                          item === "ellipsis" ? (
                            <span
                              key={`ellipsis-${index}`}
                              className="inline-flex h-10 w-10 items-center justify-center text-sm text-gray-400"
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => handlePageChange(item)}
                              aria-current={item === currentPage ? "page" : undefined}
                              className={`inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-full px-3 text-sm font-semibold transition ${
                                item === currentPage
                                  ? "bg-primary text-white shadow-sm"
                                  : "border border-gray-200 bg-white text-gray-700 hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200"
                              }`}
                            >
                              {item}
                            </button>
                          ),
                        )}
                        <button
                          type="button"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200"
                          aria-label="Next page"
                        >
                          &rarr;
                        </button>
                      </nav>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-[28px] border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50/80 p-4 dark:border-gray-700 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/60">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Customer groups
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Organize customers into reusable audiences for promotions and outreach.
                </p>
              </div>

              {groupRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300/90 bg-white/75 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  No groups yet.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-3">
                  {groupRecords.map((group) => (
                    <div
                      key={group.id}
                      className="group rounded-2xl border border-gray-200 bg-white/90 p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04] dark:border-gray-700 dark:bg-gray-900/70 dark:hover:border-primary/40 dark:hover:bg-primary/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {group.name}
                          </p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {group._count?.memberships ?? 0} customer
                            {(group._count?.memberships ?? 0) === 1 ? "" : "s"}
                          </p>
                        </div>
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-primary dark:text-gray-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            group.promotionSmsEnabled
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {group.promotionSmsEnabled ? "Promotion SMS on" : "Promotion SMS off"}
                        </span>
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                          Manage audience
                        </span>
                      </div>
                      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Jump straight into the filtered customer list to see everyone in this group.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewGroupMembers(group.id)}
                          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                        >
                          View members
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditGroupModal(group)}
                          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary/30 hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                          Edit group
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        groups={groupRecords}
        onCreated={handleCustomerCreated}
      />

      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          isOpen={true}
          onClose={() => setEditingCustomer(null)}
          groups={groupRecords}
          onSaved={handleCustomerSaved}
          onDeleted={handleCustomerDeleted}
        />
      )}

      <CustomerGroupModal
        isOpen={isGroupModalOpen}
        onClose={closeGroupModal}
        group={editingGroup}
        onSaved={handleGroupSaved}
        onDeleted={handleGroupDeleted}
        onViewMembers={handleViewGroupMembers}
      />

      <SendCustomerBroadcastModal
        businessName={businessName}
        groups={groupRecords}
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
      />

      {messagingCustomer && (
        <SendCustomerMessageModal
          customer={messagingCustomer}
          isOpen={true}
          onClose={() => setMessagingCustomer(null)}
        />
      )}
    </>
  );
}
