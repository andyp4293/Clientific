type ServiceLike = {
  id?: string | null;
  name: string;
};

type AppointmentServiceCarrier = {
  serviceIds?: string[] | null;
  service?: ServiceLike | null;
};

export type ResolvedAppointmentService = {
  id: string;
  name: string;
};

export type AppointmentServiceDisplay = {
  services: ResolvedAppointmentService[];
  serviceDisplayName: string | null;
};

export function collectAppointmentServiceIds<T extends AppointmentServiceCarrier>(
  appointments: T[],
): string[] {
  const serviceIds = new Set<string>();

  for (const appointment of appointments) {
    for (const serviceId of appointment.serviceIds ?? []) {
      if (serviceId) {
        serviceIds.add(serviceId);
      }
    }
  }

  return [...serviceIds];
}

function resolveAppointmentServices<T extends AppointmentServiceCarrier>(
  appointment: T,
  servicesById: Map<string, ResolvedAppointmentService>,
): ResolvedAppointmentService[] {
  const orderedServices = (appointment.serviceIds ?? [])
    .map((serviceId) => servicesById.get(serviceId))
    .filter((service): service is ResolvedAppointmentService => Boolean(service));

  if (orderedServices.length > 0) {
    return orderedServices;
  }

  if (!appointment.service?.name) {
    return [];
  }

  return [
    {
      id: appointment.service.id ?? appointment.serviceIds?.[0] ?? '',
      name: appointment.service.name,
    },
  ];
}

export function withAppointmentServiceDisplay<T extends AppointmentServiceCarrier>(
  appointments: T[],
  availableServices: ResolvedAppointmentService[],
): Array<T & AppointmentServiceDisplay> {
  const servicesById = new Map(
    availableServices.map((service) => [service.id, service] as const),
  );

  return appointments.map((appointment) => {
    const services = resolveAppointmentServices(appointment, servicesById);

    return {
      ...appointment,
      services,
      serviceDisplayName: services.length > 0
        ? services.map((service) => service.name).join(', ')
        : null,
    };
  });
}

export function resolveAppointmentServiceDisplayName<T extends AppointmentServiceCarrier>(
  appointment: T,
  availableServices: ResolvedAppointmentService[],
): string | null {
  const servicesById = new Map(
    availableServices.map((service) => [service.id, service] as const),
  );
  const services = resolveAppointmentServices(appointment, servicesById);

  return services.length > 0 ? services.map((service) => service.name).join(', ') : null;
}
