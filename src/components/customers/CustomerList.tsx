"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import AddCustomerModal from "./AddCustomerModal";
import CustomerGroupModal from "./CustomerGroupModal";
import EditCustomerModal from "./EditCustomerModal";
import SendCustomerMessageModal from "./SendCustomerMessageModal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  type CustomerContactFilter,
  type CustomerSmsFilter,
  type CustomerVisitFilter,
} from "@/lib/customer-filter-options";

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

interface CustomerListProps {
  customers: Customer[];
  groups: CustomerGroup[];
  initialSearch?: string;
  initialGroupFilter?: string;
  initialSmsFilter?: CustomerSmsFilter | "";
  initialContactFilter?: CustomerContactFilter | "";
  initialVisitFilter?: CustomerVisitFilter | "";
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

export default function CustomerList({
  customers,
  groups,
  initialSearch = "",
  initialGroupFilter = "",
  initialSmsFilter = "",
  initialContactFilter = "",
  initialVisitFilter = "",
}: CustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [customerRecords, setCustomerRecords] = useState(customers);
  const [groupRecords, setGroupRecords] = useState(groups);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [messagingCustomer, setMessagingCustomer] = useState<Customer | null>(null);
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

  const updateQueryParam = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("segment");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(buildCustomersHref(params));
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    updateQueryParam("search", value || undefined);
  };

  const hasActiveFilters = Boolean(
    initialSearch ||
      initialGroupFilter ||
      initialSmsFilter ||
      initialContactFilter ||
      initialVisitFilter,
  );

  const clearAllFilters = () => {
    setSearch("");
    router.push("/dashboard/customers");
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

  const renderCustomerActions = (customer: Customer, compact = false) => (
    <div
      className={
        compact ? "grid grid-cols-3 gap-2" : "flex flex-wrap justify-end gap-1.5"
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
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary whitespace-nowrap"
          >
            + Add Customer
          </button>
        </div>

        <div className="space-y-3 rounded-[28px] border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50/80 p-4 dark:border-gray-700 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.73-.157-1.424-.44-2.05M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.73.157-1.424.44-2.05m0 0a5 5 0 019.12 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Customer groups
                </h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  {groupRecords.length} saved
                </p>
              </div>
            </div>

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
          </div>

          {groupRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300/90 bg-white/75 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
              No groups yet.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
              {groupRecords.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => openEditGroupModal(group)}
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
                    <span className="text-xs font-semibold text-gray-400 transition-colors group-hover:text-primary dark:text-gray-500">
                      Edit
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
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
                onChange={(value) =>
                  updateQueryParam("contact", value || undefined)
                }
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
              {initialSearch && (
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  Search: {initialSearch}
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
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800">
        {customers.length === 0 ? (
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
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 xl:px-6">
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
                        <td className="px-4 py-4 align-top text-right xl:px-6">
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
      </div>

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
