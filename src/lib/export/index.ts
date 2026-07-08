import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export async function generateExcel(
  title: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePdf(
  title: string,
  columns: string[],
  rows: string[][]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();

    const colWidth = (doc.page.width - 100) / columns.length;
    let y = doc.y;
    doc.font('Helvetica-Bold');
    columns.forEach((col, i) => doc.text(col, 50 + i * colWidth, y, { width: colWidth }));
    y += 20;
    doc.font('Helvetica');
    rows.forEach((row) => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }
      row.forEach((cell, i) => doc.text(String(cell), 50 + i * colWidth, y, { width: colWidth }));
      y += 18;
    });
    doc.end();
  });
}

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
