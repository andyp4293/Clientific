import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CustomerList from "@/components/customers/CustomerList";
import { buildCustomerWhereClause } from "@/lib/customer-filters";
import type {
  CustomerContactFilter,
  CustomerSegmentFilter,
  CustomerSmsFilter,
  CustomerVisitFilter,
} from "@/lib/customer-filter-options";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    segment?: CustomerSegmentFilter;
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
    segment: params.segment,
    sms: params.sms,
    contact: params.contact,
    visit: params.visit,
  });

  const [customers, segmentCounts] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { checkIns: true, appointments: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.groupBy({ by: ["segment"], where: { businessId }, _count: true }),
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
        segmentCounts={segmentCounts}
        initialSearch={params.search}
        initialSegment={params.segment}
        initialSmsFilter={params.sms}
        initialContactFilter={params.contact}
        initialVisitFilter={params.visit}
      />
    </div>
  );
}
