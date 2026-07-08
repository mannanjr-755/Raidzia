"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_TAGLINE = exports.APP_NAME = exports.ROLE_PERMISSIONS = exports.UserRole = void 0;
exports.hasPermission = hasPermission;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["OWNER"] = "OWNER";
    UserRole["DIRECTOR"] = "DIRECTOR";
    UserRole["PROJECT_MANAGER"] = "PROJECT_MANAGER";
    UserRole["SITE_ENGINEER"] = "SITE_ENGINEER";
    UserRole["ARCHITECT"] = "ARCHITECT";
    UserRole["QUANTITY_SURVEYOR"] = "QUANTITY_SURVEYOR";
    UserRole["ACCOUNTS"] = "ACCOUNTS";
    UserRole["HR"] = "HR";
    UserRole["SALES"] = "SALES";
    UserRole["INVENTORY_MANAGER"] = "INVENTORY_MANAGER";
    UserRole["STORE_MANAGER"] = "STORE_MANAGER";
    UserRole["RECEPTION"] = "RECEPTION";
    UserRole["CUSTOMER"] = "CUSTOMER";
})(UserRole || (exports.UserRole = UserRole = {}));
const ALL = [
    'dashboard:read', 'projects:read', 'projects:write', 'projects:delete',
    'land:read', 'land:write', 'land:delete', 'land:feasibility',
    'properties:read', 'properties:write', 'properties:delete',
    'crm:read', 'crm:write', 'crm:delete',
    'sales:read', 'sales:write', 'sales:delete',
    'accounting:read', 'accounting:write', 'accounting:delete',
    'expenses:read', 'expenses:write', 'expenses:delete',
    'procurement:read', 'procurement:write',
    'inventory:read', 'inventory:write',
    'hr:read', 'hr:write', 'machinery:read', 'machinery:write',
    'inspection:read', 'inspection:write',
    'reports:read', 'reports:export', 'notifications:read',
    'digital-twin:read', 'users:read', 'users:write', 'settings:read', 'settings:write',
];
exports.ROLE_PERMISSIONS = {
    [UserRole.SUPER_ADMIN]: ALL,
    [UserRole.OWNER]: ALL,
    [UserRole.DIRECTOR]: ALL.filter((p) => !p.startsWith('users:')),
    [UserRole.PROJECT_MANAGER]: [
        'dashboard:read', 'projects:read', 'projects:write',
        'land:read', 'land:feasibility', 'properties:read',
        'expenses:read', 'expenses:write', 'inspection:read', 'inspection:write',
        'machinery:read', 'reports:read', 'notifications:read', 'digital-twin:read',
    ],
    [UserRole.SITE_ENGINEER]: [
        'dashboard:read', 'projects:read', 'inspection:read', 'inspection:write',
        'machinery:read', 'inventory:read', 'notifications:read', 'digital-twin:read',
    ],
    [UserRole.ARCHITECT]: [
        'dashboard:read', 'projects:read', 'land:read', 'properties:read', 'properties:write',
        'digital-twin:read', 'reports:read', 'notifications:read',
    ],
    [UserRole.QUANTITY_SURVEYOR]: [
        'dashboard:read', 'projects:read', 'land:read', 'land:feasibility',
        'procurement:read', 'inventory:read', 'reports:read', 'notifications:read',
    ],
    [UserRole.ACCOUNTS]: [
        'dashboard:read', 'accounting:read', 'accounting:write',
        'expenses:read', 'expenses:write', 'sales:read', 'procurement:read',
        'reports:read', 'reports:export', 'notifications:read',
    ],
    [UserRole.HR]: [
        'dashboard:read', 'hr:read', 'hr:write', 'reports:read', 'notifications:read',
    ],
    [UserRole.SALES]: [
        'dashboard:read', 'crm:read', 'crm:write', 'sales:read', 'sales:write',
        'properties:read', 'reports:read', 'notifications:read', 'digital-twin:read',
    ],
    [UserRole.INVENTORY_MANAGER]: [
        'dashboard:read', 'inventory:read', 'inventory:write',
        'procurement:read', 'procurement:write', 'reports:read', 'notifications:read',
    ],
    [UserRole.STORE_MANAGER]: [
        'dashboard:read', 'inventory:read', 'inventory:write', 'procurement:read', 'notifications:read',
    ],
    [UserRole.RECEPTION]: [
        'dashboard:read', 'crm:read', 'crm:write', 'properties:read', 'notifications:read',
    ],
    [UserRole.CUSTOMER]: [
        'dashboard:read', 'properties:read', 'sales:read', 'notifications:read', 'digital-twin:read',
    ],
};
function hasPermission(role, permission) {
    return exports.ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
exports.APP_NAME = 'RSS ERP';
exports.APP_TAGLINE = 'Rehan Shahid & Sons Builders & Developers';
