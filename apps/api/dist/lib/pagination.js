"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = getPagination;
exports.paginated = paginated;
function getPagination(req, defaultLimit = 10) {
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || defaultLimit), 10) || defaultLimit));
    const search = String(req.query.search || '').trim();
    const skip = (page - 1) * limit;
    return { page, limit, search, skip };
}
function paginated(items, total, page, limit) {
    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    };
}
