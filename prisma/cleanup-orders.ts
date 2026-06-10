import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up active orders...");

  // Find all active (PENDING, PREPARING)
  const activeOrders = await prisma.order.findMany({
    where: { status: { in: ["PENDING", "PREPARING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });

  if (activeOrders.length > 5) {
    const toDeliver = activeOrders.slice(5).map(o => o.id);
    await prisma.order.updateMany({
      where: { id: { in: toDeliver } },
      data: { status: "DELIVERED", deliveredAt: new Date() }
    });
    console.log(`Moved ${toDeliver.length} extra active orders to DELIVERED, keeping the 5 most recent.`);
  } else {
    console.log(`Only ${activeOrders.length} active orders found, no need to trim.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
