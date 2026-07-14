import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPagination, paginated } from '../lib/pagination';
import {
  ensureUniqueCode,
  generateEmployeeCode,
  normalizeCode,
  releaseCodeValue,
  sendPrismaError,
  validationError,
} from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : String(value || ''));

const employeeSchema = z.object({
  employeeCode: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  phone: z.string().min(1, 'Phone is required'),
  department: z.string().optional(),
  designation: z.string().optional(),
  salary: z.coerce.number().min(0).default(0),
  joinDate: z.string().optional(),
});

router.get('/', authenticate, authorize('hr:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const department = String(req.query.department || '');

  const where = {
    deletedAt: null,
    ...(department ? { department: { equals: department, mode: 'insensitive' as const } } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { employeeCode: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { department: { contains: search, mode: 'insensitive' as const } },
            { designation: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/', authenticate, authorize('hr:write'), async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid employee data');

  const employeeCode = parsed.data.employeeCode?.trim()
    ? normalizeCode(parsed.data.employeeCode)
    : await generateEmployeeCode();

  const unique = await ensureUniqueCode(res, () =>
    prisma.employee.findUnique({ where: { employeeCode }, select: { id: true, deletedAt: true } })
  );
  if (!unique) return;

  try {
    const employee = await prisma.employee.create({
      data: {
        ...parsed.data,
        employeeCode,
        joinDate: parsed.data.joinDate ? new Date(parsed.data.joinDate) : new Date(),
      },
    });
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create employee');
  }
});

router.put('/:id', authenticate, authorize('hr:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = employeeSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid employee data');

  const employeeCode = parsed.data.employeeCode?.trim()
    ? normalizeCode(parsed.data.employeeCode)
    : undefined;

  if (employeeCode) {
    const unique = await ensureUniqueCode(
      res,
      () => prisma.employee.findUnique({ where: { employeeCode }, select: { id: true, deletedAt: true } }),
      id
    );
    if (!unique) return;
  }

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(employeeCode ? { employeeCode } : {}),
        ...(parsed.data.joinDate ? { joinDate: new Date(parsed.data.joinDate) } : {}),
      },
    });
    res.json({ success: true, data: employee });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update employee');
  }
});

router.delete('/:id', authenticate, authorize('hr:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const employee = await prisma.employee.findUnique({ where: { id }, select: { employeeCode: true } });
    if (!employee) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, employeeCode: releaseCodeValue(employee.employeeCode) },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete employee');
  }
});

export default router;
