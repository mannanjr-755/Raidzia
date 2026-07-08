"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
exports.sendPrismaError = sendPrismaError;
exports.validationError = validationError;
const client_1 = require("@prisma/client");
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
            const message = `Duplicate ${target} already exists`;
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
