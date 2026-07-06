const {
  STAFF_KEY,
  SHIFT_KEY,
  ATTENDANCE_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  SCHEDULE_KEY,
  getStore,
  setStore
} = require('../../utils/store');
const { formatDate } = require('../../utils/date');
const { matchNearestStore } = require('../../utils/location');
const { isAdminSideRole, isSuperAdminRole, getVisibleStoresForRole, getScopedCurrentStoreId, syncTabBar } = require('../../utils/role');
const { sortShiftsByStartTime } = require('../../utils/shifts');

function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function timeText(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function staffStoreIds(staff) {
  if (staff.storeIds && staff.storeIds.length) return staff.storeIds;
  if (staff.storeId) return [staff.storeId];
  return [];
}

Page({
  data: {
    today: '',
    staff: [],
    shifts: [],
    stores: [],
    records: [],
    role: 'manager',
    canManage: true,
    isSuperAdmin: false,
    currentStoreId: '',
    currentStaffName: '',
    employeeAuth: {},
    employeeReady: true,
    selectedStaffIndex: -1,
    selectedShiftIndex: -1,
    selectedStaffName: '',
    selectedShiftName: '',
    locating: false
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const today = formatDate(new Date());
    const staff = getStore(STAFF_KEY, []);
    const shifts = sortShiftsByStartTime(getStore(SHIFT_KEY, []));
    const role = getStore(ROLE_KEY, 'manager');
    const canManage = isAdminSideRole(role);
    const isSuperAdmin = isSuperAdminRole(role);
    const allStores = getStore(STORE_KEY, []);
    const employeeAuth = getStore(EMPLOYEE_AUTH_KEY, {});
    const currentStaffId = getStore(CURRENT_STAFF_KEY, staff[0] ? staff[0].id : '');
    const storedStoreId = getStore(CURRENT_STORE_KEY, allStores[0] ? allStores[0].id : '');
    const currentStoreId = getScopedCurrentStoreId(role, allStores, storedStoreId, currentStaffId);
    if (currentStoreId && currentStoreId !== storedStoreId) {
      setStore(CURRENT_STORE_KEY, currentStoreId);
    }
    const stores = getVisibleStoresForRole(role, allStores, currentStaffId);
    const visibleStoreIds = stores.map((store) => store.id);
    const currentStaffIndex = staff.findIndex((item) => item.id === currentStaffId);
    const currentStaff = staff[currentStaffIndex] || {};
    const employeeReady = canManage || !!(employeeAuth.bound && currentStaff.status !== 'left' && currentStaff.id && (employeeAuth.phone || employeeAuth.phoneCode || employeeAuth.manualPhone));
    const visibleStaff = canManage
      ? staff.filter((item) => isSuperAdmin || staffStoreIds(item).indexOf(currentStoreId) >= 0)
      : staff;
    const allRecords = getStore(ATTENDANCE_KEY, []);
    const staffMap = staff.reduce((map, item) => {
      map[item.id] = item.name;
      return map;
    }, {});
    const shiftMap = shifts.reduce((map, item) => {
      map[item.id] = item.name;
      return map;
    }, {});
    const storeMap = stores.reduce((map, item) => {
      map[item.id] = item.name;
      return map;
    }, {});
    const records = allRecords
      .filter((item) => item.date === today)
      .filter((item) => {
        if (isSuperAdmin) return true;
        if (canManage) return visibleStoreIds.indexOf(item.storeId) >= 0;
        return item.staffId === currentStaffId;
      })
      .map((item) => ({
        ...item,
        staffName: staffMap[item.staffId] || '未知员工',
        shiftName: shiftMap[item.shiftId] || '未知班次',
        storeName: item.storeName || storeMap[item.storeId] || '未匹配门店'
      }))
      .reverse();

    this.setData({
      today,
      staff: visibleStaff,
      shifts,
      stores,
      records,
      role,
      canManage,
      isSuperAdmin,
      currentStoreId,
      currentStaffName: currentStaff.name || '',
      employeeAuth,
      employeeReady,
      selectedStaffIndex: role === 'employee' ? Math.max(0, currentStaffIndex) : this.data.selectedStaffIndex,
      selectedStaffName: role === 'employee' ? (currentStaff.name || '') : this.data.selectedStaffName
    }, () => syncTabBar(this));
  },

  selectStaff(event) {
    const index = Number(event.detail.value);
    this.setData({
      selectedStaffIndex: index,
      selectedStaffName: this.data.staff[index].name
    });
  },

  selectShift(event) {
    const index = Number(event.detail.value);
    this.setData({
      selectedShiftIndex: index,
      selectedShiftName: this.data.shifts[index].name
    });
  },

  ensureSelection() {
    if (this.data.role === 'employee' && !this.data.employeeReady) {
      wx.showToast({ title: '请先完成员工登录', icon: 'none' });
      return null;
    }
    if (
      this.data.selectedStaffIndex < 0 ||
      this.data.selectedShiftIndex < 0 ||
      !this.data.staff[this.data.selectedStaffIndex] ||
      !this.data.shifts[this.data.selectedShiftIndex]
    ) {
      wx.showToast({ title: '请选择员工和班次', icon: 'none' });
      return null;
    }
    const staff = this.data.staff[this.data.selectedStaffIndex];
    if (staff.status === 'left') {
      wx.showToast({ title: '员工已离职，无法打卡', icon: 'none' });
      return null;
    }
    return {
      staff,
      shift: this.data.shifts[this.data.selectedShiftIndex]
    };
  },

  getLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: resolve,
        fail: reject
      });
    });
  },

  scheduledStoreIds(staffId, shiftId, date) {
    const schedule = getStore(SCHEDULE_KEY, {});
    return Object.keys(schedule).filter((storeId) => {
      const ids = (((schedule[storeId] || {})[date] || {})[shiftId]) || [];
      return ids.indexOf(staffId) >= 0;
    });
  },

  resolveStore(selected, date) {
    this.setData({ locating: true });
    return this.getLocation()
      .then((location) => {
        const scheduledStoreIds = this.scheduledStoreIds(selected.staff.id, selected.shift.id, date);
        const allowedStoreIds = scheduledStoreIds.length ? scheduledStoreIds : (selected.staff.storeIds || []);
        const stores = this.data.stores.filter((store) => allowedStoreIds.indexOf(store.id) >= 0);
        const matched = matchNearestStore(location, stores);
        if (!matched) {
          throw new Error('没有可匹配的门店');
        }
        if (!matched.inRange) {
          const error = new Error(`距离${matched.name}${matched.distance}米，超出${matched.checkinRadius}米范围`);
          error.matched = matched;
          throw error;
        }
        return {
          location,
          matched
        };
      })
      .finally(() => {
        this.setData({ locating: false });
      });
  },

  clockIn() {
    const selected = this.ensureSelection();
    if (!selected) return;
    const now = new Date();
    const today = formatDate(now);
    this.resolveStore(selected, today)
      .then(({ location, matched }) => {
        const records = getStore(ATTENDANCE_KEY, []);
        const existing = records.find((item) => (
          item.date === today &&
          item.staffId === selected.staff.id &&
          item.shiftId === selected.shift.id
        ));
        if (existing && existing.clockIn) {
          wx.showToast({ title: '已上班打卡', icon: 'none' });
          return;
        }
        const next = records.concat({
          id: `a${Date.now()}`,
          date: today,
          storeId: matched.id,
          storeName: matched.name,
          staffId: selected.staff.id,
          shiftId: selected.shift.id,
          latitude: location.latitude,
          longitude: location.longitude,
          distance: matched.distance,
          result: 'normal',
          clockIn: timeText(now),
          clockOut: ''
        });
        setStore(ATTENDANCE_KEY, next);
        wx.showToast({ title: `${matched.name}打卡成功`, icon: 'success' });
        this.refresh();
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '定位打卡失败', icon: 'none' });
      });
  },

  clockOut() {
    const selected = this.ensureSelection();
    if (!selected) return;
    const now = new Date();
    const today = formatDate(now);
    this.resolveStore(selected, today)
      .then(({ location, matched }) => {
        const records = getStore(ATTENDANCE_KEY, []);
        const index = records.findIndex((item) => (
          item.date === today &&
          item.staffId === selected.staff.id &&
          item.shiftId === selected.shift.id
        ));
        if (index < 0) {
          wx.showToast({ title: '请先上班打卡', icon: 'none' });
          return;
        }
        records[index] = {
          ...records[index],
          storeId: records[index].storeId || matched.id,
          storeName: records[index].storeName || matched.name,
          outLatitude: location.latitude,
          outLongitude: location.longitude,
          outDistance: matched.distance,
          clockOut: timeText(now)
        };
        setStore(ATTENDANCE_KEY, records);
        wx.showToast({ title: '下班成功', icon: 'success' });
        this.refresh();
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '定位打卡失败', icon: 'none' });
      });
  }
});
