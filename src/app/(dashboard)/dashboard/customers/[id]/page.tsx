import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import CustomerDetail from "@/components/customers/CustomerDetail";
import {
  collectAppointmentServiceIds,
  withAppointmentServiceDisplay,
} from "@/lib/appointment-services";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.businessId) {
    redirect("/login");
  }

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      businessId: session.user.businessId,
    },
    include: {
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      appointments: {
        orderBy: { startTime: "desc" },
        take: 10,
        include: {
          service: true,
          staff: true,
        },
      },
      _count: {
        select: {
          checkIns: true,
          appointments: true,
        },
      },
      groupMemberships: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
              promotionSmsEnabled: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const appointmentServiceIds = collectAppointmentServiceIds(customer.appointments);
  const appointmentServices = appointmentServiceIds.length > 0
    ? await prisma.service.findMany({
        where: { id: { in: appointmentServiceIds } },
        select: { id: true, name: true },
      })
    : [];
  const customerWithServiceDisplay = {
    ...customer,
    appointments: withAppointmentServiceDisplay(customer.appointments, appointmentServices),
  };

  const business = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    select: {
      googleReviewUrl: true,
      yelpUrl: true,
      customerGroups: {
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          promotionSmsEnabled: true,
        },
      },
    },
  });

  return (
    <CustomerDetail
      customer={customerWithServiceDisplay}
      groups={business?.customerGroups ?? []}
      googleReviewUrl={business?.googleReviewUrl}
      yelpUrl={business?.yelpUrl}
    />
  );
}
