import { PrismaClient, UserRole, ProjectStatus, LandStatus, LandType, UnitStatus, UnitType, LeadStatus, ExpenseCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding RSS ERP...');

  const hash = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@rssbuilders.com' },
    update: {},
    create: {
      email: 'admin@rssbuilders.com',
      passwordHash: hash,
      firstName: 'Rehan',
      lastName: 'Shahid',
      role: UserRole.OWNER,
      phone: '+92-300-1234567',
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'pm@rssbuilders.com' },
    update: {},
    create: {
      email: 'pm@rssbuilders.com',
      passwordHash: await bcrypt.hash('PM@123456', 12),
      firstName: 'Ahmed',
      lastName: 'Khan',
      role: UserRole.PROJECT_MANAGER,
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'sales@rssbuilders.com' },
    update: {},
    create: {
      email: 'sales@rssbuilders.com',
      passwordHash: await bcrypt.hash('Sales@123', 12),
      firstName: 'Sara',
      lastName: 'Malik',
      role: UserRole.SALES,
      emailVerified: true,
    },
  });

  const accounts = await Promise.all([
    prisma.chartAccount.upsert({ where: { code: '1000' }, update: {}, create: { code: '1000', name: 'Cash & Bank', type: 'ASSET', balance: 15000000 } }),
    prisma.chartAccount.upsert({ where: { code: '1100' }, update: {}, create: { code: '1100', name: 'Accounts Receivable', type: 'ASSET', balance: 8500000 } }),
    prisma.chartAccount.upsert({ where: { code: '2000' }, update: {}, create: { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', balance: 3200000 } }),
    prisma.chartAccount.upsert({ where: { code: '3000' }, update: {}, create: { code: '3000', name: 'Owner Equity', type: 'EQUITY', balance: 20000000 } }),
    prisma.chartAccount.upsert({ where: { code: '4000' }, update: {}, create: { code: '4000', name: 'Sales Revenue', type: 'REVENUE', balance: 45000000 } }),
    prisma.chartAccount.upsert({ where: { code: '5000' }, update: {}, create: { code: '5000', name: 'Construction Expenses', type: 'EXPENSE', balance: 28000000 } }),
  ]);

  const land1 = await prisma.landParcel.upsert({
    where: { landId: 'LAND-001' },
    update: {},
    create: {
      landId: 'LAND-001',
      title: 'DHA Phase 6 Plot',
      location: 'DHA Phase 6, Lahore',
      latitude: 31.4697,
      longitude: 74.4087,
      areaSqYards: 500,
      areaSqFeet: 4500,
      landType: LandType.RESIDENTIAL,
      status: LandStatus.NEGOTIATION,
      purchasePrice: 45000000,
      marketPrice: 52000000,
      roadWidth: 60,
      isCornerPlot: true,
      hasElectricity: true,
      hasGas: true,
      hasWater: true,
      ownerName: 'Mr. Hassan Ali',
      ownerPhone: '+92-321-5551234',
      brokerName: 'Prime Realty',
    },
  });

  const land2 = await prisma.landParcel.upsert({
    where: { landId: 'LAND-002' },
    update: {},
    create: {
      landId: 'LAND-002',
      title: 'Gulberg Commercial Plaza Site',
      location: 'MM Alam Road, Gulberg III, Lahore',
      areaSqYards: 800,
      areaSqFeet: 7200,
      landType: LandType.COMMERCIAL,
      status: LandStatus.DUE_DILIGENCE,
      purchasePrice: 120000000,
      marketPrice: 145000000,
      hasElectricity: true,
      hasWater: true,
    },
  });

  const project = await prisma.project.upsert({
    where: { code: 'RSS-001' },
    update: {},
    create: {
      code: 'RSS-001',
      name: 'RSS Heights',
      description: 'Premium residential tower with commercial podium',
      location: 'DHA Phase 6, Lahore',
      city: 'Lahore',
      clientName: 'RSS Internal Development',
      status: ProjectStatus.ACTIVE,
      budget: 850000000,
      estimatedCost: 780000000,
      actualCost: 245000000,
      completionPct: 35,
      startDate: new Date('2025-06-01'),
      endDate: new Date('2027-12-31'),
      managerId: admin.id,
      landParcelId: land1.id,
    },
  });

  const building = await prisma.building.create({
    data: { projectId: project.id, name: 'Tower A', tower: 'A', totalFloors: 10 },
  });

  const floors = [];
  for (let i = 1; i <= 10; i++) {
    floors.push(await prisma.floor.create({ data: { buildingId: building.id, number: i, name: `Floor ${i}` } }));
  }

  const units = [];
  for (const floor of floors) {
    for (let u = 1; u <= 4; u++) {
      units.push(await prisma.unit.create({
        data: {
          floorId: floor.id,
          unitNumber: `${floor.number}0${u}`,
          unitType: floor.number === 1 ? UnitType.SHOP : UnitType.APARTMENT,
          area: floor.number === 1 ? 800 : 1200 + u * 100,
          price: floor.number === 1 ? 25000000 : 15000000 + u * 500000,
          status: u === 1 && floor.number > 1 ? UnitStatus.SOLD : u === 2 && floor.number > 1 ? UnitStatus.BOOKED : UnitStatus.AVAILABLE,
          bedrooms: floor.number === 1 ? null : 2 + (u % 2),
          bathrooms: floor.number === 1 ? null : 2,
        },
      }));
    }
  }

  const customer = await prisma.customer.create({
    data: { name: 'Ali Raza', email: 'ali.raza@email.com', phone: '+92-333-9876543', city: 'Lahore', source: 'Walk-in' },
  });

  await prisma.lead.create({
    data: { name: 'Fatima Khan', phone: '+92-345-1112233', email: 'fatima@email.com', source: 'Facebook', status: LeadStatus.QUALIFIED, budget: 18000000, assigneeId: admin.id },
  });

  const soldUnit = units.find((u) => u.status === UnitStatus.SOLD)!;
  const booking = await prisma.booking.create({
    data: {
      bookingNumber: 'BK-2026-0001',
      customerId: customer.id,
      unitId: soldUnit.id,
      salesAgentId: admin.id,
      status: 'CONFIRMED',
      totalAmount: soldUnit.price,
      downPayment: Number(soldUnit.price) * 0.2,
      bookingDate: new Date('2026-01-15'),
    },
  });

  for (let i = 1; i <= 12; i++) {
    const due = new Date('2026-02-01');
    due.setMonth(due.getMonth() + i - 1);
    await prisma.installment.create({
      data: {
        bookingId: booking.id, number: i,
        amount: (Number(soldUnit.price) * 0.8) / 12,
        dueDate: due,
        status: i <= 2 ? 'PAID' : 'PENDING',
        paidAmount: i <= 2 ? (Number(soldUnit.price) * 0.8) / 12 : 0,
      },
    });
  }

  await prisma.payment.create({
    data: { bookingId: booking.id, amount: Number(soldUnit.price) * 0.2, method: 'BANK_TRANSFER', reference: 'PAY-001' },
  });

  await prisma.expense.createMany({
    data: [
      { projectId: project.id, description: 'Cement Supply - Phase 1', amount: 2500000, category: ExpenseCategory.MATERIAL, status: 'APPROVED', creatorId: admin.id },
      { projectId: project.id, description: 'Labour Wages - January', amount: 1800000, category: ExpenseCategory.LABOUR, status: 'APPROVED', creatorId: admin.id },
      { description: 'Office Utilities', amount: 85000, category: ExpenseCategory.UTILITIES, status: 'PAID', creatorId: admin.id },
    ],
  });

  await prisma.inventoryItem.createMany({
    data: [
      { sku: 'CEM-001', name: 'Portland Cement', category: 'Cement', unit: 'bag', quantity: 5000, minStock: 500, unitCost: 1200 },
      { sku: 'STL-001', name: 'Steel Bars 60 Grade', category: 'Steel', unit: 'ton', quantity: 120, minStock: 20, unitCost: 280000 },
      { sku: 'BRK-001', name: 'Red Bricks', category: 'Bricks', unit: '1000 pcs', quantity: 50, minStock: 10, unitCost: 15000 },
    ],
  });

  await prisma.employee.createMany({
    data: [
      { employeeCode: 'EMP-001', firstName: 'Muhammad', lastName: 'Aslam', phone: '+92-300-1111111', department: 'Construction', designation: 'Site Supervisor', salary: 85000 },
      { employeeCode: 'EMP-002', firstName: 'Imran', lastName: 'Hussain', phone: '+92-300-2222222', department: 'Sales', designation: 'Sales Executive', salary: 65000 },
    ],
  });

  await prisma.machinery.createMany({
    data: [
      { name: 'Tower Crane TC-5013', type: 'Crane', status: 'OPERATIONAL', operatorName: 'Khalid Mehmood' },
      { name: 'Concrete Mixer CM-400', type: 'Mixer', status: 'OPERATIONAL' },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: admin.id, title: 'Project Milestone Due', message: 'RSS Heights foundation phase review due this week.', type: 'INFO', link: '/dashboard/projects' },
      { userId: admin.id, title: 'Installment Due', message: 'Booking BK-2026-0001 installment #3 due soon.', type: 'INSTALLMENT_DUE', link: '/dashboard/sales' },
    ],
  });

  console.log('Seed complete!');
  console.log('Login: admin@rssbuilders.com / Admin@123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
