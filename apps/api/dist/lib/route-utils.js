"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
exports.sendPrismaError = sendPrismaError;
exports.validationError = validationError;
exports.normalizeCode = normalizeCode;
exports.ensureUniqueCode = ensureUniqueCode;
exports.generateProjectCode = generateProjectCode;
exports.generateLandId = generateLandId;
exports.generateInventorySku = generateInventorySku;
exports.generateEmployeeCode = generateEmployeeCode;
exports.releaseCodeValue = releaseCodeValue;
const client_1 = require("@prisma/client");
const prisma_1 = require("./prisma");
function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
function sendPrismaError(res, error, fallback = 'Request failed') {
    console.error(error);
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            const target = error.meta?.target?.join(', ') || 'value';
            const message = target.toLowerCase().includes('code') ||
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
    if (error instanceof client_1.Prisma.PrismaClientValidationError) {
        return res.status(400).json({ success: false, message: 'Invalid data provided', error: 'Invalid data provided' });
    }
    return res.status(500).json({ success: false, message: fallback, error: fallback });
}
function validationError(res, message) {
    return res.status(400).json({ success: false, message, error: message });
}
function normalizeCode(value) {
    return value.trim().replace(/\s+/g, '-').toUpperCase();
}
async function ensureUniqueCode(res, findExisting, currentId) {
    const existing = await findExisting();
    if (existing && existing.id !== currentId && !existing.deletedAt) {
        res.status(409).json({ success: false, message: 'Code already exists.', error: 'Code already exists.' });
        return false;
    }
    return true;
}
async function generateProjectCode() {
    const year = new Date().getFullYear();
    const prefix = `PRJ-${year}-`;
    for (let attempt = 1; attempt <= 9999; attempt++) {
        const code = normalizeCode(`${prefix}${String(attempt).padStart(4, '0')}`);
        const existing = await prisma_1.prisma.project.findUnique({ where: { code }, select: { id: true } });
        if (!existing)
            return code;
    }
    return normalizeCode(`${prefix}${Date.now()}`);
}
async function generateLandId() {
    const year = new Date().getFullYear();
    const prefix = `LAND-${year}-`;
    for (let attempt = 1; attempt <= 9999; attempt++) {
        const landId = normalizeCode(`${prefix}${String(attempt).padStart(4, '0')}`);
        const existing = await prisma_1.prisma.landParcel.findUnique({ where: { landId }, select: { id: true } });
        if (!existing)
            return landId;
    }
    return normalizeCode(`${prefix}${Date.now()}`);
}
async function generateInventorySku() {
    const prefix = `SKU-${Date.now().toString().slice(-6)}-`;
    for (let attempt = 1; attempt <= 999; attempt++) {
        const sku = normalizeCode(`${prefix}${String(attempt).padStart(3, '0')}`);
        const existing = await prisma_1.prisma.inventoryItem.findUnique({ where: { sku }, select: { id: true } });
        if (!existing)
            return sku;
    }
    return normalizeCode(`${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
}
async function generateEmployeeCode() {
    const prefix = `EMP-${new Date().getFullYear()}-`;
    for (let attempt = 1; attempt <= 9999; attempt++) {
        const employeeCode = normalizeCode(`${prefix}${String(attempt).padStart(4, '0')}`);
        const existing = await prisma_1.prisma.employee.findUnique({ where: { employeeCode }, select: { id: true } });
        if (!existing)
            return employeeCode;
    }
    return normalizeCode(`${prefix}${Date.now()}`);
}
function releaseCodeValue(value) {
    const base = normalizeCode(value).slice(0, 40);
    return normalizeCode(`${base}-DEL-${Date.now()}`).slice(0, 50);
}
