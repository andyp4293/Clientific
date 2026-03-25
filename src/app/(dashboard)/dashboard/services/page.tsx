"use client";

import { useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  removeServiceFromQueryData,
  syncServiceGroupCounts,
  upsertServicesQueryData,
} from "@/lib/service-cache";
import {
  addMinutesToTimeString,
  buildTimeOptions,
  formatScheduleTimeLabel,
  normalizeBusinessHoursRecord,
  normalizeStaffWorkHours,
  type BusinessHoursRecord,
  type StaffWorkHoursRecord,
} from "@/lib/staff-schedule";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  isActive: boolean;
  groupId: string | null;
  sortOrder: number;
}

interface ServiceGroup {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { services: number };
}

interface BusinessHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface Staff {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  bio: string | null;
  isActive: boolean;
  workDays: number[];
  workHours?: StaffWorkHoursRecord;
  /** Empty = no restrictions (can perform all services). Non-empty = restricted to these service IDs. */
  serviceIds: string[];
}

type Tab = "services" | "staff";
type ModalType = "service" | "staff" | null;

function businessHoursArrayToRecord(
  hours: BusinessHour[],
): BusinessHoursRecord {
  const raw = Object.fromEntries(
    hours.map((hour) => [
      hour.dayOfWeek,
      {
        isOpen: hour.isOpen,
        openTime: hour.openTime,
        closeTime: hour.closeTime,
      },
    ]),
  );

  return normalizeBusinessHoursRecord(raw);
}

function getDefaultStaffWorkDays(
  businessHoursRecord: BusinessHoursRecord,
): number[] {
  const openDays = DAY_LABELS.map((_, index) => index).filter((dayOfWeek) => {
    const day = businessHoursRecord[dayOfWeek];
    return Boolean(day?.isOpen && day.openTime && day.closeTime);
  });

  return openDays.length > 0 ? openDays : ALL_DAYS;
}

function deriveStaffWorkHoursForForm({
  workDays,
  workHours,
  businessHoursRecord,
}: {
  workDays: number[];
  workHours?: unknown;
  businessHoursRecord: BusinessHoursRecord;
}): StaffWorkHoursRecord {
  const normalizedWorkHours = normalizeStaffWorkHours(workHours);
  const next: StaffWorkHoursRecord = {};

  for (const dayOfWeek of workDays) {
    const businessDay = businessHoursRecord[dayOfWeek];
    if (!businessDay?.isOpen || !businessDay.openTime || !businessDay.closeTime)
      continue;

    next[dayOfWeek] = {
      startTime:
        normalizedWorkHours[dayOfWeek]?.startTime ?? businessDay.openTime,
      endTime: normalizedWorkHours[dayOfWeek]?.endTime ?? businessDay.closeTime,
    };
  }

  return next;
}

function formatScheduleTimeRange(startTime: string, endTime: string): string {
  return `${formatScheduleTimeLabel(startTime)} - ${formatScheduleTimeLabel(endTime)}`;
}

function formatBusinessTimezoneLabel(
  timezone: string | null | undefined,
): string {
  if (!timezone) return "your business timezone";

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const shortName = parts.find((part) => part.type === "timeZoneName")?.value;

    return shortName ? `${shortName} (${timezone})` : timezone;
  } catch {
    return timezone;
  }
}

