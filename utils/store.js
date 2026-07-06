const { pullSnapshot, persistResource } = require('./backend');

const STAFF_KEY = 'netbar_staff';
const SHIFT_KEY = 'netbar_shifts';
const SCHEDULE_KEY = 'netbar_schedule';
const ATTENDANCE_KEY = 'netbar_attendance';
const ROLE_KEY = 'netbar_role';
const STAFF_ROLE_RELATION_KEY = 'netbar_staff_role_relations';
const CURRENT_STAFF_KEY = 'netbar_current_staff';
const EMPLOYEE_AUTH_KEY = 'netbar_employee_auth';
const STORE_KEY = 'netbar_stores';
const CURRENT_STORE_KEY = 'netbar_current_store';
const INVITE_CODE_KEY = 'netbar_invite_code';
const DEBUG_ROLE_SWITCH_KEY = 'netbar_debug_role_switch';

const defaultStaff = [
  { id: 'emp_super_001', name: '超级管理员', gender: '男', age: 35, idCard: '120101199101010019', role: '超级管理员', position: 'manager', phone: '15500000000', storeIds: ['store1', 'store2'], maxPerWeek: 6, status: 'active', hireDate: '2024-01-01', inviteCode: '100000', openidBound: false },
  { id: 'emp_manager_001', name: '张明远', gender: '男', age: 32, idCard: '120101199403120018', role: '店长', position: 'manager', phone: '15522013798', storeIds: ['store1'], maxPerWeek: 6, status: 'active', hireDate: '2024-03-12', inviteCode: '100001', openidBound: false },
  { id: 'emp_staff_001', name: '李安安', gender: '女', age: 24, idCard: '120101200206180027', role: '普通员工', position: 'staff', phone: '15922251233', storeIds: ['store1'], maxPerWeek: 6, status: 'active', hireDate: '2025-06-18', inviteCode: '100002', openidBound: false }
];

const defaultStaffRoleRelations = [
  { id: 'rr_emp_super_001', storeId: '', staffId: 'emp_super_001', phone: '15500000000', role: 'super_admin', position: 'manager', positionText: '超级管理员' },
  { id: 'rr_emp_manager_001', storeId: 'store1', staffId: 'emp_manager_001', phone: '15522013798', role: 'manager', position: 'manager', positionText: '店长' },
  { id: 'rr_emp_staff_001', storeId: 'store1', staffId: 'emp_staff_001', phone: '15922251233', role: 'employee', position: 'staff', positionText: '普通员工' }
];

const defaultStores = [
  {
    id: 'store1',
    name: '星河网吧旗舰店',
    address: '天津市南开区时代奥城商业广场',
    latitude: 39.0894,
    longitude: 117.1746,
    checkinRadius: 200,
    status: 'active'
  },
  {
    id: 'store2',
    name: '疾风电竞网吧滨江店',
    address: '天津市和平区滨江道商圈',
    latitude: 39.1248,
    longitude: 117.2009,
    checkinRadius: 200,
    status: 'active'
  }
];

const defaultShifts = [
  { id: 'morning', name: '早班', time: '08:00-16:00', need: 2, color: '#eaf6ff' },
  { id: 'middle', name: '中班', time: '16:00-00:00', need: 2, color: '#f2f7e8' },
  { id: 'night', name: '夜班', time: '00:00-08:00', need: 1, color: '#f8eefc' }
];

function getStore(key, fallback) {
  const value = wx.getStorageSync(key);
  return value || fallback;
}

function setLocalStore(key, value) {
  wx.setStorageSync(key, value);
}

function setStore(key, value) {
  setLocalStore(key, value);
  persistResource(key, value);
}

function normalizeStaff(staff, fallbackStoreId) {
  return staff.map((item, index) => ({
    ...item,
    idCard: item.idCard || '',
    position: item.position || '',
    phone: item.phone || '',
    storeIds: item.storeIds && item.storeIds.length ? item.storeIds : [fallbackStoreId],
    status: item.status || 'active',
    inviteCode: item.inviteCode || String(100001 + index),
    openidBound: !!item.openidBound
  }));
}

function normalizeStaffRoleRelations(relations, staff) {
  const relationMap = (relations || []).reduce((map, item) => {
    if (item.staffId) {
      map[item.staffId] = {
        ...item,
        phone: item.phone || '',
        role: item.role === 'super_admin' ? 'super_admin' : (item.role === 'admin' || item.role === 'manager' ? 'manager' : 'employee')
      };
    }
    return map;
  }, {});

  return staff.map((item) => ({
    id: relationMap[item.id] ? relationMap[item.id].id : `rr_${item.id}`,
    storeId: relationMap[item.id] ? relationMap[item.id].storeId : ((item.storeIds && item.storeIds[0]) || ''),
    staffId: item.id,
    phone: relationMap[item.id] ? relationMap[item.id].phone : (item.phone || ''),
    role: relationMap[item.id] ? relationMap[item.id].role : 'employee',
    position: relationMap[item.id] ? (relationMap[item.id].position || 'staff') : (item.position || 'staff'),
    positionText: relationMap[item.id] ? (relationMap[item.id].positionText || '') : (item.role || '')
  }));
}

