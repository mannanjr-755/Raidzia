import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').transform((v) => v.trim()).refine((v) => v.length > 0, 'Username cannot be empty'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[0-9]/, 'Include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Include at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  });

export const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required'),
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  description: z.string().optional(),
  balance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
  parentId: z.string().optional().nullable(),
});

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  balance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

export const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  balance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).default('DRAFT'),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

export const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']).default('PENDING'),
  expenseDate: z.string().min(1),
  vendorId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
});

export const transactionSchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['DEBIT', 'CREDIT']),
  amount: z.coerce.number().positive('Amount must be positive'),
  date: z.string().min(1),
  accountId: z.string().min(1, 'Account is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type AccountFormValues = z.infer<typeof accountSchema>;
export type CustomerFormValues = z.infer<typeof customerSchema>;
export type VendorFormValues = z.infer<typeof vendorSchema>;
export type InvoiceFormValues = z.infer<typeof invoiceSchema>;
export type ExpenseFormValues = z.infer<typeof expenseSchema>;
export type TransactionFormValues = z.infer<typeof transactionSchema>;