function ServicesTab({
  services,
  groups,
  onEdit,
  onDelete,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onMoveGroup,
  onMoveService,
}: {
  services: Service[];
  groups: ServiceGroup[];
  onEdit: (service: Service) => void;
  onDelete: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onRenameGroup: (group: ServiceGroup) => void;
  onDeleteGroup: (group: ServiceGroup) => void;
  onMoveGroup: (groupId: string, direction: "up" | "down") => void;
  onMoveService: (
    serviceId: string,
    direction: "up" | "down",
    groupId: string | null,
  ) => void;
}) {
  const [newGroupName, setNewGroupName] = useState("");
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedServices = [...services].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const hasGroups = sortedGroups.length > 0;
  const ungroupedServices = sortedServices.filter(
    (service) => !service.groupId,
  );

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Service Groups
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Organize services into sections on your public booking page. Leave all
          groups empty for a flat list.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="input flex-1"
            placeholder="Create a group (e.g., Manicures)"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = newGroupName.trim();
              if (!trimmed) return;
              onCreateGroup(trimmed);
              setNewGroupName("");
            }}
            className="btn-primary whitespace-nowrap"
          >
            Add Group
          </button>
        </div>

        {sortedGroups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No groups yet. Services will display as one flat list.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedGroups.map((group, index) => (
              <div
                key={group.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {group._count?.services ??
                      services.filter((service) => service.groupId === group.id)
                        .length}{" "}
                    services
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveGroup(group.id, "up")}
                    disabled={index === 0}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
                    title="Move up"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveGroup(group.id, "down")}
                    disabled={index === sortedGroups.length - 1}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
                    title="Move down"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => onRenameGroup(group)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteGroup(group)}
                    className="px-2 py-1 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No services yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            Start by adding services that your business offers to customers
          </p>
        </div>
      ) : hasGroups ? (
        <div className="space-y-4">
          {sortedGroups.map((group) => {
            const groupServices = sortedServices.filter(
              (service) => service.groupId === group.id,
            );
            if (groupServices.length === 0) return null;
            return (
              <div key={group.id} className="card p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                  {group.name}
                </h4>
                <div className="space-y-3">
                  {groupServices.map((service, index) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onMoveUp={() => onMoveService(service.id, "up", group.id)}
                      onMoveDown={() =>
                        onMoveService(service.id, "down", group.id)
                      }
                      disableMoveUp={index === 0}
                      disableMoveDown={index === groupServices.length - 1}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {ungroupedServices.length > 0 && (
            <div className="card p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                Other Services
              </h4>
              <div className="space-y-3">
                {ungroupedServices.map((service, index) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveUp={() => onMoveService(service.id, "up", null)}
                    onMoveDown={() => onMoveService(service.id, "down", null)}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === ungroupedServices.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            All Services
          </h4>
          <div className="space-y-3">
            {sortedServices.map((service, index) => (
              <ServiceRow
                key={service.id}
                service={service}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveUp={() => onMoveService(service.id, "up", null)}
                onMoveDown={() => onMoveService(service.id, "down", null)}
                disableMoveUp={index === 0}
                disableMoveDown={index === sortedServices.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
}) {
  const actionButtonClass =
    "inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40";

  return (
    <div className="rounded-2xl border border-gray-200/90 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2.5">
            <h5 className="min-w-0 flex-1 text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 sm:text-lg sm:leading-7 break-words">
              {service.name}
            </h5>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                service.isActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {service.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {service.description && (
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400 sm:max-w-2xl">
              {service.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200">
              {service.duration} min
            </span>
            {service.price != null ? (
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary dark:border-primary/25 dark:bg-primary/15 dark:text-primary-light">
                ${service.price.toFixed(2)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                Price hidden
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[20rem] lg:flex-none">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disableMoveUp}
            className={`${actionButtonClass} border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
            title="Move up"
          >
            Up
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disableMoveDown}
            className={`${actionButtonClass} border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
            title="Move down"
          >
            Down
          </button>
          <button
            type="button"
            onClick={() => onEdit(service)}
            className={`${actionButtonClass} border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this service? This cannot be undone.")) {
                onDelete(service.id);
              }
            }}
            className={`${actionButtonClass} border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Staff Tab Component
function StaffTab({
  staff,
  services,
  businessHoursRecord,
  onEdit,
  onDelete,
}: {
  staff: Staff[];
  services: Service[];
  businessHoursRecord: BusinessHoursRecord;
  onEdit: (staff: Staff) => void;
  onDelete: (id: string) => void;
}) {
  if (staff.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No staff members yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
          Add team members who can provide services and manage appointments
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {staff.map((member) => (
        <div
          key={member.id}
          className="card p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {member.fullName}
              </h3>
              {member.role && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {member.role}
                </p>
              )}
            </div>
            <span
              className={`ml-2 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                member.isActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {member.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {member.bio && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
              {member.bio}
            </p>
          )}

          <div className="space-y-1.5 mb-4 text-sm">
            {member.email && (
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <svg
                  className="w-4 h-4 mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="truncate">{member.email}</span>
              </div>
            )}
            {member.phone && (
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <svg
                  className="w-4 h-4 mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>{member.phone}</span>
              </div>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-1">
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                  member.workDays.includes(i)
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 line-through"
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Service assignment indicator */}
          <div className="mb-3">
            {!member.serviceIds || member.serviceIds.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <svg
                  className="w-3.5 h-3.5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                All services
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {member.serviceIds.slice(0, 3).map((svcId) => {
                  const svc = services.find((s) => s.id === svcId);
                  return svc ? (
                    <span
                      key={svcId}
                      className="px-1.5 py-0.5 text-xs rounded bg-primary-50 dark:bg-primary/10 text-primary-700 dark:text-primary-300 font-medium truncate max-w-[110px]"
                    >
                      {svc.name}
                    </span>
                  ) : null;
                })}
                {member.serviceIds.length > 3 && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                    +{member.serviceIds.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onEdit(member)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (
                  confirm("Delete this staff member? This cannot be undone.")
                ) {
                  onDelete(member.id);
                }
              }}
              className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
              title="Delete staff member"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Component
export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    description: "",
    duration: 30,
    price: "",
    isActive: true,
    groupId: "",
  });
  const [staffFormData, setStaffFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "",
    bio: "",
    isActive: true,
    workDays: ALL_DAYS,
    workHours: {} as StaffWorkHoursRecord,
    serviceIds: [] as string[],
  });

  // Fetch services
  const { data: servicesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  // Fetch service groups
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["service-groups"],
    queryFn: async () => {
      const res = await fetch("/api/service-groups");
      if (!res.ok) throw new Error("Failed to fetch service groups");
      return res.json();
    },
  });

  // Fetch staff
  const { data: staffData, isLoading: isLoadingStaff } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const { data: businessHoursData } = useQuery({
    queryKey: ["business-hours"],
    queryFn: async () => {
      const res = await fetch("/api/business-hours");
      if (!res.ok) throw new Error("Failed to fetch business hours");
      return res.json();
    },
  });

  const { data: businessData } = useQuery({
    queryKey: ["business"],
    queryFn: async () => {
      const res = await fetch("/api/business");
      if (!res.ok) throw new Error("Failed to fetch business details");
      return res.json();
    },
  });

  // Create/Update service mutation
  const saveServiceMutation = useMutation({
    mutationFn: async (data: typeof serviceFormData) => {
      const url = editingService
        ? `/api/services/${editingService.id}`
        : "/api/services";
      const method = editingService ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          price: data.price ? parseFloat(data.price) : null,
          groupId: data.groupId || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save service");
      }
      return res.json() as Promise<{ service: Service }>;
    },
    onSuccess: ({ service }) => {
      const previousGroupId = editingService?.groupId ?? null;
      const nextGroupId = service.groupId ?? null;

      queryClient.setQueryData(
        ["services"],
        (current: { services: Service[] } | undefined) =>
          upsertServicesQueryData(current, service),
      );
      queryClient.setQueryData(
        ["service-groups"],
        (current: { groups: ServiceGroup[] } | undefined) =>
          syncServiceGroupCounts(current, previousGroupId, nextGroupId),
      );
      closeModal();
    },
  });

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete service");
      }
      return { id };
    },
    onSuccess: ({ id }) => {
      const removedService =
        queryClient
          .getQueryData<{ services: Service[] }>(["services"])
          ?.services.find((service) => service.id === id) ?? null;

      queryClient.setQueryData(
        ["services"],
        (current: { services: Service[] } | undefined) =>
          removeServiceFromQueryData(current, id),
      );

      if (removedService) {
        queryClient.setQueryData(
          ["service-groups"],
          (current: { groups: ServiceGroup[] } | undefined) =>
            syncServiceGroupCounts(
              current,
              removedService.groupId ?? null,
              null,
            ),
        );
      }
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/service-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create service group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-groups"] });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/service-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update service group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-groups"] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/service-groups/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete service group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-groups"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const reorderGroupsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/service-groups/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reorder service groups");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-groups"] });
    },
  });

  const reorderServicesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/services/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reorder services");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  // Create/Update staff mutation
  const saveStaffMutation = useMutation({
    mutationFn: async (data: typeof staffFormData) => {
      const url = editingStaff ? `/api/staff/${editingStaff.id}` : "/api/staff";
      const method = editingStaff ? "PATCH" : "POST";

      // If all active services are selected, send [] (no restrictions) so new services
      // added in future are automatically available to this staff member.
      const allActiveIds = services.filter((s) => s.isActive).map((s) => s.id);
      const allSelected =
        allActiveIds.length > 0 &&
        allActiveIds.every((id) => data.serviceIds.includes(id));
      const payload = {
        ...data,
        serviceIds: allSelected ? [] : data.serviceIds,
        workHours: data.workHours,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save staff member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      closeModal();
    },
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete staff member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });

  const services: Service[] = servicesData?.services || [];
  const groups: ServiceGroup[] = groupsData?.groups || [];
  const staff: Staff[] = staffData?.staff || [];
  const businessHours: BusinessHour[] = businessHoursData?.businessHours || [];
  const businessTimezone: string | null =
    businessData?.business?.timezone ?? null;
  const businessTimezoneLabel = useMemo(
    () => formatBusinessTimezoneLabel(businessTimezone),
    [businessTimezone],
  );
  const businessHoursRecord = useMemo(
    () => businessHoursArrayToRecord(businessHours),
    [businessHours],
  );

  const openServiceModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        name: service.name,
        description: service.description || "",
        duration: service.duration,
        price: service.price?.toString() || "",
        isActive: service.isActive,
        groupId: service.groupId || "",
      });
    } else {
      setEditingService(null);
      setServiceFormData({
        name: "",
        description: "",
        duration: 30,
        price: "",
        isActive: true,
        groupId: "",
      });
    }
    setModalType("service");
  };

  const openStaffModal = (staffMember?: Staff) => {
    const allActiveIds = services.filter((s) => s.isActive).map((s) => s.id);
    const defaultWorkDays = getDefaultStaffWorkDays(businessHoursRecord);
    if (staffMember) {
      setEditingStaff(staffMember);
      const workDays = staffMember.workDays ?? defaultWorkDays;
      setStaffFormData({
        fullName: staffMember.fullName,
        email: staffMember.email || "",
        phone: staffMember.phone || "",
        role: staffMember.role || "",
        bio: staffMember.bio || "",
        isActive: staffMember.isActive,
        workDays,
        workHours: deriveStaffWorkHoursForForm({
          workDays,
          workHours: staffMember.workHours,
          businessHoursRecord,
        }),
        // Empty serviceIds = no restrictions = highlight all services in the UI
        serviceIds:
          staffMember.serviceIds && staffMember.serviceIds.length > 0
            ? staffMember.serviceIds
            : allActiveIds,
      });
    } else {
      setEditingStaff(null);
      setStaffFormData({
        fullName: "",
        email: "",
        phone: "",
        role: "",
        bio: "",
        isActive: true,
        workDays: defaultWorkDays,
        workHours: deriveStaffWorkHoursForForm({
          workDays: defaultWorkDays,
          businessHoursRecord,
        }),
        serviceIds: allActiveIds,
      });
    }
    setModalType("staff");
  };

  const closeModal = () => {
    setModalType(null);
    setEditingService(null);
    setEditingStaff(null);
  };

  const handleServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveServiceMutation.mutate(serviceFormData);
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStaffMutation.mutate(staffFormData);
  };

  const moveService = (
    serviceId: string,
    direction: "up" | "down",
    groupId: string | null,
  ) => {
    const ordered = [...services].sort((a, b) => a.sortOrder - b.sortOrder);
    const scoped = ordered.filter(
      (service) => (service.groupId ?? null) === groupId,
    );
    const scopedIndex = scoped.findIndex((service) => service.id === serviceId);
    if (scopedIndex < 0) return;
    const targetScopedIndex =
      direction === "up" ? scopedIndex - 1 : scopedIndex + 1;
    if (targetScopedIndex < 0 || targetScopedIndex >= scoped.length) return;

    const targetId = scoped[targetScopedIndex].id;
    const sourceGlobalIndex = ordered.findIndex(
      (service) => service.id === serviceId,
    );
    const targetGlobalIndex = ordered.findIndex(
      (service) => service.id === targetId,
    );
    if (sourceGlobalIndex < 0 || targetGlobalIndex < 0) return;

    [ordered[sourceGlobalIndex], ordered[targetGlobalIndex]] = [
      ordered[targetGlobalIndex],
      ordered[sourceGlobalIndex],
    ];
    reorderServicesMutation.mutate(ordered.map((service) => service.id));
  };

  const moveGroup = (groupId: string, direction: "up" | "down") => {
    const ordered = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((group) => group.id === groupId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [
      ordered[targetIndex],
      ordered[index],
    ];
    reorderGroupsMutation.mutate(ordered.map((group) => group.id));
  };

  const isLoading = isLoadingServices || isLoadingStaff || isLoadingGroups;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Services & Staff
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your services, prices, and team members
          </p>
        </div>
        <button
          onClick={() =>
            activeTab === "services" ? openServiceModal() : openStaffModal()
          }
          className="btn-primary w-full sm:w-auto whitespace-nowrap"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          {activeTab === "services" ? "Add Service" : "Add Staff Member"}
        </button>
      </div>
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="-mb-px flex space-x-6 sm:space-x-8">
          <button
            onClick={() => setActiveTab("services")}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === "services"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Services
              <span
                className={`py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === "services"
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                {services.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === "staff"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Staff
              <span
                className={`py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === "staff"
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                {staff.length}
              </span>
            </div>
          </button>
        </nav>
      </div>
      {/* Tab Content */}
      {activeTab === "services" ? (
        <ServicesTab
          services={services}
          groups={groups}
          onEdit={openServiceModal}
          onDelete={(id) => deleteServiceMutation.mutate(id)}
          onCreateGroup={(name) => createGroupMutation.mutate(name)}
          onRenameGroup={(group) => {
            const nextName = prompt("Rename group", group.name)?.trim();
            if (!nextName || nextName === group.name) return;
            updateGroupMutation.mutate({
              id: group.id,
              updates: { name: nextName },
            });
          }}
          onDeleteGroup={(group) => {
            if (
              confirm(
                `Delete group "${group.name}"? Services in this group will be moved to No group.`,
              )
            ) {
              deleteGroupMutation.mutate(group.id);
            }
          }}
          onMoveGroup={moveGroup}
          onMoveService={moveService}
        />
      ) : (
        <StaffTab
          staff={staff}
          services={services}
          businessHoursRecord={businessHoursRecord}
          onEdit={openStaffModal}
          onDelete={(id) => deleteStaffMutation.mutate(id)}
        />
      )}{" "}
      {/* Service Modal */}
      {modalType === "service" && (
        <div
          data-mobile-overlay="true"
          className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"
        >
          <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-700 sm:border-b-0 sm:px-6 sm:pb-0 sm:pt-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {editingService ? "Edit Service" : "Add New Service"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                <svg
                  className="w-6 h-6"
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

            <form
              onSubmit={handleServiceSubmit}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:pb-0 sm:pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Service Name{" "}
                    <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceFormData.name}
                    onChange={(e) =>
                      setServiceFormData({
                        ...serviceFormData,
                        name: e.target.value,
                      })
                    }
                    className="input w-full"
                    placeholder="e.g., Haircut, Massage, Consultation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={serviceFormData.description}
                    onChange={(e) =>
                      setServiceFormData({
                        ...serviceFormData,
                        description: e.target.value,
                      })
                    }
                    className="input w-full"
                    rows={3}
                    placeholder="Brief description of what's included..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Service Group
                  </label>
                  <CustomSelect
                    value={serviceFormData.groupId}
                    onChange={(val) =>
                      setServiceFormData({ ...serviceFormData, groupId: val })
                    }
                    placeholder="No group"
                    options={groups
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((group) => ({ value: group.id, label: group.name }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Duration (min){" "}
                      <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="5"
                      step="5"
                      value={serviceFormData.duration}
                      onChange={(e) =>
                        setServiceFormData({
                          ...serviceFormData,
                          duration: parseInt(e.target.value),
                        })
                      }
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={serviceFormData.price}
                      onChange={(e) =>
                        setServiceFormData({
                          ...serviceFormData,
                          price: e.target.value,
                        })
                      }
                      className="input w-full"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <input
                    type="checkbox"
                    id="serviceActive"
                    checked={serviceFormData.isActive}
                    onChange={(e) =>
                      setServiceFormData({
                        ...serviceFormData,
                        isActive: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
                  />
                  <label
                    htmlFor="serviceActive"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Active and available for booking
                  </label>
                </div>

                {saveServiceMutation.isError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {saveServiceMutation.error?.message ||
                        "Failed to save service"}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 sm:flex-row sm:border-t-0 sm:px-6 sm:pb-6 sm:pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={saveServiceMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saveServiceMutation.isPending}
                >
                  {saveServiceMutation.isPending ? (
                    <span className="inline-flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </span>
                  ) : editingService ? (
                    "Save Changes"
                  ) : (
                    "Add Service"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Staff Modal */}
      {modalType === "staff" && (
        <div
          data-mobile-overlay="true"
          className="fixed inset-0 z-[70] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"
        >
          <div className="flex h-[100dvh] min-h-[100dvh] w-full flex-col bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:min-h-0 sm:max-h-[90vh] sm:max-w-5xl sm:rounded-xl sm:border sm:border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-700 sm:px-6 sm:pb-0 sm:pt-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
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

            <form
              onSubmit={handleStaffSubmit}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:pb-0 sm:pt-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-4 lg:contents">
                    <section className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Full Name{" "}
                            <span className="text-red-500 dark:text-red-400">
                              *
                            </span>
                          </label>
                          <input
                            type="text"
                            required
                            value={staffFormData.fullName}
                            onChange={(e) =>
                              setStaffFormData({
                                ...staffFormData,
                                fullName: e.target.value,
                              })
                            }
                            className="input w-full"
                            placeholder="John Doe"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email
                          </label>
                          <input
                            type="email"
                            value={staffFormData.email}
                            onChange={(e) =>
                              setStaffFormData({
                                ...staffFormData,
                                email: e.target.value,
                              })
                            }
                            className="input w-full"
                            placeholder="john@example.com"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={staffFormData.phone}
                            onChange={(e) =>
                              setStaffFormData({
                                ...staffFormData,
                                phone: e.target.value,
                              })
                            }
                            className="input w-full"
                            placeholder="(555) 123-4567"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Role / Title
                          </label>
                          <input
                            type="text"
                            value={staffFormData.role}
                            onChange={(e) =>
                              setStaffFormData({
                                ...staffFormData,
                                role: e.target.value,
                              })
                            }
                            className="input w-full"
                            placeholder="e.g., Senior Stylist, Massage Therapist"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Bio
                          </label>
                          <textarea
                            value={staffFormData.bio}
                            onChange={(e) =>
                              setStaffFormData({
                                ...staffFormData,
                                bio: e.target.value,
                              })
                            }
                            className="input w-full"
                            rows={4}
                            placeholder="Brief description about this staff member..."
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-4 lg:contents">
                    <section className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                            Working days
                          </h3>
                        </div>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
                          Times shown in {businessTimezoneLabel}
                        </span>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2.5">
                        {DAY_LABELS.map((label, i) =>
                          (() => {
                            const businessDay = businessHoursRecord[i];
                            const isBusinessOpen = Boolean(
                              businessDay?.isOpen &&
                              businessDay.openTime &&
                              businessDay.closeTime,
                            );
                            const isSelected =
                              staffFormData.workDays.includes(i);

                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  const current = staffFormData.workDays;
                                  const next = isSelected
                                    ? current.filter((d) => d !== i)
                                    : [...current, i].sort((a, b) => a - b);
                                  const nextWorkHours = {
                                    ...staffFormData.workHours,
                                  };

                                  if (isSelected) {
                                    delete nextWorkHours[i];
                                  } else if (
                                    isBusinessOpen &&
                                    businessDay?.openTime &&
                                    businessDay.closeTime
                                  ) {
                                    nextWorkHours[i] = {
                                      startTime: businessDay.openTime,
                                      endTime: businessDay.closeTime,
                                    };
                                  }

                                  setStaffFormData({
                                    ...staffFormData,
                                    workDays: next,
                                    workHours: nextWorkHours,
                                  });
                                }}
                                disabled={!isBusinessOpen && !isSelected}
                                title={
                                  !isBusinessOpen && !isSelected
                                    ? "Business is closed on this day"
                                    : undefined
                                }
                                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                  isSelected
                                    ? "border-primary bg-primary text-white shadow-[0_12px_30px_-18px_rgba(24,166,120,0.9)]"
                                    : !isBusinessOpen
                                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                                      : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-primary/50 dark:hover:text-primary-300"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })(),
                        )}
                      </div>
                      <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300">
                        Staff hours are set per day below, stay inside business
                        hours, and are interpreted in the business timezone so
                        desktop, public booking, and AI booking all stay in
                        sync.
                      </div>
                    </section>

                    <section className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                            Working hours
                          </h3>
                        </div>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
                          30-minute increments
                        </span>
                      </div>

                      {staffFormData.workDays.length === 0 ? (
                        <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300">
                          Select at least one working day to define the exact
                          hours this staff member accepts appointments.
                        </div>
                      ) : (
                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                          {staffFormData.workDays.map((dayOfWeek) => {
                            const businessDay = businessHoursRecord[dayOfWeek];
                            const dayLabel = DAY_LABELS[dayOfWeek];

                            if (
                              !businessDay?.isOpen ||
                              !businessDay.openTime ||
                              !businessDay.closeTime
                            ) {
                              return (
                                <div
                                  key={dayOfWeek}
                                  className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                                >
                                  {dayLabel}: Business is closed, so no staff
                                  hours can be set.
                                </div>
                              );
                            }

                            const selectedHours = staffFormData.workHours[
                              dayOfWeek
                            ] ?? {
                              startTime: businessDay.openTime,
                              endTime: businessDay.closeTime,
                            };
                            const startOptions = buildTimeOptions(
                              businessDay.openTime,
                              businessDay.closeTime,
                            );
                            const startSelectOptions = startOptions.map(
                              (timeValue) => ({
                                value: timeValue,
                                label: formatScheduleTimeLabel(timeValue),
                              }),
                            );
                            const minimumEnd = addMinutesToTimeString(
                              selectedHours.startTime,
                              30,
                            );
                            const endOptions = buildTimeOptions(
                              minimumEnd,
                              businessDay.closeTime,
                              {
                                includeEnd: true,
                              },
                            );
                            const endSelectOptions = endOptions.map(
                              (timeValue) => ({
                                value: timeValue,
                                label: formatScheduleTimeLabel(timeValue),
                              }),
                            );
                            const safeEndTime = endOptions.includes(
                              selectedHours.endTime,
                            )
                              ? selectedHours.endTime
                              : endOptions[endOptions.length - 1];

                            return (
                              <div
                                key={dayOfWeek}
                                className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/70"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-base font-semibold text-gray-950 dark:text-white">
                                      {dayLabel}
                                    </p>
                                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                      Business window
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
                                    {formatScheduleTimeRange(
                                      businessDay.openTime,
                                      businessDay.closeTime,
                                    )}
                                  </span>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="space-y-1.5">
                                    <span className="block text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                      Start
                                    </span>
                                    <CustomSelect
                                      ariaLabel={`${dayLabel} start time`}
                                      value={selectedHours.startTime}
                                      onChange={(startTime) => {
                                        const nextEndOptions = buildTimeOptions(
                                          addMinutesToTimeString(startTime, 30),
                                          businessDay.closeTime!,
                                          { includeEnd: true },
                                        );
                                        const nextEndTime =
                                          nextEndOptions.includes(
                                            selectedHours.endTime,
                                          )
                                            ? selectedHours.endTime
                                            : nextEndOptions[
                                                nextEndOptions.length - 1
                                              ];
                                        setStaffFormData({
                                          ...staffFormData,
                                          workHours: {
                                            ...staffFormData.workHours,
                                            [dayOfWeek]: {
                                              startTime,
                                              endTime: nextEndTime,
                                            },
                                          },
                                        });
                                      }}
                                      className="input w-full"
                                      options={startSelectOptions}
                                    />
                                  </label>
                                  <label className="space-y-1.5">
                                    <span className="block text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                      End
                                    </span>
                                    <CustomSelect
                                      ariaLabel={`${dayLabel} end time`}
                                      value={safeEndTime}
                                      onChange={(endTime) =>
                                        setStaffFormData({
                                          ...staffFormData,
                                          workHours: {
                                            ...staffFormData.workHours,
                                            [dayOfWeek]: {
                                              startTime:
                                                selectedHours.startTime,
                                              endTime,
                                            },
                                          },
                                        })
                                      }
                                      className="input w-full"
                                      options={endSelectOptions}
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {/* Service Assignments */}
                    <section className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                            Services this staff can perform
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = services
                              .filter((s) => s.isActive)
                              .map((s) => s.id);
                            setStaffFormData({
                              ...staffFormData,
                              serviceIds: allIds,
                            });
                          }}
                          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary/35 hover:bg-primary/15 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200"
                        >
                          Select all services
                        </button>
                      </div>

                      {(() => {
                        const allActiveIds = services
                          .filter((s) => s.isActive)
                          .map((s) => s.id);
                        const allSelected =
                          allActiveIds.length > 0 &&
                          allActiveIds.every((id) =>
                            staffFormData.serviceIds.includes(id),
                          );
                        return (
                          <p className="mt-4 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {allSelected
                              ? "All services selected - this staff member can be booked for everything."
                              : staffFormData.serviceIds.length === 0
                                ? "No services selected - deselecting all will prevent this staff member from being booked."
                                : `Restricted to ${staffFormData.serviceIds.length} service${staffFormData.serviceIds.length !== 1 ? "s" : ""}. Customers can only book this staff member for the selected services.`}
                          </p>
                        );
                      })()}

                      {/* Group + service toggles */}
                      {groups.length > 0 ? (
                        <div className="mt-5 space-y-4">
                          {groups
                            .slice()
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((group) => {
                              const groupServices = services.filter(
                                (s) => s.groupId === group.id && s.isActive,
                              );
                              if (groupServices.length === 0) return null;
                              const allSelected = groupServices.every((s) =>
                                staffFormData.serviceIds.includes(s.id),
                              );
                              return (
                                <div
                                  key={group.id}
                                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/70"
                                >
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:text-gray-400">
                                      {group.name}
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={allSelected}
                                        onClick={() => {
                                          const groupIds = groupServices.map(
                                            (s) => s.id,
                                          );
                                          const next = [
                                            ...new Set([
                                              ...staffFormData.serviceIds,
                                              ...groupIds,
                                            ]),
                                          ];
                                          setStaffFormData({
                                            ...staffFormData,
                                            serviceIds: next,
                                          });
                                        }}
                                        className="text-xs font-medium text-primary hover:underline disabled:opacity-40 dark:text-primary-300"
                                      >
                                        Select all
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const groupIds = new Set(
                                            groupServices.map((s) => s.id),
                                          );
                                          setStaffFormData({
                                            ...staffFormData,
                                            serviceIds:
                                              staffFormData.serviceIds.filter(
                                                (id) => !groupIds.has(id),
                                              ),
                                          });
                                        }}
                                        className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {groupServices.map((svc) => {
                                      const isSelected =
                                        staffFormData.serviceIds.includes(
                                          svc.id,
                                        );
                                      return (
                                        <button
                                          key={svc.id}
                                          type="button"
                                          onClick={() => {
                                            const next = isSelected
                                              ? staffFormData.serviceIds.filter(
                                                  (id) => id !== svc.id,
                                                )
                                              : [
                                                  ...staffFormData.serviceIds,
                                                  svc.id,
                                                ];
                                            setStaffFormData({
                                              ...staffFormData,
                                              serviceIds: next,
                                            });
                                          }}
                                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                            isSelected
                                              ? "border-primary bg-primary text-white shadow-[0_12px_30px_-18px_rgba(24,166,120,0.9)]"
                                              : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-primary/50 dark:hover:text-primary-300"
                                          }`}
                                        >
                                          {svc.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          {/* Ungrouped services */}
                          {(() => {
                            const ungrouped = services.filter(
                              (s) => !s.groupId && s.isActive,
                            );
                            if (ungrouped.length === 0) return null;
                            return (
                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/70">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:text-gray-400">
                                    Other
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ids = ungrouped.map((s) => s.id);
                                        setStaffFormData({
                                          ...staffFormData,
                                          serviceIds: [
                                            ...new Set([
                                              ...staffFormData.serviceIds,
                                              ...ids,
                                            ]),
                                          ],
                                        });
                                      }}
                                      className="text-xs font-medium text-primary hover:underline dark:text-primary-300"
                                    >
                                      Select all
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ids = new Set(
                                          ungrouped.map((s) => s.id),
                                        );
                                        setStaffFormData({
                                          ...staffFormData,
                                          serviceIds:
                                            staffFormData.serviceIds.filter(
                                              (id) => !ids.has(id),
                                            ),
                                        });
                                      }}
                                      className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {ungrouped.map((svc) => {
                                    const isSelected =
                                      staffFormData.serviceIds.includes(svc.id);
                                    return (
                                      <button
                                        key={svc.id}
                                        type="button"
                                        onClick={() => {
                                          const next = isSelected
                                            ? staffFormData.serviceIds.filter(
                                                (id) => id !== svc.id,
                                              )
                                            : [
                                                ...staffFormData.serviceIds,
                                                svc.id,
                                              ];
                                          setStaffFormData({
                                            ...staffFormData,
                                            serviceIds: next,
                                          });
                                        }}
                                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                          isSelected
                                            ? "border-primary bg-primary text-white shadow-[0_12px_30px_-18px_rgba(24,166,120,0.9)]"
                                            : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-primary/50 dark:hover:text-primary-300"
                                        }`}
                                      >
                                        {svc.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        /* No groups - flat list */
                        <div className="mt-5 flex flex-wrap gap-2">
                          {services
                            .filter((s) => s.isActive)
                            .map((svc) => {
                              const isSelected =
                                staffFormData.serviceIds.includes(svc.id);
                              return (
                                <button
                                  key={svc.id}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected
                                      ? staffFormData.serviceIds.filter(
                                          (id) => id !== svc.id,
                                        )
                                      : [...staffFormData.serviceIds, svc.id];
                                    setStaffFormData({
                                      ...staffFormData,
                                      serviceIds: next,
                                    });
                                  }}
                                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                    isSelected
                                      ? "border-primary bg-primary text-white shadow-[0_12px_30px_-18px_rgba(24,166,120,0.9)]"
                                      : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-primary/50 dark:hover:text-primary-300"
                                  }`}
                                >
                                  {svc.name}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </section>

                    <section className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
                      <label
                        htmlFor="staffActive"
                        className="flex items-start gap-3"
                      >
                        <input
                          type="checkbox"
                          id="staffActive"
                          checked={staffFormData.isActive}
                          onChange={(e) =>
                            setStaffFormData({
                              ...staffFormData,
                              isActive: e.target.checked,
                            })
                          }
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                            Active and available for appointments
                          </span>
                        </span>
                      </label>
                    </section>
                  </div>

                  {saveStaffMutation.isError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20 lg:col-span-2">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {saveStaffMutation.error?.message ||
                          "Failed to save staff member"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-700 sm:flex-row sm:border-t-0 sm:px-6 sm:pb-6 sm:pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  disabled={saveStaffMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors shadow-sm hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saveStaffMutation.isPending}
                >
                  {saveStaffMutation.isPending ? (
                    <span className="inline-flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </span>
                  ) : editingStaff ? (
                    "Save Changes"
                  ) : (
                    "Add Staff Member"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
