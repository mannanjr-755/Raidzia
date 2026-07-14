"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env'), override: true });
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const projects_routes_1 = __importDefault(require("./routes/projects.routes"));
const land_routes_1 = __importDefault(require("./routes/land.routes"));
const crm_routes_1 = __importDefault(require("./routes/crm.routes"));
const modules_routes_1 = __importDefault(require("./routes/modules.routes"));
const hr_routes_1 = __importDefault(require("./routes/hr.routes"));
const feasibility_routes_1 = __importDefault(require("./routes/feasibility.routes"));
const properties_routes_1 = __importDefault(require("./routes/properties.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const prisma_1 = require("./lib/prisma");
const route_utils_1 = require("./lib/route-utils");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.API_PORT || '4000');
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 500 }));
app.get('/api/health', async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.json({ success: true, message: 'RSS ERP API', version: '1.0.0', database: 'connected' });
    }
    catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ success: false, message: 'Database unavailable', error: 'Database unavailable' });
    }
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/projects', projects_routes_1.default);
app.use('/api/land', land_routes_1.default);
app.use('/api/crm', crm_routes_1.default);
app.use('/api/hr', hr_routes_1.default);
app.use('/api/feasibility', feasibility_routes_1.default);
app.use('/api/properties', properties_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api', modules_routes_1.default);
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found', error: 'Not found' }));
app.use((err, _req, res, _next) => {
    console.error('Unhandled API error:', err);
    if (res.headersSent) {
        return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ success: false, message: 'Invalid JSON request body', error: 'Invalid JSON request body' });
        return;
    }
    if (err.message.startsWith('CORS blocked origin')) {
        res.status(403).json({ success: false, message: 'Origin is not allowed by CORS', error: 'Origin is not allowed by CORS' });
        return;
    }
    (0, route_utils_1.sendPrismaError)(res, err, 'Internal server error');
});
async function start() {
    try {
        await prisma_1.prisma.$connect();
        console.log('Database connected');
    }
    catch (error) {
        console.error('Database connection failed. Run "npm run db:start" from the project root.');
        console.error(error);
        process.exit(1);
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`RSS ERP API running on http://localhost:${PORT}`);
    });
}
start();
exports.default = app;
