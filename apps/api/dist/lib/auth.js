"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertJwtSecretsConfigured = assertJwtSecretsConfigured;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.requirePermission = requirePermission;
exports.toNum = toNum;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const shared_1 = require("@rss/shared");
const WEAK_SECRETS = new Set(['', 'secret', 'changeme', 'change-me', 'jwt_secret', 'jwt-secret']);
/** Fail fast when JWT secrets are missing or obviously insecure. Call from API boot. */
function assertJwtSecretsConfigured() {
    const access = process.env.JWT_SECRET?.trim() || '';
    const refresh = process.env.JWT_REFRESH_SECRET?.trim() || '';
    if (!access || WEAK_SECRETS.has(access.toLowerCase())) {
        throw new Error('JWT_SECRET is missing or insecure. Set a strong secret in the environment.');
    }
    if (!refresh || WEAK_SECRETS.has(refresh.toLowerCase())) {
        throw new Error('JWT_REFRESH_SECRET is missing or insecure. Set a strong secret in the environment.');
    }
    if (access === refresh) {
        throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
    }
}
function accessSecret() {
    return process.env.JWT_SECRET;
}
function refreshSecret() {
    return process.env.JWT_REFRESH_SECRET;
}
function signAccessToken(payload) {
    const options = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') };
    return jsonwebtoken_1.default.sign(payload, accessSecret(), options);
}
function signRefreshToken(payload) {
    const options = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') };
    return jsonwebtoken_1.default.sign(payload, refreshSecret(), options);
}
function verifyAccessToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, accessSecret());
    return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
    };
}
function verifyRefreshToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, refreshSecret());
    return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
    };
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
