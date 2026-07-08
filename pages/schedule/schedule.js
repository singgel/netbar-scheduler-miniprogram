const {
  STAFF_KEY,
  STAFF_ROLE_RELATION_KEY,
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
    printSaving: false
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
    const rows = days.map((day) => {
      let visibleShifts = [];
      if (canManage) {
        const daySchedule = storeSchedule[day.date] || {};
        visibleShifts = shifts.map((shift) => {
          const ids = (daySchedule[shift.id] || []).filter((id) => schedulableStaffIdMap[id]);
          return {
            ...shift,
            names: ids.map((id) => names[id] || '未知员工'),
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
    this.setData({
      staff,
      storeStaff,
      shifts,
      stores: visibleStores,
      currentStoreId,
      currentStoreName: currentStore.name || '',
      role,
      canManage,
      currentStaffId,
      currentStaffName: currentStaff.name || '',
      employeeReady,
      schedule,
      rows,
      monthText: monthLabel(this.data.year, this.data.month),
      monthShortText: `${this.data.month}月`
    }, () => syncTabBar(this));
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
        setStore(SCHEDULE_KEY, next);
        this.refresh();
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
    setStore(SCHEDULE_KEY, schedule);
    this.setData({ pickerVisible: false });
    this.refresh();
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
    const names = staffNameMap(this.data.staff);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const margin = 36;
    let y = margin;

    ctx.fillStyle = '#1f2329';
    ctx.font = 'bold 22px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`${currentStoreName || ''} 排班表`, margin, y);

    ctx.fillStyle = '#646a73';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${monthText}${currentStaffName ? ` · 当班人：${currentStaffName}` : ''}`, margin, y + 30);

    ctx.fillStyle = '#8a8f99';
    ctx.font = '12px sans-serif';
    const now = new Date();
    const printedAt = `打印时间：${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeWidth = ctx.measureText(printedAt).width;
    ctx.fillText(printedAt, width - margin - timeWidth, y + 6);
    y += 58;

    const tableWidth = width - margin * 2;
    const dateColWidth = 78;
    const shiftColWidth = (tableWidth - dateColWidth) / shifts.length;
    const rowHeight = Math.max(34, Math.min(46, (height - y - margin - 24) / rows.length));

    const tableTop = y;
    ctx.lineWidth = 1;

    ctx.fillStyle = '#f2f6ff';
    ctx.fillRect(margin, tableTop, tableWidth, rowHeight);

    ctx.strokeStyle = '#d6dbe0';
    ctx.beginPath();
    ctx.moveTo(margin, tableTop);
    ctx.lineTo(margin + tableWidth, tableTop);
    ctx.stroke();

    let colX = margin;
    ctx.fillStyle = '#1f2329';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('日期', colX + 10, tableTop + 11);
    colX += dateColWidth;
    shifts.forEach((shift) => {
      ctx.fillStyle = shift.color || '#eaf6ff';
      ctx.fillRect(colX + 1, tableTop + 1, shiftColWidth - 2, rowHeight - 2);
      ctx.fillStyle = '#1f2329';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${shift.name} ${shift.time || ''}`, colX + 8, tableTop + 6);
      ctx.fillStyle = '#8a8f99';
      ctx.font = '11px sans-serif';
      ctx.fillText(`需 ${shift.need || 0} 人`, colX + 8, tableTop + 22);
      colX += shiftColWidth;
    });

    ctx.strokeStyle = '#d6dbe0';
    ctx.beginPath();
    ctx.moveTo(margin, tableTop + rowHeight);
    ctx.lineTo(margin + tableWidth, tableTop + rowHeight);
    ctx.stroke();

    let rowY = tableTop + rowHeight;
    rows.forEach((day, index) => {
      const isAlt = index % 2 === 1;
      ctx.fillStyle = isAlt ? '#fafbfc' : '#ffffff';
      ctx.fillRect(margin, rowY, tableWidth, rowHeight);

      let cellX = margin;
      ctx.fillStyle = day.isWeekend ? '#c0392b' : '#1f2329';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${day.day}日`, cellX + 10, rowY + 6);
      ctx.fillStyle = '#8a8f99';
      ctx.font = '11px sans-serif';
      ctx.fillText(day.week || '', cellX + 10, rowY + 22);
      cellX += dateColWidth;

      shifts.forEach((shift) => {
        const dayShifts = day.shifts || [];
        const matched = dayShifts.find((item) => item.id === shift.id);
        const ids = matched ? (matched.names || []) : [];
        ctx.fillStyle = shift.color || '#eaf6ff';
        if (ids.length) {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(cellX + 1, rowY + 1, shiftColWidth - 2, rowHeight - 2);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#343842';
        ctx.font = '11px sans-serif';
        const text = ids.length ? ids.map((id) => names[id] || id).join('、') : '—';
        this.drawWrapText(ctx, text, cellX + 8, rowY + 8, shiftColWidth - 16, 13);
        cellX += shiftColWidth;
      });

      ctx.strokeStyle = '#e5e6eb';
      ctx.beginPath();
      ctx.moveTo(margin, rowY + rowHeight);
      ctx.lineTo(margin + tableWidth, rowY + rowHeight);
      ctx.stroke();
      rowY += rowHeight;
    });

    ctx.strokeStyle = '#d6dbe0';
    colX = margin + dateColWidth;
    shifts.forEach(() => {
      ctx.beginPath();
      ctx.moveTo(colX, tableTop);
      ctx.lineTo(colX, rowY);
      ctx.stroke();
      colX += shiftColWidth;
    });
    ctx.beginPath();
    ctx.moveTo(margin, tableTop);
    ctx.lineTo(margin, rowY);
    ctx.moveTo(margin + tableWidth, tableTop);
    ctx.lineTo(margin + tableWidth, rowY);
    ctx.stroke();

    ctx.fillStyle = '#8a8f99';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    const legendY = rowY + 14;
    let legendX = margin;
    ctx.fillText('图例：', legendX, legendY);
    legendX += 42;
    shifts.forEach((shift) => {
      ctx.fillStyle = shift.color || '#eaf6ff';
      ctx.fillRect(legendX, legendY + 2, 14, 12);
      ctx.strokeStyle = '#d6dbe0';
      ctx.strokeRect(legendX, legendY + 2, 14, 12);
      ctx.fillStyle = '#646a73';
      ctx.font = '11px sans-serif';
      ctx.fillText(shift.name, legendX + 20, legendY + 2);
      legendX += 20 + ctx.measureText(shift.name).width + 24;
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
