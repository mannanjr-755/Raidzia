"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const auth_1 = require("../lib/auth");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: 'Unauthorized' });
        return;
    }
    try {
        req.user = (0, auth_1.verifyAccessToken)(header.slice(7));
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token', error: 'Invalid or expired token' });
    }
}
function authorize(...permissions) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized', error: 'Unauthorized' });
            return;
        }
        const { hasPermission } = require('@rss/shared');
        const allowed = permissions.some((p) => hasPermission(req.user.role, p));
        if (!allowed) {
            res.status(403).json({ success: false, message: 'Forbidden', error: 'Forbidden' });
            return;
        }
        next();
    };
}