function looksLikeLegacySchedule(schedule) {
  return Object.keys(schedule || {}).some((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
}

function normalizeSchedule(schedule, fallbackStoreId) {
  if (!schedule || !looksLikeLegacySchedule(schedule)) return schedule || {};
  return {
    [fallbackStoreId]: schedule
  };
}

function mergeById(current, defaults) {
  const next = (current || []).slice();
  const idMap = next.reduce((map, item) => {
    if (item.id) map[item.id] = true;
    return map;
  }, {});
  (defaults || []).forEach((item) => {
    if (!idMap[item.id]) next.push(item);
  });
  return next;
}

function ensureSeedRecords() {
  const stores = mergeById(wx.getStorageSync(STORE_KEY) || [], defaultStores);
  setLocalStore(STORE_KEY, stores);

  const staff = mergeById(wx.getStorageSync(STAFF_KEY) || [], defaultStaff);
  setLocalStore(STAFF_KEY, staff);

  const relations = mergeById(wx.getStorageSync(STAFF_ROLE_RELATION_KEY) || [], defaultStaffRoleRelations);
  setLocalStore(STAFF_ROLE_RELATION_KEY, relations);
}

function seedStore() {
  if (!wx.getStorageSync(STORE_KEY)) {
    setLocalStore(STORE_KEY, defaultStores);
  }
  if (!wx.getStorageSync(CURRENT_STORE_KEY)) {
    setLocalStore(CURRENT_STORE_KEY, defaultStores[0].id);
  }
  if (!wx.getStorageSync(STAFF_KEY)) {
    setLocalStore(STAFF_KEY, defaultStaff);
  } else {
    setLocalStore(STAFF_KEY, normalizeStaff(wx.getStorageSync(STAFF_KEY), defaultStores[0].id));
  }
  if (!wx.getStorageSync(STAFF_ROLE_RELATION_KEY)) {
    setLocalStore(STAFF_ROLE_RELATION_KEY, defaultStaffRoleRelations);
  } else {
    setLocalStore(
      STAFF_ROLE_RELATION_KEY,
      normalizeStaffRoleRelations(wx.getStorageSync(STAFF_ROLE_RELATION_KEY), wx.getStorageSync(STAFF_KEY))
    );
  }
  if (!wx.getStorageSync(SHIFT_KEY)) {
    setLocalStore(SHIFT_KEY, defaultShifts);
  }
  if (!wx.getStorageSync(SCHEDULE_KEY)) {
    setLocalStore(SCHEDULE_KEY, {});
  } else {
    setLocalStore(SCHEDULE_KEY, normalizeSchedule(wx.getStorageSync(SCHEDULE_KEY), defaultStores[0].id));
  }
  if (!wx.getStorageSync(ATTENDANCE_KEY)) {
    setLocalStore(ATTENDANCE_KEY, []);
  }
  if (!wx.getStorageSync(ROLE_KEY)) {
    setLocalStore(ROLE_KEY, 'employee');
  }
  if (!wx.getStorageSync(DEBUG_ROLE_SWITCH_KEY)) {
    setLocalStore(DEBUG_ROLE_SWITCH_KEY, false);
  }
  if (!wx.getStorageSync(CURRENT_STAFF_KEY)) {
    setLocalStore(CURRENT_STAFF_KEY, defaultStaff[0].id);
  }
  if (!wx.getStorageSync(EMPLOYEE_AUTH_KEY)) {
    setLocalStore(EMPLOYEE_AUTH_KEY, {
      nickname: '',
      avatarUrl: '',
      phone: '',
      phoneCode: '',
      loginCode: '',
      staffId: '',
      bound: false
    });
  }
  ensureSeedRecords();
}

function syncStoreFromBackend() {
  return pullSnapshot().then((snapshot) => {
    if (!snapshot) return null;
    if (snapshot.stores && snapshot.stores.length) setLocalStore(STORE_KEY, snapshot.stores);
    if (snapshot.staff && snapshot.staff.length) setLocalStore(STAFF_KEY, snapshot.staff);
    if (snapshot.staffRoleRelations && snapshot.staffRoleRelations.length) setLocalStore(STAFF_ROLE_RELATION_KEY, snapshot.staffRoleRelations);
    if (snapshot.shifts && snapshot.shifts.length) setLocalStore(SHIFT_KEY, snapshot.shifts);
    if (snapshot.schedule) setLocalStore(SCHEDULE_KEY, snapshot.schedule);
    if (snapshot.attendance) setLocalStore(ATTENDANCE_KEY, snapshot.attendance);
    ensureSeedRecords();
    return snapshot;
  });
}

module.exports = {
  STAFF_KEY,
  STAFF_ROLE_RELATION_KEY,
  SHIFT_KEY,
  SCHEDULE_KEY,
  ATTENDANCE_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  INVITE_CODE_KEY,
  DEBUG_ROLE_SWITCH_KEY,
  defaultStaff,
  defaultStaffRoleRelations,
  defaultStores,
  defaultShifts,
  getStore,
  setStore,
  seedStore,
  syncStoreFromBackend
};
