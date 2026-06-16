import { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

export type EmpiricalDailyRow = {
  label: string;
  unitPrice: number;
  cashCount: number;
  cardCount: number;
  transferCount: number;
  deliveryCount: number;
};

export type EmpiricalDailySection = {
  title: string;
  rows: EmpiricalDailyRow[];
};

const sections: Array<{
  title: string;
  rows: Array<{ label: string; aliases: string[]; unitPrice: number }>;
}> = [
  {
    title: "VASOS",
    rows: [
      { label: "Con leche", aliases: ["Chocolate con leche"], unitPrice: 38 },
      { label: "Blanco", aliases: ["Chocolate blanco"], unitPrice: 38 },
      { label: "Solo Fresa", aliases: ["Solo Fresa"], unitPrice: 25 },
      { label: "Solo Mango", aliases: ["Solo Mango"], unitPrice: 5 },
      { label: "Crema", aliases: ["Crema"], unitPrice: 35 }
    ]
  },
  {
    title: "TOPPINGS",
    rows: [
      { label: "Oreo", aliases: ["Oreo"], unitPrice: 0 },
      { label: "Lotus", aliases: ["Lotus"], unitPrice: 0 },
      { label: "Malvaviscos", aliases: ["Malvavisco", "Malvaviscos"], unitPrice: 0 },
      { label: "Pistacho", aliases: ["Pistacho"], unitPrice: 0 },
      { label: "Almendra", aliases: ["Almendra"], unitPrice: 0 },
      { label: "Coco", aliases: ["Coco"], unitPrice: 0 },
      { label: "Jalea de mango", aliases: ["Jalea de mango"], unitPrice: 0 },
      { label: "Jalea de fresa", aliases: ["Jalea de fresa"], unitPrice: 0 },
      { label: "Leche condensada", aliases: ["Leche condensada"], unitPrice: 0 }
    ]
  },
  {
    title: "EXTRA TOPPING",
    rows: [
      { label: "Mango", aliases: ["Extra Mango"], unitPrice: 10 },
      { label: "Oreo", aliases: ["Extra Oreo"], unitPrice: 5 },
      { label: "Lotus", aliases: ["Extra Lotus"], unitPrice: 5 },
      { label: "Malvaviscos", aliases: ["Extra Malvavisco", "Extra Malvaviscos"], unitPrice: 5 },
      { label: "Pistacho", aliases: ["Extra Pistacho"], unitPrice: 5 },
      { label: "Almendra", aliases: ["Extra Almendra"], unitPrice: 5 },
      { label: "Coco", aliases: ["Extra Coco"], unitPrice: 5 },
      { label: "Jalea de mango", aliases: ["Extra Jalea de mango"], unitPrice: 5 },
      { label: "Jalea de fresa", aliases: ["Extra Jalea de fresa"], unitPrice: 5 },
      { label: "Leche condensada", aliases: ["Extra Leche condensada"], unitPrice: 5 }
    ]
  },
  {
    title: "EXTRA BASES",
    rows: [
      { label: "Chocolate con leche", aliases: ["Extra chocolate con leche"], unitPrice: 10 },
      { label: "Chocolate blanco", aliases: ["Extra chocolate blanco"], unitPrice: 10 },
      { label: "Crema", aliases: ["Extra crema"], unitPrice: 10 }
    ]
  },
  {
    title: "EXTRAS",
    rows: [
      { label: "Tapa", aliases: ["Tapadera", "Tapa"], unitPrice: 0 },
      { label: "Tenedor", aliases: ["Tenedor"], unitPrice: 0 }
    ]
  }
];

export async function getEmpiricalDailyReport(branchId: string, date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const orders = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: start, lt: end },
      status: { not: "CANCELLED" }
    },
    include: {
      payments: true,
      items: { include: { modifiers: true } }
    }
  });

  const reportSections: EmpiricalDailySection[] = sections.map((section) => ({
    title: section.title,
    rows: section.rows.map((row) => ({ label: row.label, unitPrice: row.unitPrice, cashCount: 0, cardCount: 0, transferCount: 0, deliveryCount: 0 }))
  }));

  for (const order of orders) {
    const method = getPrimaryPaymentMethod(order.payments.map((payment) => ({ method: payment.method, amount: toNumber(payment.amount) })));
    for (const item of order.items) {
      for (const modifier of item.modifiers) {
        const match = findReportRow(reportSections, modifier.modifierNameSnapshot);
        if (!match) continue;
        if (method === PaymentMethod.CASH) match.cashCount += item.quantity;
        if (method === PaymentMethod.CARD) match.cardCount += item.quantity;
        if (method === PaymentMethod.TRANSFER) match.transferCount += item.quantity;
        if (method === PaymentMethod.DELIVERY) match.deliveryCount += item.quantity;
      }
    }
  }

  const paymentTotals = {
    cash: 0,
    card: 0,
    transfer: 0,
    delivery: 0
  };
  for (const order of orders) {
    for (const payment of order.payments) {
      if (payment.method === PaymentMethod.CASH) paymentTotals.cash += toNumber(payment.amount);
      if (payment.method === PaymentMethod.CARD) paymentTotals.card += toNumber(payment.amount);
      if (payment.method === PaymentMethod.TRANSFER) paymentTotals.transfer += toNumber(payment.amount);
      if (payment.method === PaymentMethod.DELIVERY) paymentTotals.delivery += toNumber(payment.amount);
    }
  }

  return { sections: reportSections, paymentTotals };
}

function getPrimaryPaymentMethod(payments: Array<{ method: PaymentMethod; amount: number }>) {
  return [...payments].sort((a, b) => b.amount - a.amount)[0]?.method ?? PaymentMethod.CASH;
}

function findReportRow(reportSections: EmpiricalDailySection[], modifierName: string) {
  const normalized = normalize(modifierName);
  for (const sectionIndex of sections.keys()) {
    const sourceSection = sections[sectionIndex];
    const targetSection = reportSections[sectionIndex];
    for (const rowIndex of sourceSection.rows.keys()) {
      const sourceRow = sourceSection.rows[rowIndex];
      if (sourceRow.aliases.some((alias) => normalize(alias) === normalized)) {
        return targetSection.rows[rowIndex];
      }
    }
  }
  return null;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
