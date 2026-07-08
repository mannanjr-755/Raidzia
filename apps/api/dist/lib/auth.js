"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.requirePermission = requirePermission;
exports.toNum = toNum;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const shared_1 = require("@rss/shared");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_REFRESH_SECRET);
}
function requirePermission(role, permission) {
    if (!(0, shared_1.hasPermission)(role, permission)) {
        throw new Error('Forbidden');
    }
}
function toNum(v) {
    if (v === null || v === undefined)
        return 0;
    return Number(v);
}
