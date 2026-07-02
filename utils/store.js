const STAFF_KEY = 'netbar_staff';
const SHIFT_KEY = 'netbar_shifts';
const SCHEDULE_KEY = 'netbar_schedule';
const ATTENDANCE_KEY = 'netbar_attendance';
const ROLE_KEY = 'netbar_role';
const CURRENT_STAFF_KEY = 'netbar_current_staff';
const EMPLOYEE_AUTH_KEY = 'netbar_employee_auth';
const STORE_KEY = 'netbar_stores';
const CURRENT_STORE_KEY = 'netbar_current_store';
const INVITE_CODE_KEY = 'netbar_invite_code';
const DEBUG_ROLE_SWITCH_KEY = 'netbar_debug_role_switch';

const defaultStaff = [
  { id: 's1', name: '员工1', role: '收银', phone: '', storeIds: ['store1'], maxPerWeek: 6, status: 'active', inviteCode: '100001', openidBound: true },
  { id: 's2', name: '员工2', role: '网管', phone: '', storeIds: ['store1'], maxPerWeek: 6, status: 'active', inviteCode: '100002', openidBound: false },
  { id: 's3', name: '员工3', role: '网管', phone: '', storeIds: ['store1', 'store2'], maxPerWeek: 6, status: 'active', inviteCode: '100003', openidBound: false },
  { id: 's4', name: '员工4', role: '保洁', phone: '', storeIds: ['store2'], maxPerWeek: 5, status: 'active', inviteCode: '100004', openidBound: false },
  { id: 's5', name: '员工5', role: '值班店长', phone: '', storeIds: ['store1'], maxPerWeek: 6, status: 'active', inviteCode: '100005', openidBound: false }
];

const defaultStores = [
  {
    id: 'store1',
    name: '一号门店',
    address: '示例地址 1',
    latitude: 39.9042,
    longitude: 116.4074,
    checkinRadius: 200,
    status: 'active'
  },
  {
    id: 'store2',
    name: '二号门店',
    address: '示例地址 2',
    latitude: 39.9142,
    longitude: 116.4174,
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

function setStore(key, value) {
  wx.setStorageSync(key, value);
}

function normalizeStaff(staff, fallbackStoreId) {
  return staff.map((item, index) => ({
    ...item,
    phone: item.phone || '',
    storeIds: item.storeIds && item.storeIds.length ? item.storeIds : [fallbackStoreId],
    status: item.status || 'active',
    inviteCode: item.inviteCode || String(100001 + index),
    openidBound: !!item.openidBound
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

function seedStore() {
  if (!wx.getStorageSync(STORE_KEY)) {
    setStore(STORE_KEY, defaultStores);
  }
  if (!wx.getStorageSync(CURRENT_STORE_KEY)) {
    setStore(CURRENT_STORE_KEY, defaultStores[0].id);
  }
  if (!wx.getStorageSync(STAFF_KEY)) {
    setStore(STAFF_KEY, defaultStaff);
  } else {
    setStore(STAFF_KEY, normalizeStaff(wx.getStorageSync(STAFF_KEY), defaultStores[0].id));
  }
  if (!wx.getStorageSync(SHIFT_KEY)) {
    setStore(SHIFT_KEY, defaultShifts);
  }
  if (!wx.getStorageSync(SCHEDULE_KEY)) {
    setStore(SCHEDULE_KEY, {});
  } else {
    setStore(SCHEDULE_KEY, normalizeSchedule(wx.getStorageSync(SCHEDULE_KEY), defaultStores[0].id));
  }
  if (!wx.getStorageSync(ATTENDANCE_KEY)) {
    setStore(ATTENDANCE_KEY, []);
  }
  if (!wx.getStorageSync(ROLE_KEY)) {
    setStore(ROLE_KEY, 'admin');
  }
  if (!wx.getStorageSync(DEBUG_ROLE_SWITCH_KEY)) {
    setStore(DEBUG_ROLE_SWITCH_KEY, true);
  }
  if (!wx.getStorageSync(CURRENT_STAFF_KEY)) {
    setStore(CURRENT_STAFF_KEY, defaultStaff[0].id);
  }
  if (!wx.getStorageSync(EMPLOYEE_AUTH_KEY)) {
    setStore(EMPLOYEE_AUTH_KEY, {
      nickname: '',
      avatarUrl: '',
      phone: '',
      phoneCode: '',
      loginCode: '',
      staffId: defaultStaff[0].id,
      bound: false
    });
  }
}

module.exports = {
  STAFF_KEY,
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
  defaultStores,
  defaultShifts,
  getStore,
  setStore,
  seedStore
};
