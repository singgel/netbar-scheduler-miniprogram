const {
  STAFF_KEY,
  SHIFT_KEY,
  SCHEDULE_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  INVITE_CODE_KEY,
  STORE_KEY,
  getStore,
  setStore
} = require('../../utils/store');
const { API_BASE } = require('../../utils/config');
const { getMonthDays } = require('../../utils/date');
const { syncRoleFromAuth, isSuperAdminRole, isManagerRole, getVisibleStoresForRole, syncTabBar } = require('../../utils/role');

function roleText(role) {
  if (isSuperAdminRole(role)) return '超级管理员';
  if (isManagerRole(role)) return '店长';
  return '普通员工';
}

function firstChar(value, fallback) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1) : fallback;
}

Page({
  data: {
    staff: {},
    roleText: '普通员工',
    phoneText: '未填写手机号',
    profileInitial: '我',
    avatarUrl: '',
    storeCards: [],
    monthSchedule: [],
    storeSummary: '暂无门店信息',
    scheduleSummary: '本月暂无排班'
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
    const role = syncRoleFromAuth(auth);
    const currentStaffId = auth.staffId || getStore(CURRENT_STAFF_KEY, '');
    const staff = staffList.find((item) => item.id === currentStaffId) || {};
    const phoneText = auth.phone || auth.manualPhone || staff.phone || '未填写手机号';
    const visibleStores = currentStaffId ? getVisibleStoresForRole(role, stores, currentStaffId) : [];
    const storeCards = visibleStores.map((store) => ({
      ...store,
      nameInitial: firstChar(store.name, '店')
    }));
    const shiftMap = shifts.reduce((map, shift) => {
      map[shift.id] = shift;
      return map;
    }, {});
    const storeMap = stores.reduce((map, store) => {
      map[store.id] = store;
      return map;
    }, {});
    const now = new Date();
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
          if (staffIds.indexOf(currentStaffId) < 0) return;
          const shift = shiftMap[shiftId] || {};
          const store = storeMap[storeId] || {};
          monthSchedule.push({
            key: `${storeId}_${date}_${shiftId}`,
            day: dayMap[date].day,
            week: dayMap[date].week,
            date,
            shiftName: shift.name || '班次',
            time: shift.time || '',
            storeName: store.name || '未知门店'
          });
        });
      });
    });
    monthSchedule.sort((a, b) => a.date.localeCompare(b.date));

    this.setData({
      staff,
      roleText: roleText(role),
      phoneText,
      profileInitial: firstChar(staff.name || auth.nickname, '我'),
      avatarUrl: staff.avatarUrl || auth.avatarUrl || '',
      storeCards,
      monthSchedule,
      storeSummary: storeCards.length ? `${storeCards[0].name}${storeCards.length > 1 ? ` 等 ${storeCards.length} 家门店` : ''}` : '暂无门店信息',
      scheduleSummary: monthSchedule.length ? `${monthSchedule.length} 个班次` : '本月暂无排班'
    }, () => syncTabBar(this));
  },

  openProfileDetail() {
    wx.navigateTo({ url: '/pages/mine/profile/profile' });
  },

  openStoresDetail() {
    wx.navigateTo({ url: '/pages/mine/stores/stores' });
  },

  openScheduleDetail() {
    wx.navigateTo({ url: '/pages/mine/schedule/schedule' });
  },

  chooseAvatar() {
    if (!this.data.staff || !this.data.staff.id) {
      wx.showToast({ title: '请先登录员工账号', icon: 'none' });
      return;
    }

    const onFile = (filePath) => {
      if (!filePath) return;
      this.prepareAvatarFile(filePath).then((avatarPath) => this.uploadAvatar(avatarPath));
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const file = (res.tempFiles || [])[0] || {};
          onFile(file.tempFilePath);
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => onFile((res.tempFilePaths || [])[0])
    });
  },

  prepareAvatarFile(filePath) {
    return new Promise((resolve) => {
      if (!wx.compressImage) {
        resolve(filePath);
        return;
      }
      wx.compressImage({
        src: filePath,
        quality: 70,
        success: (res) => resolve(res.tempFilePath || filePath),
        fail: () => resolve(filePath)
      });
    });
  },

  uploadAvatar(filePath) {
    if (!API_BASE) {
      this.saveAvatarUrl(filePath);
      return;
    }

    wx.showLoading({ title: '上传中' });
    wx.uploadFile({
      url: `${API_BASE}/api/files/avatar`,
      filePath,
      name: 'file',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode < 200 || res.statusCode >= 300) {
          wx.showToast({ title: '头像上传失败', icon: 'none' });
          return;
        }
        let data = {};
        try {
          data = JSON.parse(res.data || '{}');
        } catch (error) {
          data = {};
        }
        const avatarUrl = data.url || data.path || filePath;
        this.saveAvatarUrl(avatarUrl);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '头像上传失败', icon: 'none' });
      }
    });
  },

  saveAvatarUrl(avatarUrl) {
    const staffId = this.data.staff.id;
    const staffList = getStore(STAFF_KEY, []);
    const nextStaff = staffList.map((item) => (
      item.id === staffId ? { ...item, avatarUrl } : item
    ));
    const auth = getStore(EMPLOYEE_AUTH_KEY, {});
    setStore(STAFF_KEY, nextStaff);
    setStore(EMPLOYEE_AUTH_KEY, {
      ...auth,
      avatarUrl
    });
    wx.showToast({ title: '头像已保存', icon: 'success' });
    this.refresh();
  },

  logout() {
    setStore(EMPLOYEE_AUTH_KEY, {
      nickname: '',
      avatarUrl: '',
      phone: '',
      phoneCode: '',
      manualPhone: '',
      loginCode: getStore(EMPLOYEE_AUTH_KEY, {}).loginCode || '',
      inviteCode: '',
      staffId: '',
      bound: false
    });
    setStore(INVITE_CODE_KEY, '');
    setStore(ROLE_KEY, 'employee');
    wx.showToast({ title: '已退出', icon: 'success' });
    wx.switchTab({ url: '/pages/home/home' });
  }
});
