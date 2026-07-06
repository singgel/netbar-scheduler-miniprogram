const {
  STAFF_KEY,
  STAFF_ROLE_RELATION_KEY,
  SHIFT_KEY,
  SCHEDULE_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  INVITE_CODE_KEY,
  DEBUG_ROLE_SWITCH_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  defaultStaff,
  defaultStaffRoleRelations,
  defaultStores,
  defaultShifts,
  getStore,
  setStore
} = require('../../utils/store');
const { isAdminSideRole, isSuperAdminRole, getVisibleStoresForRole, getScopedCurrentStoreId, syncTabBar } = require('../../utils/role');

Page({
  data: {
    role: 'manager',
    canManage: true,
    isSuperAdmin: false,
    debugRoleSwitch: true,
    shifts: [],
    stores: [],
    currentStoreId: '',
    storeForm: {
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      checkinRadius: ''
    }
  },

  onShow() {
    this.refresh();
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
      debugRoleSwitch: getStore(DEBUG_ROLE_SWITCH_KEY, false),
      shifts: getStore(SHIFT_KEY, []),
      stores: getVisibleStoresForRole(role, allStores, currentStaffId),
      currentStoreId
    }, () => syncTabBar(this));
  },

  toggleDebugRoleSwitch() {
    const next = !this.data.debugRoleSwitch;
    setStore(DEBUG_ROLE_SWITCH_KEY, next);
    this.setData({ debugRoleSwitch: next });
  },

  clearEmployeeBind() {
    wx.showModal({
      title: '清除员工绑定',
      content: '会清除本机员工身份和入职码，便于重新测试扫码入职流程。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        setStore(EMPLOYEE_AUTH_KEY, {
          nickname: '',
          avatarUrl: '',
          phone: '',
          phoneCode: '',
          manualPhone: '',
          loginCode: '',
          inviteCode: '',
          staffId: '',
          bound: false
        });
        setStore(INVITE_CODE_KEY, '');
        setStore(ROLE_KEY, 'employee');
        wx.showToast({ title: '已清除', icon: 'success' });
        this.refresh();
      }
    });
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
    setStore(STORE_KEY, next);
    this.setData({
      storeForm: {
        name: '',
        address: '',
        latitude: '',
        longitude: '',
        checkinRadius: ''
      }
    });
    this.refresh();
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
        setStore(STORE_KEY, stores);
        if (this.data.currentStoreId === id) {
          setStore(CURRENT_STORE_KEY, stores[0].id);
        }
        this.refresh();
      }
    });
  },

  changeNeed(event) {
    if (!this.data.canManage) return;
    const { id, delta } = event.currentTarget.dataset;
    const shifts = this.data.shifts.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        need: Math.max(1, item.need + Number(delta))
      };
    });
    setStore(SHIFT_KEY, shifts);
    this.setData({ shifts });
  },

  resetDemo() {
    if (!this.data.isSuperAdmin) return;
    wx.showModal({
      title: '恢复演示数据',
      content: '员工和班次会恢复默认值，现有班表会保留。',
      success: (res) => {
        if (!res.confirm) return;
        setStore(STAFF_KEY, defaultStaff);
        setStore(STAFF_ROLE_RELATION_KEY, defaultStaffRoleRelations);
        setStore(SHIFT_KEY, defaultShifts);
        setStore(STORE_KEY, defaultStores);
        setStore(CURRENT_STORE_KEY, defaultStores[0].id);
        setStore(INVITE_CODE_KEY, '');
        this.refresh();
      }
    });
  },

  clearAll() {
    if (!this.data.isSuperAdmin) return;
    wx.showModal({
      title: '清空全部班表',
      content: '会删除所有月份的班表数据。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        setStore(SCHEDULE_KEY, {});
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  }
});
