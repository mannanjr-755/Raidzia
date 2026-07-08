import { PrismaClient, AccountType, UserRole, InvoiceStatus, ExpenseStatus, TransactionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding LedgerPro database...');

  const passwordHash = await bcrypt.hash('rssbuilder123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'adminrssbuilder' },
    update: {},
    create: {
      username: 'adminrssbuilder',
      email: 'admin@ledgerpro.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.SUPER_ADMIN,
    },
  });

  const accountant = await prisma.user.upsert({
    where: { username: 'accountant' },
    update: {},
    create: {
      username: 'accountant',
      email: 'accountant@ledgerpro.com',
      passwordHash: await bcrypt.hash('Accountant@123', 12),
      firstName: 'Sarah',
      lastName: 'Accountant',
      role: UserRole.ACCOUNTANT,
    },
  });

  const accounts = await Promise.all([
    prisma.account.upsert({
      where: { code: '1000' },
      update: {},
      create: { code: '1000', name: 'Cash', type: AccountType.ASSET, balance: 50000, description: 'Cash on hand' },
    }),
    prisma.account.upsert({
      where: { code: '1100' },
      update: {},
      create: { code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET, balance: 25000 },
    }),
    prisma.account.upsert({
      where: { code: '2000' },
      update: {},
      create: { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY, balance: 15000 },
    }),
    prisma.account.upsert({
      where: { code: '3000' },
      update: {},
      create: { code: '3000', name: 'Owner Equity', type: AccountType.EQUITY, balance: 60000 },
    }),
    prisma.account.upsert({
      where: { code: '4000' },
      update: {},
      create: { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE, balance: 85000 },
    }),
    prisma.account.upsert({
      where: { code: '5000' },
      update: {},
      create: { code: '5000', name: 'Operating Expenses', type: AccountType.EXPENSE, balance: 35000 },
    }),
  ]);

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'seed-customer-1' },
      update: {},
      create: {
        id: 'seed-customer-1',
        name: 'Acme Corporation',
        email: 'billing@acme.com',
        phone: '+1-555-0101',
        address: '123 Business Ave, New York, NY',
        taxId: 'TAX-001',
        balance: 12500,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'seed-customer-2' },
      update: {},
      create: {
        id: 'seed-customer-2',
        name: 'Global Tech Ltd',
        email: 'accounts@globaltech.com',
        phone: '+1-555-0102',
        address: '456 Innovation Blvd, San Francisco, CA',
        balance: 8750,
      },
    }),
  ]);

  const vendors = await Promise.all([
    prisma.vendor.upsert({
      where: { id: 'seed-vendor-1' },
      update: {},
      create: {
        id: 'seed-vendor-1',
        name: 'Office Supplies Co',
        email: 'orders@officesupplies.com',
        phone: '+1-555-0201',
        balance: 3200,
      },
    }),
    prisma.vendor.upsert({
      where: { id: 'seed-vendor-2' },
      update: {},
      create: {
        id: 'seed-vendor-2',
        name: 'Cloud Services Inc',
        email: 'billing@cloudservices.com',
        balance: 5400,
      },
    }),
  ]);

  const invoice1 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-001' },
    update: {},
    create: {
      invoiceNumber: 'INV-2026-001',
      customerId: customers[0].id,
      status: InvoiceStatus.PAID,
      issueDate: new Date('2026-01-15'),
      dueDate: new Date('2026-02-15'),
      subtotal: 10000,
      taxRate: 10,
      taxAmount: 1000,
      total: 11000,
      items: {
        create: [
          { description: 'Consulting Services', quantity: 40, unitPrice: 200, amount: 8000 },
          { description: 'Software License', quantity: 1, unitPrice: 2000, amount: 2000 },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-002' },
    update: {},
    create: {
      invoiceNumber: 'INV-2026-002',
      customerId: customers[1].id,
      status: InvoiceStatus.SENT,
      issueDate: new Date('2026-02-01'),
      dueDate: new Date('2026-03-01'),
      subtotal: 5000,
      taxRate: 10,
      taxAmount: 500,
      total: 5500,
      items: {
        create: [{ description: 'Monthly Support', quantity: 1, unitPrice: 5000, amount: 5000 }],
      },
    },
  });

  await prisma.expense.createMany({
    skipDuplicates: true,
    data: [
      {
        description: 'Office Rent - January',
        amount: 3500,
        category: 'Rent',
        status: ExpenseStatus.PAID,
        expenseDate: new Date('2026-01-01'),
        vendorId: vendors[0].id,
        accountId: accounts[5].id,
      },
      {
        description: 'Cloud Hosting',
        amount: 299,
        category: 'Technology',
        status: ExpenseStatus.APPROVED,
        expenseDate: new Date('2026-02-01'),
        vendorId: vendors[1].id,
        accountId: accounts[5].id,
      },
    ],
  });

  await prisma.transaction.createMany({
    skipDuplicates: true,
    data: [
      {
        reference: 'TXN-2026-001',
        description: 'Customer payment received',
        type: TransactionType.CREDIT,
        amount: 11000,
        accountId: accounts[0].id,
        date: new Date('2026-01-20'),
      },
      {
        reference: 'TXN-2026-002',
        description: 'Office rent payment',
        type: TransactionType.DEBIT,
        amount: 3500,
        accountId: accounts[0].id,
        date: new Date('2026-01-05'),
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'Invoice Paid',
        message: `Invoice ${invoice1.invoiceNumber} has been marked as paid.`,
        type: 'SUCCESS',
        link: '/dashboard/invoices',
      },
      {
        userId: admin.id,
        title: 'Expense Pending Approval',
        message: 'Cloud Hosting expense is awaiting approval.',
        type: 'WARNING',
        link: '/dashboard/expenses',
      },
      {
        userId: accountant.id,
        title: 'Welcome to LedgerPro',
        message: 'Your accountant account has been set up.',
        type: 'INFO',
      },
    ],
  });

  console.log('Seed completed.');
  console.log('Login: adminrssbuilder / rssbuilder123');
  console.log('Login: accountant / Accountant@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
