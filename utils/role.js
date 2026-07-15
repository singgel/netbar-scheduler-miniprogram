const {
  STAFF_KEY,
  STAFF_ROLE_RELATION_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  getStore,
  setStore
} = require('./store');

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeRole(role) {
  if (role === 'super_admin' || role === 'superAdmin' || role === '超级管理员') return 'super_admin';
  if (role === 'manager' || role === 'admin' || role === '管理员' || role === '店长') return 'manager';
  return 'employee';
}

function isSuperAdminRole(role) {
  return normalizeRole(role) === 'super_admin';
}

function isManagerRole(role) {
  return normalizeRole(role) === 'manager';
}

function isAdminSideRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'manager';
}

function normalizePosition(position, role) {
  if (position === 'manager' || position === 'cashier' || position === 'network' || position === 'staff') return position;
  if (role === 'super_admin' || role === 'manager' || role === 'admin' || role === '店长') return 'manager';
  if (role === 'cashier' || role === '收银') return 'cashier';
  if (role === 'network' || role === '网管') return 'network';
  return 'staff';
}

function positionText(position) {
  if (position === 'manager') return '店长';
  if (position === 'cashier') return '收银';
  if (position === 'network') return '网管';
  return '普通员工';
}

function getEffectivePhone(auth) {
  return normalizePhone(auth && (auth.phone || auth.manualPhone));
}

function getRelationRole(staffId, phone, relations) {
  const normalizedPhone = normalizePhone(phone);
  const relation = (relations || []).find((item) => (
    (staffId && item.staffId === staffId) ||
    (normalizedPhone && normalizePhone(item.phone) === normalizedPhone)
  ));
  return relation ? normalizeRole(relation.role) : 'employee';
}

function resolveAccountByPhone(phone, preferredStaffId, fallbackRole) {
  const normalizedPhone = normalizePhone(phone);
  const staff = getStore(STAFF_KEY, []);
  const relations = getStore(STAFF_ROLE_RELATION_KEY, []);
  const phoneRelation = normalizedPhone
    ? relations.find((item) => normalizePhone(item.phone) === normalizedPhone)
    : null;
  const phoneStaff = normalizedPhone
    ? staff.find((item) => normalizePhone(item.phone) === normalizedPhone && item.status !== 'left')
    : null;
  const staffId = (phoneRelation && phoneRelation.staffId) || (phoneStaff && phoneStaff.id) || preferredStaffId || '';
  const relationRole = getRelationRole(staffId, normalizedPhone, relations);
  // 关系表查不到时，回退到员工记录自身的 role 字段，避免清除操作误删关系后无法恢复角色
  const staffRecord = staff.find((item) => item.id === staffId) || null;
  const fallbackStaffRole = staffRecord && staffRecord.role ? normalizeRole(staffRecord.role) : 'employee';
  const role = fallbackRole
    ? normalizeRole(fallbackRole)
    : (relationRole === 'employee' && fallbackStaffRole !== 'employee' ? fallbackStaffRole : relationRole);

  return {
    role,
    staffId,
    phone: normalizedPhone,
    staff: staffRecord
  };
}

function upsertStaffRoleRelation(staffId, phone, role, meta) {
  if (!staffId) return;
  const normalizedPhone = normalizePhone(phone);
  const relations = getStore(STAFF_ROLE_RELATION_KEY, []);
  const index = relations.findIndex((item) => item.staffId === staffId);
  const oldRelation = index >= 0 ? relations[index] : {};
  const position = normalizePosition(meta && meta.position, role);
  const nextRelation = {
    id: index >= 0 ? oldRelation.id : `rr_${staffId}`,
    storeId: (meta && meta.storeId) || oldRelation.storeId || '',
    staffId,
    phone: normalizedPhone || oldRelation.phone || '',
    role: normalizeRole(role),
    position,
    positionText: positionText(position)
  };
  const next = index >= 0
    ? relations.map((item, relationIndex) => (relationIndex === index ? nextRelation : item))
    : relations.concat(nextRelation);
  setStore(STAFF_ROLE_RELATION_KEY, next);
}

function applyResolvedRole(account) {
  const role = normalizeRole(account && account.role);
  setStore(ROLE_KEY, role);
  if (account && account.staffId) {
    setStore(CURRENT_STAFF_KEY, account.staffId);
  }
  return role;
}

function syncRoleFromAuth(auth) {
  const phone = getEffectivePhone(auth);
  if (!phone && !(auth && auth.bound && auth.staffId)) {
    return getStore(ROLE_KEY, 'employee');
  }

  const account = resolveAccountByPhone(phone, auth && auth.staffId);
  applyResolvedRole(account);
  return account.role;
}

function getStaffStoreIds(staffId) {
  if (!staffId) return [];
  const staff = getStore(STAFF_KEY, []);
  const currentStaff = staff.find((item) => item.id === staffId) || {};
  if (currentStaff.storeIds && currentStaff.storeIds.length) return currentStaff.storeIds;
  return currentStaff.storeId ? [currentStaff.storeId] : [];
}

function getVisibleStoresForRole(role, stores, staffId) {
  if (isSuperAdminRole(role)) return stores || [];
  const allowedStoreIds = getStaffStoreIds(staffId);
  if (!allowedStoreIds.length) return isAdminSideRole(role) ? [] : (stores || []);
  return (stores || []).filter((store) => allowedStoreIds.indexOf(store.id) >= 0);
}

function getScopedCurrentStoreId(role, stores, currentStoreId, staffId) {
  const visibleStores = getVisibleStoresForRole(role, stores, staffId);
  if (!visibleStores.length) return '';
  if (visibleStores.some((store) => store.id === currentStoreId)) return currentStoreId;
  return visibleStores[0].id;
}

function syncTabBar(page) {
  if (!page || typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (tabBar && typeof tabBar.refresh === 'function') {
    tabBar.refresh(page.route);
  }
}

module.exports = {
  normalizePhone,
  normalizeRole,
  isSuperAdminRole,
  isManagerRole,
  isAdminSideRole,
  normalizePosition,
  getEffectivePhone,
  getRelationRole,
  resolveAccountByPhone,
  upsertStaffRoleRelation,
  applyResolvedRole,
  syncRoleFromAuth,
  getStaffStoreIds,
  getVisibleStoresForRole,
  getScopedCurrentStoreId,
  syncTabBar
};
