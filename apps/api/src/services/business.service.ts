import { prisma } from '../lib/prisma';
import { toNum } from '../lib/auth';

export async function generateInstallments(bookingId: string, totalAmount: number, downPayment: number, count: number, startDate: Date) {
  const remaining = totalAmount - downPayment;
  const installmentAmount = remaining / count;
  const installments = [];
  for (let i = 1; i <= count; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    installments.push({
      bookingId, number: i, amount: installmentAmount, dueDate,
    });
  }
  await prisma.installment.createMany({ data: installments });
  return installments;
}

export async function confirmBooking(bookingId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { unit: true, customer: true },
    });
    if (!booking) throw new Error('Booking not found');
    if (booking.status === 'CONFIRMED') throw new Error('Already confirmed');

    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
    await tx.unit.update({ where: { id: booking.unitId }, data: { status: 'BOOKED' } });

    const existing = await tx.installment.count({ where: { bookingId } });
    if (existing === 0) {
      await generateInstallments(
        bookingId,
        toNum(booking.totalAmount),
        toNum(booking.downPayment),
        12,
        new Date()
      );
    }

    const revenueAccount = await tx.chartAccount.findFirst({ where: { code: '4000' } });
    const cashAccount = await tx.chartAccount.findFirst({ where: { code: '1000' } });
    if (revenueAccount && cashAccount && toNum(booking.downPayment) > 0) {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}`,
          description: `Booking ${booking.bookingNumber} - Down payment`,
          reference: booking.bookingNumber,
          lines: {
            create: [
              { accountId: cashAccount.id, debit: booking.downPayment, credit: 0, description: 'Cash received' },
              { accountId: revenueAccount.id, debit: 0, credit: booking.downPayment, description: 'Sales revenue' },
            ],
          },
        },
      });
      await tx.chartAccount.update({ where: { id: cashAccount.id }, data: { balance: { increment: booking.downPayment } } });
      await tx.chartAccount.update({ where: { id: revenueAccount.id }, data: { balance: { increment: booking.downPayment } } });
      await tx.payment.create({
        data: { bookingId, amount: booking.downPayment, method: 'CASH', reference: entry.entryNumber },
      });
    }

    await tx.notification.create({
      data: {
        userId,
        title: 'Booking Confirmed',
        message: `Booking ${booking.bookingNumber} for ${booking.customer.name} confirmed. Installments generated.`,
        type: 'BOOKING',
        link: '/dashboard/sales',
      },
    });

    return tx.booking.findUnique({
      where: { id: bookingId },
      include: { installments: true, unit: true, customer: true },
    });
  });
}

export async function approveExpense(expenseId: string, approverId: string) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({ where: { id: expenseId }, include: { project: true } });
    if (!expense) throw new Error('Expense not found');

    await tx.expense.update({
      where: { id: expenseId },
      data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date() },
    });

    if (expense.projectId) {
      await tx.project.update({
        where: { id: expense.projectId },
        data: { actualCost: { increment: expense.amount } },
      });
    }

    const expenseAccount = await tx.chartAccount.findFirst({ where: { code: '5000' } });
    const cashAccount = await tx.chartAccount.findFirst({ where: { code: '1000' } });
    if (expenseAccount && cashAccount) {
      await tx.journalEntry.create({
        data: {
          entryNumber: `JE-EXP-${Date.now()}`,
          description: expense.description,
          lines: {
            create: [
              { accountId: expenseAccount.id, debit: expense.amount, credit: 0 },
              { accountId: cashAccount.id, debit: 0, credit: expense.amount },
            ],
          },
        },
      });
      await tx.chartAccount.update({ where: { id: expenseAccount.id }, data: { balance: { increment: expense.amount } } });
      await tx.chartAccount.update({ where: { id: cashAccount.id }, data: { balance: { decrement: expense.amount } } });
    }

    return expense;
  });
}

export async function stockOut(itemId: string, quantity: number, projectId?: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Item not found');
    if (toNum(item.quantity) < quantity) throw new Error('Insufficient stock');

    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: { decrement: quantity } },
    });
    await tx.stockMovement.create({
      data: { inventoryItemId: itemId, type: 'OUT', quantity, projectId, notes },
    });

    const updated = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (updated && toNum(updated.quantity) <= toNum(updated.minStock)) {
      const admins = await tx.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'INVENTORY_MANAGER'] } } });
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: 'Low Stock Alert',
            message: `${item.name} is below minimum stock (${toNum(updated.quantity)} ${item.unit} remaining)`,
            type: 'LOW_STOCK',
            link: '/dashboard/inventory',
          },
        });
      }
    }
    return updated;
  });
}
