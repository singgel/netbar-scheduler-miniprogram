const {
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
  getStore,
  setStore,
  saveStore
} = require('../../utils/store');
const { getMonthDays, monthLabel, formatDate } = require('../../utils/date');
const { generateMonthSchedule, staffNameMap } = require('../../utils/scheduler');
const { isAdminSideRole, getVisibleStoresForRole, getScopedCurrentStoreId, normalizeRole, syncTabBar } = require('../../utils/role');
const { sortShiftsByStartTime } = require('../../utils/shifts');

function staffStoreIds(staff, fallbackStoreId) {
  if (staff.storeIds && staff.storeIds.length) return staff.storeIds;
  if (staff.storeId) return [staff.storeId];
  return fallbackStoreId ? [fallbackStoreId] : [];
}

function isSchedulableStaff(staff, relationMap) {
  const relation = relationMap[staff.id] || {};
  return normalizeRole(relation.role || staff.role) !== 'super_admin';
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day; // 周一为一周起点
  return addDays(next, diff);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// 计算某周期窗口的起止日期（含）
function periodRange(date, period) {
  const base = date instanceof Date ? date : new Date(date);
  if (period === 'day') return { start: base, end: base };
  if (period === 'week') return { start: startOfWeek(base), end: endOfWeek(base) };
  return { start: startOfMonth(base), end: endOfMonth(base) };
}

function rangeLabel(start, end, period) {
  if (period === 'day') return formatDate(start);
  if (period === 'week') return `${formatDate(start)} ~ ${formatDate(end)}`;
  return monthLabel(start.getFullYear(), start.getMonth() + 1);
}

Page({
  data: {
    year: 2026,
    month: 6,
    monthText: '',
    monthShortText: '',
    staff: [],
    storeStaff: [],
    shifts: [],
    rows: [],
    role: 'manager',
    canManage: true,
    canAutoSchedule: true,
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
    staffOptions: [],
    printVisible: false,
    printTempPath: '',
    printSaving: false,
    activeTab: 'schedule',
    recordPeriod: 'day',
    recordDate: '',
    recordRangeText: '',
    recordList: [],
    recordEmptyText: ''
  },

  onLoad() {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      recordDate: formatDate(now)
    });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const staff = getStore(STAFF_KEY, []);
    const stores = getStore(STORE_KEY, []);
    const shifts = sortShiftsByStartTime(getStore(SHIFT_KEY, []));
    const schedule = getStore(SCHEDULE_KEY, {});
    const relations = getStore(STAFF_ROLE_RELATION_KEY, []);
    const role = getStore(ROLE_KEY, 'manager');
    const canManage = isAdminSideRole(role);
    const employeeAuth = getStore(EMPLOYEE_AUTH_KEY, {});
    const currentStaffId = getStore(CURRENT_STAFF_KEY, staff[0] ? staff[0].id : '');
    const storedStoreId = getStore(CURRENT_STORE_KEY, stores[0] ? stores[0].id : '');
    const visibleStores = getVisibleStoresForRole(role, stores, currentStaffId);
    const currentStoreId = getScopedCurrentStoreId(role, stores, storedStoreId, currentStaffId);
    if (currentStoreId && currentStoreId !== storedStoreId) {
      setStore(CURRENT_STORE_KEY, currentStoreId);
    }
    const currentStore = visibleStores.find((item) => item.id === currentStoreId) || {};
    const currentStaff = staff.find((item) => item.id === currentStaffId) || {};
    const employeeReady = canManage || !!(employeeAuth.bound && currentStaff.id && (employeeAuth.phone || employeeAuth.phoneCode || employeeAuth.manualPhone));
    const days = getMonthDays(this.data.year, this.data.month);
    const names = staffNameMap(staff);
    const storeSchedule = schedule[currentStoreId] || {};
    const activeStaff = staff.filter((item) => item.status !== 'left');
    const relationMap = relations.reduce((map, item) => {
      if (item.staffId) map[item.staffId] = item;
      return map;
    }, {});
    const storeStaff = activeStaff
      .filter((item) => staffStoreIds(item, currentStoreId).indexOf(currentStoreId) >= 0)
      .filter((item) => isSchedulableStaff(item, relationMap));
    const schedulableStaffIdMap = storeStaff.reduce((map, item) => {
      map[item.id] = true;
      return map;
    }, {});
    // 打卡索引：${date}|${shiftId}|${staffId} -> 是否有上班打卡
    const attendance = getStore(ATTENDANCE_KEY, []);
    const clockedIn = {};
    attendance.forEach((item) => {
      if (item && item.clockIn && item.date && item.shiftId && item.staffId) {
        clockedIn[`${item.date}|${item.shiftId}|${item.staffId}`] = true;
      }
    });
    const today = formatDate(new Date());
    // 将排班员工 id 列表映射为带打卡状态的 nameItems；仅过去日期显示状态
    const buildNameItems = (ids, date, shiftId) => ids.map((id) => {
      const isPast = date < today;
      let status = '';
      if (isPast) {
        status = clockedIn[`${date}|${shiftId}|${id}`] ? 'checkedIn' : 'absent';
      }
      return { id, name: names[id] || '未知员工', status };
    });
    const rows = days.map((day) => {
      let visibleShifts = [];
      if (canManage) {
        const daySchedule = storeSchedule[day.date] || {};
        visibleShifts = shifts.map((shift) => {
          const ids = (daySchedule[shift.id] || []).filter((id) => schedulableStaffIdMap[id]);
          return {
            ...shift,
            names: ids.map((id) => names[id] || '未知员工'),
            nameItems: buildNameItems(ids, day.date, shift.id),
            isMine: ids.indexOf(currentStaffId) >= 0
          };
        });
      } else {
        visibleStores.forEach((store) => {
          const daySchedule = ((schedule[store.id] || {})[day.date]) || {};
          shifts.forEach((shift) => {
            const ids = daySchedule[shift.id] || [];
            if (!ids.length) return;
            visibleShifts.push({
              ...shift,
              name: `${store.name} · ${shift.name}`,
              names: ids.map((id) => names[id] || '未知员工'),
              nameItems: buildNameItems(ids, day.date, shift.id),
              isMine: ids.indexOf(currentStaffId) >= 0
            });
          });
        });
      }
      const hasAssigned = visibleShifts.some((shift) => shift.names && shift.names.length);
      return {
        ...day,
        shifts: visibleShifts,
        hasMine: visibleShifts.some((shift) => shift.isMine),
        hasAssigned,
        hasStoreSchedule: canManage ? hasAssigned : visibleShifts.length > 0
      };
    }).filter((day) => canManage || day.hasStoreSchedule);

    wx.setNavigationBarTitle({
      title: currentStore.name || '班表'
    });
    // 仅本月及以后的月份允许生成班表；过去月份只读展示
    const nowDate = new Date();
    const canAutoSchedule = this.data.year > nowDate.getFullYear()
      || (this.data.year === nowDate.getFullYear() && this.data.month >= nowDate.getMonth() + 1);
    this.setData({
      staff,
      storeStaff,
      shifts,
      stores: visibleStores,
      currentStoreId,
      currentStoreName: currentStore.name || '',
      role,
      canManage,
      canAutoSchedule,
      currentStaffId,
      currentStaffName: currentStaff.name || '',
      employeeReady,
      schedule,
      rows,
      monthText: monthLabel(this.data.year, this.data.month),
      monthShortText: monthLabel(this.data.year, this.data.month)
    }, () => {
      syncTabBar(this);
      if (this.data.activeTab === 'records') {
        this.refreshRecords();
      }
    });
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab }, () => {
      if (tab === 'records') this.refreshRecords();
    });
  },

  switchRecordPeriod(event) {
    const period = event.currentTarget.dataset.period;
    if (!period || period === this.data.recordPeriod) return;
    this.setData({ recordPeriod: period }, () => this.refreshRecords());
  },

  prevRecordRange() {
    const period = this.data.recordPeriod;
    const base = new Date(this.data.recordDate);
    let next;
    if (period === 'day') next = addDays(base, -1);
    else if (period === 'week') next = addDays(base, -7);
    else next = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    this.setData({ recordDate: formatDate(next) }, () => this.refreshRecords());
  },

  nextRecordRange() {
    const period = this.data.recordPeriod;
    const base = new Date(this.data.recordDate);
    let next;
    if (period === 'day') next = addDays(base, 1);
    else if (period === 'week') next = addDays(base, 7);
    else next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    this.setData({ recordDate: formatDate(next) }, () => this.refreshRecords());
  },

  refreshRecords() {
    const period = this.data.recordPeriod;
    const base = new Date(this.data.recordDate || formatDate(new Date()));
    const { start, end } = periodRange(base, period);
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const allRecords = getStore(ATTENDANCE_KEY, []);
    const staff = getStore(STAFF_KEY, []);
    const shifts = getStore(SHIFT_KEY, []);
    const stores = getStore(STORE_KEY, []);
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
    const currentStoreId = this.data.currentStoreId;
    const list = allRecords
      .filter((item) => item && item.date >= startStr && item.date <= endStr)
      .filter((item) => item.storeId === currentStoreId)
      .map((item) => ({
        ...item,
        staffName: staffMap[item.staffId] || '未知员工',
        shiftName: shiftMap[item.shiftId] || '未知班次',
        storeName: item.storeName || storeMap[item.storeId] || '未匹配门店'
      }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (a.clockIn || '').localeCompare(b.clockIn || '');
      });
    this.setData({
      recordList: list,
      recordRangeText: rangeLabel(start, end, period),
      recordEmptyText: list.length ? '' : `${startStr === endStr ? startStr : `${startStr} ~ ${endStr}`} 暂无打卡记录`
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
    if (!this.data.canManage) return;
    if (!this.data.canAutoSchedule) {
      wx.showToast({ title: '过去月份不可生成班表', icon: 'none' });
      return;
    }
    if (!this.data.storeStaff.length) {
      wx.showModal({
        title: '无可排班员工',
        content: '当前门店没有可排班员工（店长/普通员工）。请先在员工管理中添加本门店员工，超管不参与排班。',
        showCancel: false
      });
      return;
    }
    if (!this.data.shifts.length) {
      wx.showToast({ title: '请先配置班次', icon: 'none' });
      return;
    }
    const days = getMonthDays(this.data.year, this.data.month);
    const monthSchedule = generateMonthSchedule(days, this.data.shifts, this.data.storeStaff);
    const next = {
      ...this.data.schedule,
      [this.data.currentStoreId]: {
        ...(this.data.schedule[this.data.currentStoreId] || {}),
        ...monthSchedule
      }
    };
    wx.showLoading({ title: '保存中' });
    saveStore(SCHEDULE_KEY, next)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已生成安排', icon: 'success' });
        this.refresh();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存到数据库失败', icon: 'none' });
      });
  },

  clearMonth() {
    if (!this.data.canManage) return;
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
        wx.showLoading({ title: '保存中' });
        saveStore(SCHEDULE_KEY, next)
          .then(() => {
            wx.hideLoading();
            this.refresh();
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '保存到数据库失败', icon: 'none' });
          });
      }
    });
  },

  openPicker(event) {
    if (!this.data.canManage) return;
    const { date, shift } = event.currentTarget.dataset;
    const storeSchedule = this.data.schedule[this.data.currentStoreId] || {};
    const validStaffIds = this.data.storeStaff.reduce((map, item) => {
      map[item.id] = true;
      return map;
    }, {});
    const activeStaffIds = ((storeSchedule[date] || {})[shift] || []).filter((id) => validStaffIds[id]);
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
    wx.showLoading({ title: '保存中' });
    saveStore(SCHEDULE_KEY, schedule)
      .then(() => {
        wx.hideLoading();
        this.setData({ pickerVisible: false });
        this.refresh();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存到数据库失败', icon: 'none' });
      });
  },

  printSchedule() {
    if (!this.data.canManage) return;
    if (!this.data.rows.length) {
      wx.showToast({ title: '本月暂无排班', icon: 'none' });
      return;
    }
    this.setData({ printVisible: true }, () => {
      wx.nextTick(() => this.renderPrintCanvas());
    });
  },

  renderPrintCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#printCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.showToast({ title: '画布初始化失败', icon: 'none' });
          this.setData({ printVisible: false });
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        const cssWidth = 1123;
        const cssHeight = 794;
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
        ctx.scale(dpr, dpr);
        this.drawSchedule(ctx, cssWidth, cssHeight);
        wx.canvasToTempFilePath({
          canvas,
          success: (out) => {
            this.setData({ printTempPath: out.tempFilePath });
          },
          fail: () => {
            wx.showToast({ title: '渲染失败', icon: 'none' });
            this.setData({ printVisible: false });
          }
        }, this);
      });
  },

  drawSchedule(ctx, width, height) {
    const { rows, shifts, monthText, currentStoreName, currentStaffName } = this.data;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const margin = 36;
    // ---- 标题区 ----
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f2329';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${currentStoreName || ''} 排班表`, margin, margin);

    ctx.fillStyle = '#646a73';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${monthText}${currentStaffName ? ` · 当班人：${currentStaffName}` : ''}`, margin, margin + 30);

    ctx.fillStyle = '#8a8f99';
    ctx.font = '12px sans-serif';
    const now = new Date();
    const printedAt = `打印时间：${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeWidth = ctx.measureText(printedAt).width;
    ctx.fillText(printedAt, width - margin - timeWidth, margin + 6);

    // ---- 月历网格 ----
    const gridTop = margin + 64;
    const gridWidth = width - margin * 2;
    const headerH = 30;
    const cols = 7;
    const colWidth = gridWidth / cols;
    const weekHeaders = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    // 星期表头
    ctx.fillStyle = '#f2f3f5';
    ctx.fillRect(margin, gridTop, gridWidth, headerH);
    ctx.fillStyle = '#646a73';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    weekHeaders.forEach((w, i) => {
      ctx.fillText(w, margin + colWidth * i + colWidth / 2, gridTop + 9);
    });
    ctx.textAlign = 'left';

    // 计算前置空格与行数
    const firstDay = rows.length ? new Date(this.data.year, this.data.month - 1, 1) : new Date();
    const leading = firstDay.getDay(); // 0=周日
    const totalCells = leading + rows.length;
    const rowCount = Math.ceil(totalCells / cols);
    const gridBodyTop = gridTop + headerH;
    const gridBodyHeight = height - gridBodyTop - margin;
    const rowHeight = gridBodyHeight / rowCount;

    // 单元格
    ctx.textBaseline = 'top';
    let cellIndex = 0;
    // 前置空格
    for (let i = 0; i < leading; i += 1) {
      this.drawCalendarCell(ctx, null, margin, gridBodyTop, colWidth, rowHeight, i);
      cellIndex += 1;
    }
    // 实际日期
    rows.forEach((day) => {
      this.drawCalendarCell(ctx, day, margin, gridBodyTop, colWidth, rowHeight, cellIndex);
      cellIndex += 1;
    });

    // 网格线
    ctx.strokeStyle = '#e5e6eb';
    ctx.lineWidth = 1;
    for (let r = 0; r <= rowCount; r += 1) {
      const ly = gridBodyTop + rowHeight * r;
      ctx.beginPath();
      ctx.moveTo(margin, ly);
      ctx.lineTo(margin + gridWidth, ly);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c += 1) {
      const lx = margin + colWidth * c;
      ctx.beginPath();
      ctx.moveTo(lx, gridBodyTop);
      ctx.lineTo(lx, gridBodyTop + rowHeight * rowCount);
      ctx.stroke();
    }

    // 图例
    const legendY = gridBodyTop + rowHeight * rowCount + 10;
    if (legendY < height - 8) {
      let legendX = margin;
      ctx.fillStyle = '#8a8f99';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('图例：', legendX, legendY);
      legendX += 42;
      shifts.forEach((shift) => {
        ctx.fillStyle = shift.color || '#eaf6ff';
        ctx.beginPath();
        ctx.arc(legendX + 5, legendY + 7, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#646a73';
        ctx.fillText(shift.name, legendX + 16, legendY);
        legendX += 16 + ctx.measureText(shift.name).width + 24;
      });
    }
  },

  drawCalendarCell(ctx, day, originX, originY, colWidth, rowHeight, cellIndex) {
    const col = cellIndex % 7;
    const row = Math.floor(cellIndex / 7);
    const x = originX + colWidth * col;
    const y = originY + rowHeight * row;

    if (!day) return; // 空白前置格

    const pad = 8;
    // 日期数字（右上）
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillStyle = day.isWeekend ? '#e64340' : '#1f2329';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(String(day.day), x + colWidth - pad, y + pad);

    // 班次列表
    ctx.textAlign = 'left';
    const shifts = (day.shifts || []).filter((s) => s.names && s.names.length);
    let itemY = y + pad + 22;
    const maxBottom = y + rowHeight - pad;
    const lineH = 14;
    shifts.forEach((shift) => {
      if (itemY + lineH > maxBottom) return;
      // 彩色圆点
      ctx.fillStyle = shift.color || '#eaf6ff';
      ctx.beginPath();
      ctx.arc(x + pad + 4, itemY + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      // 班次名（加粗）
      const people = shift.names.join('、');
      const textX = x + pad + 14;
      const maxWidth = colWidth - pad * 2 - 14;
      ctx.fillStyle = '#1f2329';
      ctx.font = 'bold 11px sans-serif';
      const nameText = `${shift.name} `;
      ctx.fillText(nameText, textX, itemY);
      // 人员（普通字重）
      const nameW = ctx.measureText(nameText).width;
      ctx.fillStyle = '#343842';
      ctx.font = '11px sans-serif';
      this.drawWrapText(ctx, people, textX + nameW, itemY, maxWidth - nameW, lineH);
      itemY += lineH;
    });
  },

  drawWrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = String(text || '').split('');
    let line = '';
    let lineY = y;
    for (let i = 0; i < chars.length; i += 1) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, lineY);
        line = chars[i];
        lineY += lineHeight;
        if (lineY > y + lineHeight) break;
      } else {
        line = test;
      }
    }
    if (line && lineY <= y + lineHeight) {
      ctx.fillText(line, x, lineY);
    }
  },

  closePrint() {
    this.setData({ printVisible: false, printTempPath: '' });
  },

  previewPrintImage() {
    if (!this.data.printTempPath) return;
    wx.previewImage({
      current: this.data.printTempPath,
      urls: [this.data.printTempPath]
    });
  },

  savePrintImage() {
    if (!this.data.printTempPath || this.data.printSaving) return;
    this.setData({ printSaving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.printTempPath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting();
            }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
      complete: () => {
        this.setData({ printSaving: false });
      }
    });
  }
});
