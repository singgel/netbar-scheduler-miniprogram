const {
  STAFF_KEY,
  SHIFT_KEY,
  SCHEDULE_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  getStore,
  setStore
} = require('../../utils/store');
const { getMonthDays, monthLabel } = require('../../utils/date');
const { generateMonthSchedule, staffNameMap } = require('../../utils/scheduler');

Page({
  data: {
    year: 2026,
    month: 6,
    monthText: '',
    staff: [],
    storeStaff: [],
    shifts: [],
    rows: [],
    role: 'admin',
    stores: [],
    currentStoreId: '',
    currentStoreName: '',
    currentStaffId: '',
    currentStaffName: '',
    employeeReady: true,
    schedule: {},
    pickerVisible: false,
    activeDate: '',
    activeShift: '',
    activeShiftName: '',
    activeStaffIds: [],
    staffOptions: []
  },

  onLoad() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const staff = getStore(STAFF_KEY, []);
    const stores = getStore(STORE_KEY, []);
    const shifts = getStore(SHIFT_KEY, []);
    const schedule = getStore(SCHEDULE_KEY, {});
    const currentStoreId = getStore(CURRENT_STORE_KEY, stores[0] ? stores[0].id : '');
    const currentStore = stores.find((item) => item.id === currentStoreId) || {};
    const role = getStore(ROLE_KEY, 'admin');
    const employeeAuth = getStore(EMPLOYEE_AUTH_KEY, {});
    const currentStaffId = getStore(CURRENT_STAFF_KEY, staff[0] ? staff[0].id : '');
    const currentStaff = staff.find((item) => item.id === currentStaffId) || {};
    const employeeReady = role === 'admin' || !!(employeeAuth.bound && employeeAuth.nickname && employeeAuth.avatarUrl && (employeeAuth.phone || employeeAuth.phoneCode || employeeAuth.manualPhone));
    const days = getMonthDays(this.data.year, this.data.month);
    const names = staffNameMap(staff);
    const storeSchedule = schedule[currentStoreId] || {};
    const activeStaff = staff.filter((item) => item.status !== 'left');
    const storeStaff = activeStaff.filter((item) => (item.storeIds || [currentStoreId]).indexOf(currentStoreId) >= 0);
    const rows = days.map((day) => {
      let visibleShifts = [];
      if (role === 'admin') {
        const daySchedule = storeSchedule[day.date] || {};
        visibleShifts = shifts.map((shift) => {
          const ids = daySchedule[shift.id] || [];
          return {
            ...shift,
            names: ids.map((id) => names[id] || '未知员工'),
            isMine: ids.indexOf(currentStaffId) >= 0
          };
        });
      } else {
        stores.forEach((store) => {
          const daySchedule = ((schedule[store.id] || {})[day.date]) || {};
          shifts.forEach((shift) => {
            const ids = daySchedule[shift.id] || [];
            if (ids.indexOf(currentStaffId) < 0) return;
            visibleShifts.push({
              ...shift,
              name: `${store.name} · ${shift.name}`,
              names: ids.map((id) => names[id] || '未知员工'),
              isMine: true
            });
          });
        });
      }
      return {
        ...day,
        shifts: visibleShifts,
        hasMine: visibleShifts.length > 0
      };
    }).filter((day) => role === 'admin' || day.hasMine);

    this.setData({
      staff,
      storeStaff,
      shifts,
      stores,
      currentStoreId,
      currentStoreName: currentStore.name || '',
      role,
      currentStaffId,
      currentStaffName: currentStaff.name || '',
      employeeReady,
      schedule,
      rows,
      monthText: monthLabel(this.data.year, this.data.month)
    });
  },

  prevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month < 1) {
      year -= 1;
      month = 12;
    }
    this.setData({ year, month }, () => this.refresh());
  },

  nextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
    this.setData({ year, month }, () => this.refresh());
  },

  autoSchedule() {
    if (this.data.role !== 'admin') return;
    const days = getMonthDays(this.data.year, this.data.month);
    const monthSchedule = generateMonthSchedule(days, this.data.shifts, this.data.storeStaff);
    const next = {
      ...this.data.schedule,
      [this.data.currentStoreId]: {
        ...(this.data.schedule[this.data.currentStoreId] || {}),
        ...monthSchedule
      }
    };
    setStore(SCHEDULE_KEY, next);
    wx.showToast({ title: '已生成安排', icon: 'success' });
    this.refresh();
  },

  clearMonth() {
    if (this.data.role !== 'admin') return;
    wx.showModal({
      title: '清空本月班表',
      content: '会删除当前月份所有班次安排。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        const days = getMonthDays(this.data.year, this.data.month);
        const next = { ...this.data.schedule };
        const storeSchedule = { ...(next[this.data.currentStoreId] || {}) };
        days.forEach((day) => delete storeSchedule[day.date]);
        next[this.data.currentStoreId] = storeSchedule;
        setStore(SCHEDULE_KEY, next);
        this.refresh();
      }
    });
  },

  openPicker(event) {
    if (this.data.role !== 'admin') return;
    const { date, shift } = event.currentTarget.dataset;
    const storeSchedule = this.data.schedule[this.data.currentStoreId] || {};
    const activeStaffIds = ((storeSchedule[date] || {})[shift] || []).slice();
    const activeStaffIdsMap = activeStaffIds.reduce((map, id) => {
      map[id] = true;
      return map;
    }, {});
    const staffOptions = this.data.storeStaff.map((item) => ({
      ...item,
      checked: !!activeStaffIdsMap[item.id]
    }));
    const activeShift = this.data.shifts.find((item) => item.id === shift) || {};
    this.setData({
      pickerVisible: true,
      activeDate: date,
      activeShift: shift,
      activeShiftName: activeShift.name || '',
      activeStaffIds,
      staffOptions
    });
  },

  closePicker() {
    this.setData({ pickerVisible: false });
  },

  noop() {},

  toggleStaff(event) {
    const id = event.currentTarget.dataset.id;
    const staffOptions = this.data.staffOptions.map((item) => (
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
    this.setData({
      staffOptions,
      activeStaffIds: staffOptions.filter((item) => item.checked).map((item) => item.id)
    });
  },

  savePicker() {
    const schedule = { ...this.data.schedule };
    const storeSchedule = { ...(schedule[this.data.currentStoreId] || {}) };
    const day = { ...(storeSchedule[this.data.activeDate] || {}) };
    day[this.data.activeShift] = this.data.activeStaffIds;
    storeSchedule[this.data.activeDate] = day;
    schedule[this.data.currentStoreId] = storeSchedule;
    setStore(SCHEDULE_KEY, schedule);
    this.setData({ pickerVisible: false });
    this.refresh();
  }
});
