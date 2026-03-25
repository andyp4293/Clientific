import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CustomerList from "@/components/customers/CustomerList";
import { buildCustomerWhereClause } from "@/lib/customer-filters";
import type {
  CustomerContactFilter,
  CustomerSmsFilter,
  CustomerVisitFilter,
} from "@/lib/customer-filter-options";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    group?: string;
    sms?: CustomerSmsFilter;
    contact?: CustomerContactFilter;
    visit?: CustomerVisitFilter;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.businessId) {
    redirect("/login");
  }

  const businessId = session.user.businessId;
  const params = await searchParams;
  const where = buildCustomerWhereClause({
    businessId,
    search: params.search,
    group: params.group,
    sms: params.sms,
    contact: params.contact,
    visit: params.visit,
  });

  const [customers, groups] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { checkIns: true, appointments: true } },
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
      orderBy: { createdAt: "desc" },
    }),
    prisma.customerGroup.findMany({
      where: { businessId },
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your customer database and track engagement
          </p>
        </div>
      </div>

      <CustomerList
        customers={customers}
        groups={groups}
        initialSearch={params.search}
        initialGroupFilter={params.group}
        initialSmsFilter={params.sms}
        initialContactFilter={params.contact}
        initialVisitFilter={params.visit}
      />
    </div>
  );
}
