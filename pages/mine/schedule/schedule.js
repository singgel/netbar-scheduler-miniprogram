const {
  STAFF_KEY,
  SHIFT_KEY,
  SCHEDULE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  getStore
} = require('../../../utils/store');
const { formatDate, getMonthDays } = require('../../../utils/date');

const rangeOptions = [
  { label: '当天排班', value: 'today' },
  { label: '本周排班', value: 'week' },
  { label: '本月排班', value: 'month' }
];

function weekRange(today) {
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

function filterSchedule(schedule, range, now) {
  if (range === 'today') {
    const today = formatDate(now);
    return schedule.filter((item) => item.date === today);
  }
  if (range === 'week') {
    const rangeDates = weekRange(now);
    return schedule.filter((item) => item.date >= rangeDates.start && item.date <= rangeDates.end);
  }
  return schedule;
}

Page({
  data: {
    rangeOptions,
    rangeIndex: 2,
    rangeValue: 'month',
    rangeLabel: '本月排班',
    allSchedule: [],
    visibleSchedule: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const staffList = getStore(STAFF_KEY, []);
    const stores = getStore(STORE_KEY, []);
    const shifts = getStore(SHIFT_KEY, []);
    const schedule = getStore(SCHEDULE_KEY, {});
    const auth = getStore(EMPLOYEE_AUTH_KEY, {});
    const currentStaffId = auth.staffId || getStore(CURRENT_STAFF_KEY, '');
    const staff = staffList.find((item) => item.id === currentStaffId) || {};
    const shiftMap = shifts.reduce((map, shift) => {
      map[shift.id] = shift;
      return map;
    }, {});
    const storeMap = stores.reduce((map, store) => {
      map[store.id] = store;
      return map;
    }, {});
    const now = new Date();
    const todayStr = formatDate(now);
    const days = getMonthDays(now.getFullYear(), now.getMonth() + 1);
    const dayMap = days.reduce((map, day) => {
      map[day.date] = day;
      return map;
    }, {});
    const monthSchedule = [];
    Object.keys(schedule || {}).forEach((storeId) => {
      const storeSchedule = schedule[storeId] || {};
      Object.keys(storeSchedule).forEach((date) => {
        if (!dayMap[date]) return;
        const daySchedule = storeSchedule[date] || {};
        Object.keys(daySchedule).forEach((shiftId) => {
          const staffIds = daySchedule[shiftId] || [];
          if (staffIds.indexOf(currentStaffId || staff.id) < 0) return;
          const shift = shiftMap[shiftId] || {};
          const store = storeMap[storeId] || {};
          monthSchedule.push({
            key: `${storeId}_${date}_${shiftId}`,
            day: dayMap[date].day,
            week: dayMap[date].week,
            date,
            shiftName: shift.name || '班次',
            time: shift.time || '',
            storeName: store.name || '未知门店',
            isPast: date < todayStr
          });
        });
      });
    });
    monthSchedule.sort((a, b) => a.date.localeCompare(b.date));
    const visibleSchedule = filterSchedule(monthSchedule, this.data.rangeValue, now);
    this.setData({
      allSchedule: monthSchedule,
      visibleSchedule
    });
  },

  selectRange(event) {
    const rangeIndex = Number(event.detail.value);
    const option = rangeOptions[rangeIndex] || rangeOptions[2];
    const visibleSchedule = filterSchedule(this.data.allSchedule, option.value, new Date());
    wx.setNavigationBarTitle({ title: option.label });
    this.setData({
      rangeIndex,
      rangeValue: option.value,
      rangeLabel: option.label,
      visibleSchedule
    });
  }
});
