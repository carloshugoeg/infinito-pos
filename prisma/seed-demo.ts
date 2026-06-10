import { PrismaClient, CashSessionStatus, OrderStatus, PaymentMethod, InventoryMovementType } from "@prisma/client";

const prisma = new PrismaClient();

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

async function main() {
  console.log("Starting demo seed...");

  // Get base data that should exist from normal seed
  const branch = await prisma.branch.findFirst({ where: { code: "CENTRO" } });
  if (!branch) throw new Error("Branch CENTRO not found. Did you run standard seed first?");

  const admin = await prisma.user.findFirst({ where: { email: "admin@koi.local" } });
  if (!admin) throw new Error("Admin user not found.");

  const products = await prisma.product.findMany({
    include: {
      modifierGroups: {
        include: { modifiers: { include: { recipeItems: true } } }
      },
      recipeItems: true
    }
  });
  if (products.length === 0) throw new Error("No products found.");

  console.log("Cleaning up old transactional data...");
  await prisma.inventoryMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItemModifier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cashSession.deleteMany();
  await prisma.customer.deleteMany();

  console.log("Creating customers...");
  const customer1 = await prisma.customer.create({
    data: { nit: "12345678", name: "Inversor Principal", phone: "55551234" }
  });
  const customer2 = await prisma.customer.create({
    data: { nit: "87654321", name: "Maria Gonzalez", phone: "55559876" }
  });
  const customers = [null, null, null, null, null, customer1, customer2]; // mostly anonymous

  console.log("Generating 30 days of data...");
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(8, 0, 0, 0);

  const currentDay = new Date(thirtyDaysAgo);

  while (currentDay <= now) {
    const isToday = currentDay.toDateString() === now.toDateString();
    
    // Open session at 8 AM
    const openedAt = new Date(currentDay);
    openedAt.setHours(8, 0, 0, 0);
    
    // Close session at 6 PM (if not today)
    const closedAt = isToday ? null : new Date(currentDay);
    if (closedAt) closedAt.setHours(18, 0, 0, 0);

    const session = await prisma.cashSession.create({
      data: {
        branchId: branch.id,
        openedById: admin.id,
        closedById: isToday ? null : admin.id,
        openingAmount: 500, // Q500 opening
        status: isToday ? CashSessionStatus.OPEN : CashSessionStatus.CLOSED,
        openedAt,
        closedAt,
      }
    });

    const numOrders = isToday ? randomInt(5, 15) : randomInt(15, 40);
    let sessionCash = 0;
    
    // Distribute orders between 8 AM and 6 PM
    for (let i = 0; i < numOrders; i++) {
      const orderTime = new Date(openedAt);
      orderTime.setMinutes(orderTime.getMinutes() + randomInt(10, 580)); // Add up to ~9.5 hours

      if (isToday && orderTime > now) continue;

      const customer = randomItem(customers);
      const isCancelled = randomInt(1, 100) <= 2; // 2% chance cancelled

      let subtotal = 0;
      const itemsData = [];
      const inventoryMoves = [];

      const numItems = randomInt(1, 3);
      for (let j = 0; j < numItems; j++) {
        const product = randomItem(products);
        const qty = randomInt(1, 2);
        
        let itemLineTotal = Number(product.basePrice) * qty;
        const itemModifiersData = [];

        // Pick modifiers
        for (const group of product.modifierGroups) {
          const numSelections = randomInt(group.minSelections, Math.min(group.maxSelections, group.modifiers.length));
          const shuffledModifiers = [...group.modifiers].sort(() => 0.5 - Math.random());
          const selected = shuffledModifiers.slice(0, numSelections);

          for (const mod of selected) {
            itemLineTotal += Number(mod.priceDelta) * qty;
            itemModifiersData.push({
              modifierId: mod.id,
              modifierNameSnapshot: mod.name,
              priceDeltaSnapshot: mod.priceDelta,
            });

            // Inventory for modifiers
            if (!isCancelled) {
              for (const ri of mod.recipeItems) {
                inventoryMoves.push({
                  branchId: branch.id,
                  ingredientId: ri.ingredientId,
                  type: InventoryMovementType.SALE,
                  quantityDelta: -Number(ri.quantity) * qty,
                  reason: `Sale item mod ${mod.name}`,
                  createdById: admin.id,
                  createdAt: orderTime
                });
              }
            }
          }
        }

        // Inventory for product base recipe
        if (!isCancelled) {
          for (const ri of product.recipeItems) {
            inventoryMoves.push({
              branchId: branch.id,
              ingredientId: ri.ingredientId,
              type: InventoryMovementType.SALE,
              quantityDelta: -Number(ri.quantity) * qty,
              reason: `Sale product ${product.name}`,
              createdById: admin.id,
              createdAt: orderTime
            });
          }
        }

        itemsData.push({
          productId: product.id,
          productNameSnapshot: product.name,
          basePriceSnapshot: product.basePrice,
          quantity: qty,
          lineTotal: itemLineTotal,
          modifiers: {
            create: itemModifiersData
          }
        });

        subtotal += itemLineTotal;
      }

      const total = subtotal; // No discount/tax for demo simplicity
      
      const paymentMethods = [PaymentMethod.CASH, PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER];
      const method = randomItem(paymentMethods);
      
      if (method === PaymentMethod.CASH && !isCancelled) {
        sessionCash += total;
      }

      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          cashSessionId: session.id,
          customerId: customer?.id,
          customerNit: customer?.nit || "CF",
          customerName: customer?.name || "Consumidor Final",
          customerPhone: customer?.phone,
          // Only the last 5 orders of today will be PENDING, rest are DELIVERED
          status: isCancelled ? OrderStatus.CANCELLED : 
                  (isToday && i >= numOrders - 5 ? OrderStatus.PENDING : OrderStatus.DELIVERED),
          subtotal,
          total,
          createdById: admin.id,
          createdAt: orderTime,
          paidAt: orderTime,
          cancelledAt: isCancelled ? orderTime : null,
          items: {
            create: itemsData
          },
          payments: isCancelled ? undefined : {
            create: [{
              method,
              amount: total,
              receivedAmount: method === PaymentMethod.CASH ? total : null,
              createdAt: orderTime
            }]
          }
        }
      });

      if (!isCancelled && inventoryMoves.length > 0) {
        // Create moves and attach order id
        await prisma.inventoryMovement.createMany({
          data: inventoryMoves.map(m => ({ ...m, orderId: order.id }))
        });

        // Also update actual inventory quantities
        for (const move of inventoryMoves) {
          await prisma.branchInventory.update({
            where: { branchId_ingredientId: { branchId: branch.id, ingredientId: move.ingredientId } },
            data: { quantityOnHand: { increment: move.quantityDelta } }
          });
        }
      }
    }

    if (!isToday) {
      // Close out session
      const expectedCash = 500 + sessionCash;
      const difference = randomInt(0, 100) > 90 ? randomInt(-20, 20) : 0; // 10% chance of variance
      
      await prisma.cashSession.update({
        where: { id: session.id },
        data: {
          closingAmount: expectedCash + difference,
          expectedCashAmount: expectedCash,
          cashDifference: difference
        }
      });
    }

    // Move to next day
    currentDay.setDate(currentDay.getDate() + 1);
  }

  console.log("Demo seed finished successfully!");
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
