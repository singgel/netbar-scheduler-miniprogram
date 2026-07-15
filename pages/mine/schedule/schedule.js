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

const weekHeaders = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(date.getDate() + offset);
  return next;
}

function mondayFirstIndex(date) {
  return (date.getDay() + 6) % 7;
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

function buildCalendarDays(range, now) {
  if (range === 'week' || range === 'today') {
    const dates = weekRange(now);
    const start = new Date(`${dates.start}T00:00:00`);
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(start, i);
      days.push({
        date: formatDate(date),
        day: date.getDate(),
        week: weekHeaders[mondayFirstIndex(date)],
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    return days;
  }
  return getMonthDays(now.getFullYear(), now.getMonth() + 1);
}

function buildCalendarWeeks(schedule, range, now) {
  const todayStr = formatDate(now);
  const entriesByDate = schedule.reduce((map, item) => {
    if (!map[item.date]) map[item.date] = [];
    map[item.date].push(item);
    return map;
  }, {});
  const days = buildCalendarDays(range, now);
  const cells = days.map((day) => ({
    ...day,
    empty: false,
    isToday: day.date === todayStr,
    isPast: day.date < todayStr,
    entries: entriesByDate[day.date] || []
  }));

  if (range === 'month' && cells.length) {
    const leading = mondayFirstIndex(new Date(`${cells[0].date}T00:00:00`));
    const trailing = (7 - ((leading + cells.length) % 7)) % 7;
    for (let i = 0; i < leading; i += 1) {
      cells.unshift({ key: `leading_${i}`, empty: true, entries: [] });
    }
    for (let i = 0; i < trailing; i += 1) {
      cells.push({ key: `trailing_${i}`, empty: true, entries: [] });
    }
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push({
      key: `week_${i}`,
      days: cells.slice(i, i + 7).map((cell, index) => ({
        key: cell.date || `${cell.key}_${index}`,
        ...cell
      }))
    });
  }
  return weeks;
}

Page({
  data: {
    rangeOptions,
    weekHeaders,
    rangeIndex: 2,
    rangeValue: 'month',
    rangeLabel: '本月排班',
    viewMode: 'list',
    allSchedule: [],
    visibleSchedule: [],
    calendarWeeks: []
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
            color: shift.color || '#e8f8ef',
            storeName: store.name || '未知门店',
            isPast: date < todayStr
          });
        });
      });
    });
    monthSchedule.sort((a, b) => {
      const dateOrder = a.date.localeCompare(b.date);
      if (dateOrder) return dateOrder;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
    const visibleSchedule = filterSchedule(monthSchedule, this.data.rangeValue, now);
    this.setData({
      allSchedule: monthSchedule,
      visibleSchedule,
      calendarWeeks: buildCalendarWeeks(visibleSchedule, this.data.rangeValue, now)
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
      visibleSchedule,
      calendarWeeks: buildCalendarWeeks(visibleSchedule, option.value, new Date())
    });
  },

  switchViewMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!mode || mode === this.data.viewMode) return;
    this.setData({ viewMode: mode });
  }
});
