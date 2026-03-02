import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import CustomerDetail from "@/components/customers/CustomerDetail";

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
    include: {      checkIns: {
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
      redemptions: {
        orderBy: { createdAt: "desc" },
        include: {
          reward: true,
        },
      },
      pointsTransactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: {
        select: {
          checkIns: true,
          appointments: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <CustomerDetail
      customer={customer}
    />
  );
}
