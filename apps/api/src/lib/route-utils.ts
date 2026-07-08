import type { RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function sendPrismaError(res: Response, error: unknown, fallback = 'Request failed'): Response {
  console.error(error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') || 'value';
      const message =
        target.toLowerCase().includes('code') ||
        target.toLowerCase().includes('landid') ||
        target.toLowerCase().includes('sku') ||
        target.toLowerCase().includes('employeecode')
          ? 'Code already exists.'
          : `Duplicate ${target} already exists.`;
      return res.status(409).json({ success: false, message, error: message });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found', error: 'Record not found' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ success: false, message: 'Related record not found', error: 'Related record not found' });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ success: false, message: 'Invalid data provided', error: 'Invalid data provided' });
  }

  return res.status(500).json({ success: false, message: fallback, error: fallback });
}

export function validationError(res: Response, message: string): Response {
  return res.status(400).json({ success: false, message, error: message });
}

export function normalizeCode(value: string): string {
  return value.trim().replace(/\s+/g, '-').toUpperCase();
}

export async function ensureUniqueCode(
  res: Response,
  findExisting: () => Promise<{ id: string; deletedAt?: Date | null } | null>,
  currentId?: string
): Promise<boolean> {
  const existing = await findExisting();
  if (existing && existing.id !== currentId && !existing.deletedAt) {
    res.status(409).json({ success: false, message: 'Code already exists.', error: 'Code already exists.' });
    return false;
  }
  return true;
}

export async function generateProjectCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PRJ-${year}-`;

  for (let attempt = 1; attempt <= 9999; attempt++) {
    const code = normalizeCode(`${prefix}${String(attempt).padStart(4, '0')}`);
    const existing = await prisma.project.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }

  return normalizeCode(`${prefix}${Date.now()}`);
}

export async function generateLandId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LAND-${year}-`;

  for (let attempt = 1; attempt <= 9999; attempt++) {
    const landId = normalizeCode(`${prefix}${String(attempt).padStart(4, '0')}`);
    const existing = await prisma.landParcel.findUnique({ where: { landId }, select: { id: true } });
    if (!existing) return landId;
  }

  return normalizeCode(`${prefix}${Date.now()}`);
}

export async function generateInventorySku(): Promise<string> {
  const prefix = `SKU-${Date.now().toString().slice(-6)}-`;

  for (let attempt = 1; attempt <= 999; attempt++) {
    const sku = normalizeCode(`${prefix}${String(attempt).padStart(3, '0')}`);
    const existing = await prisma.inventoryItem.findUnique({ where: { sku }, select: { id: true } });
    if (!existing) return sku;
  }

  return normalizeCode(`${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
}

export async function generateEmployeeCode(): Promise<string> {
  const prefix = `EMP-${new Date().getFullYear()}-`;

  for (let attempt = 1; attempt <= 9999; attempt++) {
    const employeeCode = normalizeCode(`${prefix}${String(attempt).padStart(4, '0')}`);
    const existing = await prisma.employee.findUnique({ where: { employeeCode }, select: { id: true } });
    if (!existing) return employeeCode;
  }

  return normalizeCode(`${prefix}${Date.now()}`);
}

export function releaseCodeValue(value: string): string {
  const base = normalizeCode(value).slice(0, 40);
  return normalizeCode(`${base}-DEL-${Date.now()}`).slice(0, 50);
}
