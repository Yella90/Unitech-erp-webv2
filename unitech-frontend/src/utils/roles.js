export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (['administrateur ecole', 'administrateur_ecole', 'administrateur', 'admin'].includes(normalized)) {
    return 'directeur';
  }
  return normalized;
}

export function isSuperAdminRole(role) {
  return ['super@admin', 'superadmin'].includes(normalizeRole(role));
}

const rolePermissions = {
  'super@admin': { all: ['manage'] },
  superadmin: { all: ['manage'] },
  directeur: { all: ['manage'] },
  promoteur: {
    all: ['read'],
    classes: ['read'],
    subjects: ['read'],
    assignments: ['read'],
    teachers: ['read', 'create', 'update', 'delete'],
    personnels: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    schedules: ['read', 'create', 'update', 'delete'],
    trimestres: ['read', 'create', 'update', 'delete'],
    finances: ['read', 'create', 'delete'],
    payments: ['read', 'create', 'delete'],
    expenses: ['read', 'create', 'delete'],
    salaries: ['read', 'create', 'delete'],
  },
  comptable: {
    classes: ['read'],
    students: ['read', 'create', 'update'],
    payments: ['read', 'create', 'update', 'delete'],
    salaries: ['read', 'create', 'update', 'delete'],
    expenses: ['read', 'create', 'update', 'delete'],
    finances: ['read'],
    dashboard: ['read'],
    reports: ['read'],
    personnels: ['read'],
    teachers: ['read'],
    users: ['read'],
  },
  secretaire: {
    classes: ['read'],
    students: ['read', 'create', 'update'],
    payments: ['read', 'create', 'update', 'delete'],
    salaries: ['read', 'create', 'update', 'delete'],
    expenses: ['read', 'create', 'update', 'delete'],
    finances: ['read'],
    dashboard: ['read'],
    reports: ['read'],
    personnels: ['read'],
    teachers: ['read'],
  },
  censeur: {
    classes: ['read', 'create', 'update'],
    attendance: ['read', 'create', 'update'],
    schedules: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    bulletins: ['read'],
    trimestres: ['read', 'create', 'update', 'delete'],
    assignments: ['read', 'create', 'update', 'delete'],
    students: ['read'],
    teachers: ['read'],
    subjects: ['read'],
    dashboard: ['read'],
    reports: ['read'],
  },
  surveillant: {
    classes: ['read', 'create', 'update'],
    attendance: ['read', 'create', 'update'],
    schedules: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    bulletins: ['read'],
    trimestres: ['read', 'create', 'update', 'delete'],
    assignments: ['read', 'create', 'update', 'delete'],
    students: ['read'],
    teachers: ['read'],
    subjects: ['read'],
    dashboard: ['read'],
    reports: ['read'],
  },
  enseignant: {
    attendance: ['read', 'create'],
    notes: ['read', 'create'],
    bulletins: ['read'],
    schedules: ['read'],
    assignments: ['read'],
    classes: ['read'],
    students: ['read'],
    subjects: ['read'],
    trimestres: ['read'],
    dashboard: ['read'],
  },
  personnel: {
    dashboard: ['read'],
  },
};

export function hasPermission(role, resource, action = 'read') {
  if (resource === 'users') {
    return ['directeur', 'super@admin', 'superadmin'].includes(normalizeRole(role));
  }
  if (resource === 'transfer_notifications') {
    return ['directeur', 'super@admin', 'superadmin'].includes(normalizeRole(role));
  }
  if (resource === 'activity_logs') {
    return ['directeur', 'promoteur', 'super@admin', 'superadmin'].includes(normalizeRole(role));
  }
  const permissions = rolePermissions[normalizeRole(role)] || {};
  const allPermissions = permissions.all || [];
  const resourcePermissions = permissions[resource] || [];
  if (allPermissions.includes('manage') || resourcePermissions.includes('manage')) return true;
  if (action === 'read' && allPermissions.includes('read')) return true;
  return allPermissions.includes(action) || resourcePermissions.includes(action);
}

export function canAccessResource(role, resource, action = 'read', allowedRoles = []) {
  const normalized = normalizeRole(role);
  if (isSuperAdminRole(normalized)) return true;
  const allowedByRole = !Array.isArray(allowedRoles) || allowedRoles.length === 0 || allowedRoles.includes(normalized);
  const allowedByPermission = !resource || hasPermission(normalized, resource, action);
  return allowedByRole && allowedByPermission;
}

export function getDefaultRouteForRole(role) {
  const normalized = normalizeRole(role);
  if (isSuperAdminRole(normalized)) return '/super-admin';
  if (normalized === 'enseignant') return '/notes';
  if (normalized === 'comptable') return '/finances';
  if (normalized === 'secretaire') return '/eleves';
  if (normalized === 'censeur') return '/notes';
  if (normalized === 'surveillant') return '/emplois-du-temps';
  if (normalized === 'promoteur') return '/rapports';
  return '/';
}
