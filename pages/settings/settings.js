const {
  SHIFT_KEY,
  SCHEDULE_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  getStore,
  setStore,
  saveStore,
  saveStores,
  syncStoreFromBackend
} = require('../../utils/store');
const { isAdminSideRole, isSuperAdminRole, getVisibleStoresForRole, getScopedCurrentStoreId, syncTabBar } = require('../../utils/role');
const { buildShiftTime, currentTime, sortShiftsByStartTime } = require('../../utils/shifts');

function emptyShiftForm() {
  return {
    name: '',
    startTime: currentTime(),
    endTime: currentTime()
  };
}

Page({
  data: {
    role: 'manager',
    canManage: true,
    isSuperAdmin: false,
    activeSettingsTab: 'store',
    shifts: [],
    stores: [],
    currentStoreId: '',
    storeForm: {
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      checkinRadius: ''
    },
    shiftForm: emptyShiftForm()
  },

  onShow() {
    this.refresh();
    syncStoreFromBackend()
      .then(() => this.refresh())
      .catch(() => {});
  },

  refresh() {
    const role = getStore(ROLE_KEY, 'manager');
    const canManage = isAdminSideRole(role);
    const isSuperAdmin = isSuperAdminRole(role);
    const allStores = getStore(STORE_KEY, []);
    const currentStaffId = getStore(CURRENT_STAFF_KEY, '');
    const storedStoreId = getStore(CURRENT_STORE_KEY, allStores[0] ? allStores[0].id : '');
    const currentStoreId = getScopedCurrentStoreId(role, allStores, storedStoreId, currentStaffId);
    if (currentStoreId && currentStoreId !== storedStoreId) {
      setStore(CURRENT_STORE_KEY, currentStoreId);
    }
    this.setData({
      role,
      canManage,
      isSuperAdmin,
      shifts: sortShiftsByStartTime(getStore(SHIFT_KEY, [])),
      stores: getVisibleStoresForRole(role, allStores, currentStaffId),
      currentStoreId
    }, () => syncTabBar(this));
  },

  switchSettingsTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeSettingsTab) return;
    this.setData({ activeSettingsTab: tab });
  },

  onStoreInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`storeForm.${field}`]: event.detail.value
    });
  },

  chooseStoreLocation() {
    if (!this.data.isSuperAdmin) return;
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'storeForm.name': this.data.storeForm.name || res.name,
          'storeForm.address': res.address,
          'storeForm.latitude': String(res.latitude),
          'storeForm.longitude': String(res.longitude)
        });
      },
      fail: () => {
        wx.showToast({ title: '未选择位置', icon: 'none' });
      }
    });
  },

  addStore() {
    if (!this.data.isSuperAdmin) return;
    const { name, address, latitude, longitude, checkinRadius } = this.data.storeForm;
    if (!name.trim() || !latitude || !longitude) {
      wx.showToast({ title: '请填写门店和坐标', icon: 'none' });
      return;
    }
    const next = getStore(STORE_KEY, []).concat({
      id: `store${Date.now()}`,
      name: name.trim(),
      address: address.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      checkinRadius: Number(checkinRadius) || 200,
      status: 'active'
    });
    wx.showLoading({ title: '保存中' });
    saveStore(STORE_KEY, next)
      .then(() => {
        wx.hideLoading();
        this.setData({
          storeForm: {
            name: '',
            address: '',
            latitude: '',
            longitude: '',
            checkinRadius: ''
          }
        });
        wx.showToast({ title: '已保存', icon: 'success' });
        this.refresh();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存到数据库失败', icon: 'none' });
      });
  },

  useStore(event) {
    if (!this.data.isSuperAdmin) return;
    const id = event.currentTarget.dataset.id;
    setStore(CURRENT_STORE_KEY, id);
    this.refresh();
  },

  deleteStore(event) {
    if (!this.data.isSuperAdmin) return;
    const id = event.currentTarget.dataset.id;
    if (this.data.stores.length <= 1) {
      wx.showToast({ title: '至少保留一个门店', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除门店',
      content: '删除后不会删除历史打卡记录，但新班表不再使用该门店。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        const stores = getStore(STORE_KEY, []).filter((item) => item.id !== id);
        wx.showLoading({ title: '保存中' });
        saveStore(STORE_KEY, stores)
          .then(() => {
            wx.hideLoading();
            if (this.data.currentStoreId === id) {
              setStore(CURRENT_STORE_KEY, stores[0].id);
            }
            this.refresh();
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '保存到数据库失败', icon: 'none' });
          });
      }
    });
  },

  changeNeed(event) {
    if (!this.data.isSuperAdmin) return;
    const { id, delta } = event.currentTarget.dataset;
    const shifts = sortShiftsByStartTime(this.data.shifts.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        need: Math.max(1, item.need + Number(delta))
      };
    }));
    saveStore(SHIFT_KEY, shifts).catch(() => {
      wx.showToast({ title: '班次保存失败', icon: 'none' });
    });
    this.setData({ shifts });
  },

  changeShiftTime(event) {
    if (!this.data.isSuperAdmin) return;
    const { id, field } = event.currentTarget.dataset;
    const value = event.detail.value || '00:00';
    const shifts = sortShiftsByStartTime(this.data.shifts.map((item) => {
      if (item.id !== id) return item;
      const startTime = field === 'startTime' ? value : item.startTime;
      const endTime = field === 'endTime' ? value : item.endTime;
      return {
        ...item,
        startTime,
        endTime,
        time: buildShiftTime(startTime, endTime)
      };
    }));
    saveStore(SHIFT_KEY, shifts).catch(() => {
      wx.showToast({ title: '班次保存失败', icon: 'none' });
    });
    this.setData({ shifts });
  },

  onShiftFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`shiftForm.${field}`]: event.detail.value
    });
  },

  selectShiftFormTime(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`shiftForm.${field}`]: event.detail.value || currentTime()
    });
  },

  addShift() {
    if (!this.data.isSuperAdmin) return;
    const { name, startTime, endTime } = this.data.shiftForm;
    if (!name.trim()) {
      wx.showToast({ title: '请输入班次名称', icon: 'none' });
      return;
    }
    const next = sortShiftsByStartTime(getStore(SHIFT_KEY, []).concat({
      id: `shift_${Date.now()}`,
      name: name.trim(),
      time: buildShiftTime(startTime, endTime),
      need: 1,
      color: '#eef6ff'
    }));
    wx.showLoading({ title: '保存中' });
    saveStore(SHIFT_KEY, next)
      .then(() => {
        wx.hideLoading();
        this.setData({
          shifts: next,
          shiftForm: emptyShiftForm()
        });
        wx.showToast({ title: '已新增班次', icon: 'success' });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存到数据库失败', icon: 'none' });
      });
  },

  deleteShift(event) {
    if (!this.data.isSuperAdmin) return;
    const id = event.currentTarget.dataset.id;
    const shift = this.data.shifts.find((item) => item.id === id) || {};
    wx.showModal({
      title: '删除班次',
      content: `确定删除${shift.name || '该班次'}？已有排班里的这个班次也会同步移除。`,
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        const shifts = sortShiftsByStartTime(getStore(SHIFT_KEY, []).filter((item) => item.id !== id));
        const schedule = { ...getStore(SCHEDULE_KEY, {}) };
        Object.keys(schedule).forEach((storeId) => {
          const storeSchedule = { ...(schedule[storeId] || {}) };
          Object.keys(storeSchedule).forEach((date) => {
            const day = { ...(storeSchedule[date] || {}) };
            delete day[id];
            storeSchedule[date] = day;
          });
          schedule[storeId] = storeSchedule;
        });
        wx.showLoading({ title: '保存中' });
        saveStores({
          [SHIFT_KEY]: shifts,
          [SCHEDULE_KEY]: schedule
        })
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
  }
});
