'use client';

import { useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/stat-card';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type UnitType = 'flat' | 'shop' | 'office' | 'custom';

interface UnitRow {
  id: string;
  particular: string;
  bookingPrice: number;
  unitType: UnitType;
}

interface RowCalculations {
  discount10: number;
  depreciation15: number;
  depreciation20: number;
  difference10: number;
  difference15: number;
  difference20: number;
  profit: number;
}

interface SharedCosts {
  totalBooking: number;
  brokerage: number;
  plotPayment: number;
  costOfConstruction: number;
}

interface SummaryTotals {
  totalBooking: number;
  totalDiscount10: number;
  totalDepreciation15: number;
  totalDepreciation20: number;
  totalDifference10: number;
  totalDifference15: number;
  totalDifference20: number;
  brokerage: number;
  totalProfit: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers — business logic separated from UI                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_BROKERAGE_PERCENT = 2;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `unit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function parseMoney(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  return sanitizeNumber(Number(cleaned));
}

function parsePercent(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  return sanitizeNumber(Number(cleaned));
}

function detectUnitType(particular: string): UnitType {
  const value = particular.trim().toUpperCase();
  if (value.startsWith('SHOP')) return 'shop';
  if (value.startsWith('OFFICE')) return 'office';
  if (/^\d+$/.test(value)) return 'flat';
  return 'custom';
}

function createDefaultRows(): UnitRow[] {
  return [];
}

/** 10% Discount = Booking Price − 10% */
function calcDiscount10(bookingPrice: number): number {
  return bookingPrice - bookingPrice * 0.1;
}

/** 15% Depreciation = Booking Price − 15% */
function calcDepreciation15(bookingPrice: number): number {
  return bookingPrice - bookingPrice * 0.15;
}

/** 20% Depreciation = Booking Price − 20% */
function calcDepreciation20(bookingPrice: number): number {
  return bookingPrice - bookingPrice * 0.2;
}

/** 10% Difference = Booking Price − Discount Price */
function calcDifference10(bookingPrice: number): number {
  return bookingPrice - calcDiscount10(bookingPrice);
}

/** 15% Difference = Booking Price − 15% Depreciation */
function calcDifference15(bookingPrice: number): number {
  return bookingPrice - calcDepreciation15(bookingPrice);
}

/** 20% Difference = Booking Price − 20% Depreciation */
function calcDifference20(bookingPrice: number): number {
  return bookingPrice - calcDepreciation20(bookingPrice);
}

/**
 * Profit per unit:
 * 20% Difference − allocated Brokerage − allocated Plot Payment − allocated Cost of Construction
 * Shared costs are allocated by booking-price share so Total Profit = sum of row profits.
 */
function calcRowProfit(bookingPrice: number, shared: SharedCosts): number {
  const difference20 = calcDifference20(bookingPrice);
  if (shared.totalBooking <= 0) return difference20;
  const share = bookingPrice / shared.totalBooking;
  return (
    difference20 -
    share * shared.brokerage -
    share * shared.plotPayment -
    share * shared.costOfConstruction
  );
}

function calculateRow(bookingPrice: number, shared: SharedCosts): RowCalculations {
  const safe = sanitizeNumber(bookingPrice);
  return {
    discount10: calcDiscount10(safe),
    depreciation15: calcDepreciation15(safe),
    depreciation20: calcDepreciation20(safe),
    difference10: calcDifference10(safe),
    difference15: calcDifference15(safe),
    difference20: calcDifference20(safe),
    profit: calcRowProfit(safe, shared),
  };
}

function calculateSummaryTotals(
  rows: UnitRow[],
  brokeragePercent: number,
  plotPayment: number,
  costOfConstruction: number
): SummaryTotals {
  const base = rows.reduce(
    (acc, row) => {
      const price = sanitizeNumber(row.bookingPrice);
      acc.totalBooking += price;
      acc.totalDiscount10 += calcDiscount10(price);
      acc.totalDepreciation15 += calcDepreciation15(price);
      acc.totalDepreciation20 += calcDepreciation20(price);
      acc.totalDifference10 += calcDifference10(price);
      acc.totalDifference15 += calcDifference15(price);
      acc.totalDifference20 += calcDifference20(price);
      return acc;
    },
    {
      totalBooking: 0,
      totalDiscount10: 0,
      totalDepreciation15: 0,
      totalDepreciation20: 0,
      totalDifference10: 0,
      totalDifference15: 0,
      totalDifference20: 0,
    }
  );

  const brokerage = base.totalBooking * (sanitizeNumber(brokeragePercent) / 100);
  const shared: SharedCosts = {
    totalBooking: base.totalBooking,
    brokerage,
    plotPayment: sanitizeNumber(plotPayment),
    costOfConstruction: sanitizeNumber(costOfConstruction),
  };

  const totalProfit = rows.reduce(
    (sum, row) => sum + calcRowProfit(sanitizeNumber(row.bookingPrice), shared),
    0
  );

  return { ...base, brokerage, totalProfit };
}

function suggestUnitNumber(rows: UnitRow[], type: UnitType): string {
  if (type === 'flat') {
    const numeric = rows
      .map((row) => Number(row.particular.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return numeric.length ? String(Math.max(...numeric) + 1) : '101';
  }

  const prefix = type === 'shop' ? 'SHOP' : type === 'office' ? 'OFFICE' : 'UNIT';
  const pattern = new RegExp(`^${prefix}\\s*(\\d+)$`, 'i');
  let max = 0;
  rows.forEach((row) => {
    const match = row.particular.trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `${prefix} ${max + 1}`;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ProjectFeasibilityPage() {
  const [rows, setRows] = useState<UnitRow[]>(() => createDefaultRows());
  const [brokeragePercent, setBrokeragePercent] = useState(DEFAULT_BROKERAGE_PERCENT);
  const [plotPayment, setPlotPayment] = useState(0);
  const [costOfConstruction, setCostOfConstruction] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<UnitType>('flat');
  const [addUnitNumber, setAddUnitNumber] = useState('');
  const [addBookingPrice, setAddBookingPrice] = useState('');
  const [addError, setAddError] = useState('');

  const [editRow, setEditRow] = useState<UnitRow | null>(null);
  const [editUnitNumber, setEditUnitNumber] = useState('');
  const [editBookingPrice, setEditBookingPrice] = useState('');
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<UnitRow | null>(null);

  const summary = useMemo(
    () => calculateSummaryTotals(rows, brokeragePercent, plotPayment, costOfConstruction),
    [rows, brokeragePercent, plotPayment, costOfConstruction]
  );

  const sharedCosts: SharedCosts = useMemo(
    () => ({
      totalBooking: summary.totalBooking,
      brokerage: summary.brokerage,
      plotPayment: sanitizeNumber(plotPayment),
      costOfConstruction: sanitizeNumber(costOfConstruction),
    }),
    [summary.totalBooking, summary.brokerage, plotPayment, costOfConstruction]
  );

  const isDuplicateUnit = useCallback(
    (unitNumber: string, excludeId?: string) => {
      const normalized = unitNumber.trim().toLowerCase();
      return rows.some(
        (row) => row.id !== excludeId && row.particular.trim().toLowerCase() === normalized
      );
    },
    [rows]
  );

  const updateBookingPrice = useCallback((id: string, raw: string) => {
    const bookingPrice = parseMoney(raw);
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, bookingPrice } : row)));
  }, []);

  const openAddModal = () => {
    const nextType: UnitType = 'flat';
    setAddType(nextType);
    setAddUnitNumber(suggestUnitNumber(rows, nextType));
    setAddBookingPrice('');
    setAddError('');
    setAddOpen(true);
  };

  const handleAddTypeChange = (type: UnitType) => {
    setAddType(type);
    setAddUnitNumber(suggestUnitNumber(rows, type));
    setAddError('');
  };

  const handleAddUnit = () => {
    const unitNumber = addUnitNumber.trim();
    if (!unitNumber) {
      setAddError('Unit Number is required.');
      return;
    }
    if (isDuplicateUnit(unitNumber)) {
      setAddError('This unit number already exists. Please use a unique value.');
      return;
    }

    const bookingPrice = parseMoney(addBookingPrice);
    setRows((prev) => [
      ...prev,
      {
        id: createId(),
        particular: unitNumber,
        bookingPrice,
        unitType: addType,
      },
    ]);
    setAddOpen(false);
    toast.success(`Added ${unitNumber}`);
  };

  const openEdit = (row: UnitRow) => {
    setEditRow(row);
    setEditUnitNumber(row.particular);
    setEditBookingPrice(row.bookingPrice ? String(row.bookingPrice) : '');
    setEditError('');
  };

  const handleSaveEdit = () => {
    if (!editRow) return;
    const unitNumber = editUnitNumber.trim();
    if (!unitNumber) {
      setEditError('Unit Number is required.');
      return;
    }
    if (isDuplicateUnit(unitNumber, editRow.id)) {
      setEditError('This unit number already exists. Please use a unique value.');
      return;
    }

    const bookingPrice = parseMoney(editBookingPrice);
    setRows((prev) =>
      prev.map((row) =>
        row.id === editRow.id
          ? {
              ...row,
              particular: unitNumber,
              bookingPrice,
              unitType: detectUnitType(unitNumber),
            }
          : row
      )
    );
    setEditRow(null);
    toast.success('Unit updated');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id));
    toast.success(`Deleted ${deleteTarget.particular}`);
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="Price Feasibility"
        description="Excel-style unit pricing with automatic discounts, depreciation, brokerage, and profit."
        action={
          <button type="button" className="btn-gold" onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Add Unit
          </button>
        }
      />

      <div className="rounded-xl border border-luxury-border bg-white shadow-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#f3efe6] shadow-sm">
              <tr className="border-b border-luxury-border text-left text-[11px] font-semibold uppercase tracking-wide text-luxury-slate">
                <th className="px-3 py-3 whitespace-nowrap">Particular</th>
                <th className="px-3 py-3 whitespace-nowrap">Booking Price</th>
                <th className="px-3 py-3 whitespace-nowrap">10% Discount</th>
                <th className="px-3 py-3 whitespace-nowrap">15% Depreciation</th>
                <th className="px-3 py-3 whitespace-nowrap">20% Depreciation</th>
                <th className="px-3 py-3 whitespace-nowrap">10% Difference Amount</th>
                <th className="px-3 py-3 whitespace-nowrap">15% Difference Amount</th>
                <th className="px-3 py-3 whitespace-nowrap">20% Difference Amount</th>
                <th className="px-3 py-3 whitespace-nowrap">Profit</th>
                <th className="px-3 py-3 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => {
                const calc = calculateRow(row.bookingPrice, sharedCosts);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-luxury-border/60',
                      index % 2 === 0 ? 'bg-white' : 'bg-[#faf8f4]',
                      'hover:bg-gold-50/40'
                    )}
                  >
                    <td className="px-3 py-2 font-medium text-luxury-charcoal">{row.particular}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="luxury-input py-1.5 text-sm text-right min-w-[120px]"
                        value={row.bookingPrice ? formatNumber(row.bookingPrice) : ''}
                        placeholder="0"
                        onChange={(e) => updateBookingPrice(row.id, e.target.value)}
                        aria-label={`Booking price for ${row.particular}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(calc.discount10)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(calc.depreciation15)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(calc.depreciation20)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(calc.difference10)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(calc.difference15)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(calc.difference20)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-semibold',
                        calc.profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                      )}
                    >
                      {formatCurrency(calc.profit)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-luxury-slate hover:bg-luxury-cream hover:text-gold"
                          title="Edit"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                          title="Delete"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-luxury-slate">
                    No Records Found
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-luxury-border bg-[#efe8d8] font-semibold">
                <td className="px-3 py-3 text-luxury-charcoal">TOTAL</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalBooking)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalDiscount10)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalDepreciation15)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalDepreciation20)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalDifference10)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalDifference15)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.totalDifference20)}
                </td>
                <td
                  className={cn(
                    'px-3 py-3 text-right tabular-nums',
                    summary.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                  )}
                >
                  {formatCurrency(summary.totalProfit)}
                </td>
                <td />
              </tr>

              <tr className="border-t border-luxury-border bg-[#f7f2e8]">
                <td className="px-3 py-3 text-luxury-charcoal">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">BROKERAGE %</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="luxury-input py-1 px-2 text-sm text-right w-20"
                      value={brokeragePercent === 0 ? '' : String(brokeragePercent)}
                      placeholder="2"
                      onChange={(e) => setBrokeragePercent(parsePercent(e.target.value))}
                      aria-label="Brokerage percentage"
                    />
                    <span className="text-sm text-luxury-slate">%</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-gold-700" colSpan={2}>
                  {formatCurrency(summary.brokerage)}
                </td>
                <td colSpan={7} />
              </tr>

              <tr className="border-t border-luxury-border bg-[#f7f2e8]">
                <td className="px-3 py-3 font-medium text-luxury-charcoal">PLOT PAYMENT</td>
                <td className="px-3 py-3" colSpan={2}>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="luxury-input py-1.5 text-sm text-right"
                    value={plotPayment ? formatNumber(plotPayment) : ''}
                    placeholder="0"
                    onChange={(e) => setPlotPayment(parseMoney(e.target.value))}
                    aria-label="Plot payment"
                  />
                </td>
                <td colSpan={7} />
              </tr>

              <tr className="border-t border-luxury-border bg-[#f7f2e8]">
                <td className="px-3 py-3 font-medium text-luxury-charcoal">COST OF CONSTRUCTION</td>
                <td className="px-3 py-3" colSpan={2}>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="luxury-input py-1.5 text-sm text-right"
                    value={costOfConstruction ? formatNumber(costOfConstruction) : ''}
                    placeholder="0"
                    onChange={(e) => setCostOfConstruction(parseMoney(e.target.value))}
                    aria-label="Cost of construction"
                  />
                </td>
                <td colSpan={7} />
              </tr>

              <tr className="border-t-2 border-gold/40 bg-[#e8f5ee]">
                <td className="px-3 py-3 font-bold text-luxury-charcoal" colSpan={8}>
                  TOTAL PROFIT
                </td>
                <td
                  className={cn(
                    'px-3 py-3 text-right tabular-nums font-bold',
                    summary.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                  )}
                >
                  {formatCurrency(summary.totalProfit)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add Unit */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Unit">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-luxury-charcoal">Unit Type</label>
            <select
              className="luxury-input"
              value={addType}
              onChange={(e) => handleAddTypeChange(e.target.value as UnitType)}
            >
              <option value="flat">Flat</option>
              <option value="shop">Shop</option>
              <option value="office">Office</option>
              <option value="custom">Custom Unit</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-luxury-charcoal">
              Unit Number
            </label>
            <input
              type="text"
              className="luxury-input"
              value={addUnitNumber}
              onChange={(e) => {
                setAddUnitNumber(e.target.value);
                setAddError('');
              }}
              placeholder="e.g. 701 or SHOP 5"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-luxury-charcoal">
              Booking Price
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="luxury-input"
              value={addBookingPrice}
              onChange={(e) => setAddBookingPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
            />
          </div>
          {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-gold" onClick={handleAddUnit}>
              Add Unit
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Unit */}
      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title={editRow ? `Edit ${editRow.particular}` : 'Edit Unit'}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-luxury-charcoal">
              Unit Number
            </label>
            <input
              type="text"
              className="luxury-input"
              value={editUnitNumber}
              onChange={(e) => {
                setEditUnitNumber(e.target.value);
                setEditError('');
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-luxury-charcoal">
              Booking Price
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="luxury-input"
              value={editBookingPrice}
              onChange={(e) => setEditBookingPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
            />
          </div>
          {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setEditRow(null)}>
              Cancel
            </button>
            <button type="button" className="btn-gold" onClick={handleSaveEdit}>
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Unit"
        message="Are you sure you want to delete this unit?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
