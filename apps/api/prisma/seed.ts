import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Clears all sample / business data and ensures a single admin login remains.
 * Does not change schema — only deletes rows.
 */
async function clearBusinessData() {
  // Leaf tables first (respect FK order)
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.feasibilityCostItem.deleteMany();
  await prisma.feasibilityRevenueItem.deleteMany();
  await prisma.projectFeasibilityStudy.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.leadActivity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.dailyProgress.deleteMany();
  await prisma.projectTask.deleteMany();
  await prisma.projectMilestone.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.landDocument.deleteMany();
  await prisma.feasibilityStudy.deleteMany();
  await prisma.landParcel.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.chartAccount.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.refreshToken.deleteMany();
}

async function main() {
  console.log('Clearing RSS ERP sample data...');

  await clearBusinessData();

  // Remove demo users; recreate a single admin for login
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('Admin@123', 12);

  await prisma.user.create({
    data: {
      email: 'admin@rssbuilders.com',
      passwordHash: hash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.OWNER,
      emailVerified: true,
    },
  });

  console.log('Database cleared. Dashboard modules are empty.');
  console.log('Login: admin@rssbuilders.com / Admin@123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
