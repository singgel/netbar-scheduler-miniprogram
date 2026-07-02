const {
  STAFF_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  INVITE_CODE_KEY,
  DEBUG_ROLE_SWITCH_KEY,
  getStore,
  setStore
} = require('../../utils/store');
const { wxLogin, exchangePhoneCode } = require('../../utils/auth');

Page({
  data: {
    role: 'admin',
    staff: [],
    stores: [],
    currentStoreId: '',
    currentStoreIndex: 0,
    currentStoreName: '',
    currentStaffId: '',
    currentStaffIndex: 0,
    currentStaffName: '',
    inviteCode: '',
    inviteMatched: false,
    employeeAuth: {},
    phoneReady: false,
    phoneAuthFailed: false,
    profileReady: false,
    debugRoleSwitch: true,
    canUseEmployeeFeatures: false
  },

  onLoad() {
    this.refreshLoginCode();
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const staff = getStore(STAFF_KEY, []);
    const stores = getStore(STORE_KEY, []);
    const role = getStore(ROLE_KEY, 'admin');
    const debugRoleSwitch = getStore(DEBUG_ROLE_SWITCH_KEY, true);
    const employeeAuth = getStore(EMPLOYEE_AUTH_KEY, {});
    const inviteCode = getStore(INVITE_CODE_KEY, employeeAuth.inviteCode || '');
    const inviteStaff = inviteCode ? staff.find((item) => item.inviteCode === inviteCode && item.status !== 'left') : null;
    const resolvedStaffId = employeeAuth.bound ? employeeAuth.staffId : (inviteStaff ? inviteStaff.id : getStore(CURRENT_STAFF_KEY, staff[0] ? staff[0].id : ''));
    const currentStoreId = getStore(CURRENT_STORE_KEY, stores[0] ? stores[0].id : '');
    const storeIndex = Math.max(0, stores.findIndex((item) => item.id === currentStoreId));
    const currentStore = stores[storeIndex] || {};
    const currentStaffId = resolvedStaffId || '';
    const index = Math.max(0, staff.findIndex((item) => item.id === currentStaffId));
    const currentStaff = staff[index] || {};
    const profileReady = !!(employeeAuth.nickname && employeeAuth.avatarUrl);
    const phoneReady = !!(employeeAuth.phone || employeeAuth.phoneCode || employeeAuth.manualPhone);
    this.setData({
      role,
      staff,
      stores,
      currentStoreId: currentStore.id || '',
      currentStoreIndex: storeIndex,
      currentStoreName: currentStore.name || '',
      currentStaffId: currentStaff.id || '',
      currentStaffIndex: index,
      currentStaffName: currentStaff.name || '',
      inviteCode,
      inviteMatched: !!inviteStaff,
      employeeAuth: {
        nickname: '',
        avatarUrl: '',
        phone: '',
        phoneCode: '',
        manualPhone: '',
        inviteCode,
        staffId: currentStaff.id || '',
        bound: false,
        ...employeeAuth
      },
      profileReady,
      phoneReady,
      phoneAuthFailed: !!employeeAuth.phoneAuthFailed,
      debugRoleSwitch,
      canUseEmployeeFeatures: role === 'admin' || (profileReady && phoneReady && !!currentStaff.id)
    });
  },

  refreshLoginCode() {
    wxLogin()
      .then((loginCode) => {
        const employeeAuth = {
          ...getStore(EMPLOYEE_AUTH_KEY, {}),
          loginCode
        };
        setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
        this.setData({ employeeAuth });
      })
      .catch(() => {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      });
  },

  switchRole(event) {
    const role = event.currentTarget.dataset.role;
    if (!this.data.debugRoleSwitch && role === 'admin' && this.data.employeeAuth.bound) {
      wx.showToast({ title: '当前账号无管理权限', icon: 'none' });
      return;
    }
    setStore(ROLE_KEY, role);
    this.setData({ role }, () => this.refresh());
  },

  enterAdminForTest() {
    setStore(ROLE_KEY, 'admin');
    wx.showToast({ title: '已切到管理端', icon: 'success' });
    this.refresh();
  },

  enterEmployeeForTest() {
    setStore(ROLE_KEY, 'employee');
    wx.showToast({ title: '已切到员工端', icon: 'success' });
    this.refresh();
  },

  selectStaff(event) {
    const index = Number(event.detail.value);
    const staff = this.data.staff[index];
    if (!staff) return;
    setStore(CURRENT_STAFF_KEY, staff.id);
    setStore(EMPLOYEE_AUTH_KEY, {
      ...this.data.employeeAuth,
      staffId: staff.id,
      bound: this.data.profileReady && this.data.phoneReady
    });
    this.setData({
      currentStaffId: staff.id,
      currentStaffIndex: index,
      currentStaffName: staff.name
    }, () => this.refresh());
  },

  onInviteInput(event) {
    const inviteCode = event.detail.value.trim();
    setStore(INVITE_CODE_KEY, inviteCode);
    this.setData({ inviteCode }, () => this.refresh());
  },

  selectStore(event) {
    const index = Number(event.detail.value);
    const store = this.data.stores[index];
    if (!store) return;
    setStore(CURRENT_STORE_KEY, store.id);
    this.setData({
      currentStoreId: store.id,
      currentStoreIndex: index,
      currentStoreName: store.name
    });
  },

  chooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;
    const employeeAuth = {
      ...this.data.employeeAuth,
      avatarUrl
    };
    setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
    this.setData({ employeeAuth }, () => this.refresh());
  },

  onNicknameInput(event) {
    const employeeAuth = {
      ...this.data.employeeAuth,
      nickname: event.detail.value.trim()
    };
    setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
    this.setData({ employeeAuth }, () => this.refresh());
  },

  getPhoneNumber(event) {
    if (event.detail.errMsg !== 'getPhoneNumber:ok') {
      const employeeAuth = {
        ...this.data.employeeAuth,
        phoneAuthFailed: true
      };
      setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
      this.setData({ employeeAuth, phoneAuthFailed: true });
      wx.showToast({ title: '可手动填写手机号', icon: 'none' });
      return;
    }
    const phoneCode = event.detail.code || '';
    const employeeAuth = {
      ...this.data.employeeAuth,
      phoneCode
    };
    setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
    this.setData({ employeeAuth });

    exchangePhoneCode({
      phoneCode,
      loginCode: employeeAuth.loginCode,
      nickname: employeeAuth.nickname,
      avatarUrl: employeeAuth.avatarUrl
    })
      .then((result) => {
        const nextAuth = {
          ...getStore(EMPLOYEE_AUTH_KEY, {}),
          phone: result.phone || '',
          staffId: result.staffId || this.data.currentStaffId,
          phoneAuthFailed: false,
          bound: true
        };
        if (result.staffId) {
          setStore(CURRENT_STAFF_KEY, result.staffId);
        }
        setStore(EMPLOYEE_AUTH_KEY, nextAuth);
        wx.showToast({ title: result.phone ? '手机号已绑定' : '已授权手机号', icon: 'success' });
        this.refresh();
      })
      .catch(() => {
        const employeeAuth = {
          ...getStore(EMPLOYEE_AUTH_KEY, {}),
          phoneAuthFailed: true
        };
        setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
        wx.showToast({ title: '可手动填写手机号', icon: 'none' });
        this.refresh();
      });
  },

  onManualPhoneInput(event) {
    const manualPhone = event.detail.value.trim();
    const employeeAuth = {
      ...this.data.employeeAuth,
      manualPhone,
      phoneAuthFailed: this.data.employeeAuth.phoneAuthFailed || !this.data.employeeAuth.phoneCode
    };
    setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
    this.setData({ employeeAuth }, () => this.refresh());
  },

  completeEmployeeBind() {
    if (!this.data.profileReady) {
      wx.showToast({ title: '请填写头像和昵称', icon: 'none' });
      return;
    }
    if (!this.data.phoneReady) {
      wx.showToast({ title: '请授权手机号', icon: 'none' });
      return;
    }
    const staff = this.data.staff[this.data.currentStaffIndex];
    if (!staff || staff.status === 'left') {
      wx.showToast({ title: '入职码无效或员工已离职', icon: 'none' });
      return;
    }
    if (this.data.inviteCode && !this.data.inviteMatched) {
      wx.showToast({ title: '未匹配到入职邀请', icon: 'none' });
      return;
    }
    const employeeAuth = {
      ...this.data.employeeAuth,
      phone: this.data.employeeAuth.phone || this.data.employeeAuth.manualPhone || '',
      inviteCode: this.data.inviteCode,
      staffId: this.data.currentStaffId,
      bound: true
    };
    setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
    setStore(CURRENT_STAFF_KEY, this.data.currentStaffId);
    setStore(ROLE_KEY, 'employee');
    setStore(STAFF_KEY, this.data.staff.map((item) => (
      item.id === this.data.currentStaffId ? { ...item, openidBound: true } : item
    )));
    wx.showToast({ title: '入职注册完成', icon: 'success' });
    this.refresh();
  }
});
