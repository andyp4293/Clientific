import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CustomerList from "@/components/customers/CustomerList";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { search?: string; segment?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.businessId) {
    redirect("/login");
  }

  const businessId = session.user.businessId;

  // Build where clause
  const where: any = { businessId };

  // Search filter
  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: "insensitive" } },
      { email: { contains: searchParams.search, mode: "insensitive" } },
      { phone: { contains: searchParams.search, mode: "insensitive" } },
    ];
  }

  // Segment filter
  if (searchParams.segment) {
    where.segment = searchParams.segment;
  }
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
        initialSearch={searchParams.search}
        initialSegment={searchParams.segment}
      />
    </div>
  );
}
