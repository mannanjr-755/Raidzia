import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse, createAuditLog } from '@/lib/api/helpers';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  const ctx = await requireAuth('customers:write');
  if (isNextResponse(ctx)) return ctx;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entity = (formData.get('entity') as string) || 'customers';

  if (!file) return apiError('No file uploaded');

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(arrayBuffer) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return apiError('Invalid Excel file: no worksheet found');

  const rows: Record<string, string>[] = [];
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value || '').toLowerCase().trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    row.eachCell((cell, col) => {
      if (headers[col]) record[headers[col]] = String(cell.value ?? '').trim();
    });
    if (Object.values(record).some(Boolean)) rows.push(record);
  });

  if (!rows.length) return apiError('No data rows found in file');

  let imported = 0;
  const errors: string[] = [];

  if (entity === 'customers') {
    for (const row of rows) {
      try {
        if (!row.name) { errors.push(`Row missing name`); continue; }
        await prisma.customer.create({
          data: {
            name: row.name,
            email: row.email || null,
            phone: row.phone || null,
            address: row.address || null,
            balance: parseFloat(row.balance || '0') || 0,
          },
        });
        imported++;
      } catch (err) {
        errors.push(`Failed: ${row.name} - ${err instanceof Error ? err.message : 'import error'}`);
      }
    }
  } else if (entity === 'vendors') {
    for (const row of rows) {
      try {
        if (!row.name) continue;
        await prisma.vendor.create({
          data: { name: row.name, email: row.email || null, phone: row.phone || null, balance: parseFloat(row.balance || '0') || 0 },
        });
        imported++;
      } catch (err) {
        errors.push(`Failed: ${row.name} - ${err instanceof Error ? err.message : 'import error'}`);
      }
    }
  } else {
    return apiError('Unsupported import entity');
  }

  await createAuditLog(ctx.userId, 'IMPORT', entity, undefined, { imported, errors: errors.length });

  return apiSuccess({ imported, errors, total: rows.length });
}
