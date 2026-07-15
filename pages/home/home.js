const {
  STAFF_KEY,
  SCHEDULE_KEY,
  ATTENDANCE_KEY,
  STAFF_ROLE_RELATION_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  INVITE_CODE_KEY,
  DEBUG_ROLE_SWITCH_KEY,
  getStore,
  setStore,
  syncStoreFromBackend
} = require('../../utils/store');
const { wxLogin, exchangePhoneCode, getCurrentUserRole } = require('../../utils/auth');
const {
  resolveAccountByPhone,
  upsertStaffRoleRelation,
  applyResolvedRole,
  syncRoleFromAuth,
  isAdminSideRole,
  isSuperAdminRole,
  getVisibleStoresForRole,
  getScopedCurrentStoreId,
  syncTabBar
} = require('../../utils/role');

Page({
  data: {
    role: 'manager',
    isAdminSide: true,
    isSuperAdmin: false,
    staff: [],
    stores: [],
    currentStoreId: '',
    currentStoreIndex: 0,
    currentStoreName: '',
    currentStoreInitial: '',
    currentStaffId: '',
    currentStaffIndex: 0,
    currentStaffName: '',
    inviteCode: '',
    inviteMatched: false,
    employeeAuth: {},
    isLoggedIn: false,
    autoLoginChecked: false,
    autoLoggingIn: true,
    phoneReady: false,
    phoneAuthFailed: false,
    profileReady: false,
    debugRoleSwitch: true,
    canUseEmployeeFeatures: false,
    enableCodeLogin: false,
    enableWechatPhoneLogin: false,
    loginMode: 'password',
    loginForm: {
      phone: '',
      credential: ''
    },
    codeSent: false,
    phoneAuthSheetVisible: false,
    privacyAccepted: true,
    authError: ''
  },

  onLoad() {
    this.refreshLoginCode();
    this.tryAutoLogin();
  },

  onShow() {
    this.refresh();
    syncStoreFromBackend()
      .then(() => this.refresh())
      .catch(() => {});
  },

  refresh() {
    const staff = getStore(STAFF_KEY, []);
    const stores = getStore(STORE_KEY, []);
    const employeeAuth = getStore(EMPLOYEE_AUTH_KEY, {});
    const isLoggedIn = !!(employeeAuth.bound && employeeAuth.staffId);
    const role = isLoggedIn ? syncRoleFromAuth(employeeAuth) : 'employee';
    const isAdminSide = isAdminSideRole(role);
    const isSuperAdmin = isSuperAdminRole(role);
    const inviteCode = getStore(INVITE_CODE_KEY, employeeAuth.inviteCode || '');
    const inviteStaff = inviteCode ? staff.find((item) => item.inviteCode === inviteCode && item.status !== 'left') : null;
    const resolvedStaffId = isLoggedIn ? employeeAuth.staffId : (inviteStaff ? inviteStaff.id : '');
    const currentStaffId = resolvedStaffId || '';
    const index = Math.max(0, staff.findIndex((item) => item.id === currentStaffId));
    const currentStaff = staff[index] || {};
    const storedStoreId = getStore(CURRENT_STORE_KEY, stores[0] ? stores[0].id : '');
    const visibleStores = getVisibleStoresForRole(role, stores, currentStaff.id || currentStaffId);
    const currentStoreId = getScopedCurrentStoreId(role, stores, storedStoreId, currentStaff.id || currentStaffId);
    if (currentStoreId && currentStoreId !== storedStoreId) {
      setStore(CURRENT_STORE_KEY, currentStoreId);
    }
    const storeIndex = Math.max(0, visibleStores.findIndex((item) => item.id === currentStoreId));
    const currentStore = visibleStores[storeIndex] || {};
    const profileReady = !!(employeeAuth.nickname && employeeAuth.avatarUrl);
    const phoneReady = !!(employeeAuth.phone || employeeAuth.phoneCode || employeeAuth.manualPhone);
    this.setData({
      role,
      isAdminSide,
      isSuperAdmin,
      staff,
      stores: visibleStores,
      currentStoreId: currentStore.id || '',
      currentStoreIndex: storeIndex,
      currentStoreName: currentStore.name || '',
      currentStoreInitial: currentStore.name ? currentStore.name.slice(0, 1) : '班',
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
      isLoggedIn,
      autoLoggingIn: this.data.autoLoggingIn && !isLoggedIn,
      profileReady,
      phoneReady,
      phoneAuthFailed: !!employeeAuth.phoneAuthFailed,
      debugRoleSwitch: false,
      canUseEmployeeFeatures: role === 'employee' && isLoggedIn && phoneReady && !!currentStaff.id
    }, () => syncTabBar(this));
  },

  tryAutoLogin() {
    if (this.data.autoLoginChecked) return;
    this.setData({
      autoLoginChecked: true,
      autoLoggingIn: true
    }, () => syncTabBar(this));

    const auth = getStore(EMPLOYEE_AUTH_KEY, {});
    if (auth && auth.bound && auth.staffId) {
      this.setData({ autoLoggingIn: false }, () => this.refresh());
      return;
    }

    getCurrentUserRole()
      .then((result) => {
        if (result && result.loggedIn && result.staffId) {
          this.loginWithCloudResult(result.phone || '', result, {
            nickname: result.staff && result.staff.name
          });
          return;
        }
        this.setData({ autoLoggingIn: false }, () => syncTabBar(this));
      })
      .catch(() => {
        this.setData({ autoLoggingIn: false }, () => syncTabBar(this));
      });
  },

  onLoginInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`loginForm.${field}`]: event.detail.value
    });
  },

  switchLoginMode(event) {
    const mode = event.currentTarget.dataset.mode;
    this.setData({
      loginMode: mode,
      'loginForm.credential': ''
    });
  },

  sendLoginCode() {
    const phone = String(this.data.loginForm.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    this.setData({
      codeSent: true,
      'loginForm.credential': '123456'
    });
    wx.showToast({ title: '验证码 123456', icon: 'none' });
  },

  openPhoneAuthSheet() {
    this.setData({
      phoneAuthSheetVisible: true,
      authError: ''
    });
  },

  closePhoneAuthSheet() {
    this.setData({ phoneAuthSheetVisible: false });
  },

  togglePrivacyAccepted() {
    this.setData({ privacyAccepted: !this.data.privacyAccepted });
  },

  noop() {},

  loginWithForm() {
    const phone = String(this.data.loginForm.phone || '').trim();
    const credential = String(this.data.loginForm.credential || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!credential) {
      wx.showToast({ title: this.data.loginMode === 'code' ? '请输入验证码' : '请输入密码', icon: 'none' });
      return;
    }
    if (credential !== '123456') {
      wx.showToast({ title: this.data.loginMode === 'code' ? '验证码错误' : '密码错误', icon: 'none' });
      return;
    }
    this.resolveAndLoginByPhone(phone);
  },

  resolveAndLoginByPhone(phone, options) {
    const account = resolveAccountByPhone(phone, options && options.staffId);
    const staff = account.staff;
    if (!staff || staff.status === 'left') {
      exchangePhoneCode({
        phone,
        manualPhone: phone,
        nickname: options && options.nickname
      })
        .then((result) => this.loginWithCloudResult(phone, result, options))
        .catch(() => {
          wx.showToast({ title: '未找到可登录员工', icon: 'none' });
        });
      return;
    }
    this.loginWithLocalAccount(phone, account, staff, options);
  },

  loginWithCloudResult(phone, result, options) {
    if (!result || !result.staffId) {
      wx.showToast({ title: '未找到可登录员工', icon: 'none' });
      return;
    }
    const cloudStaff = result.staff || {};
    const localStaff = {
      id: result.staffId,
      storeId: result.storeId || cloudStaff.storeId || '',
      storeIds: cloudStaff.storeIds || [result.storeId || cloudStaff.storeId || this.data.currentStoreId].filter(Boolean),
      name: cloudStaff.name || (options && options.nickname) || '员工',
      gender: cloudStaff.gender || '',
      age: cloudStaff.age || '',
      idCard: cloudStaff.idCard || '',
      role: result.positionText || cloudStaff.positionText || (isAdminSideRole(result.role) ? '店长' : '普通员工'),
      position: result.position || cloudStaff.position || '',
      phone,
      hireDate: cloudStaff.hireDate || '',
      maxPerWeek: cloudStaff.maxPerWeek || 6,
      status: cloudStaff.status || 'active',
      inviteCode: cloudStaff.inviteCode || '',
      avatarUrl: cloudStaff.avatarUrl || '',
      openidBound: true
    };
    const staff = getStore(STAFF_KEY, []);
    const nextStaff = staff.some((item) => item.id === localStaff.id)
      ? staff.map((item) => (item.id === localStaff.id ? { ...item, ...localStaff } : item))
      : staff.concat(localStaff);
    setStore(STAFF_KEY, nextStaff);
    upsertStaffRoleRelation(localStaff.id, phone, result.role || result.systemRole || 'employee', {
      storeId: localStaff.storeIds[0] || '',
      position: result.position || (isAdminSideRole(result.role) ? 'manager' : 'staff')
    });
    this.loginWithLocalAccount(
      phone,
      resolveAccountByPhone(phone, localStaff.id, result.role || result.systemRole),
      localStaff,
      options
    );
  },

  loginWithLocalAccount(phone, account, staff, options) {
    const storeId = (staff.storeIds || [])[0] || this.data.currentStoreId;
    const nextAuth = {
      ...getStore(EMPLOYEE_AUTH_KEY, {}),
      nickname: (options && options.nickname) || staff.name,
      avatarUrl: (options && options.avatarUrl) || staff.avatarUrl || '',
      phone,
      manualPhone: phone,
      staffId: staff.id,
      inviteCode: staff.inviteCode || '',
      bound: true,
      phoneAuthFailed: false
    };
    upsertStaffRoleRelation(staff.id, phone, account.role, {
      storeId,
      position: isAdminSideRole(account.role) ? 'manager' : 'staff'
    });
    applyResolvedRole(account);
    setStore(EMPLOYEE_AUTH_KEY, nextAuth);
    setStore(CURRENT_STAFF_KEY, staff.id);
    if (storeId) {
      setStore(CURRENT_STORE_KEY, storeId);
    }
    setStore(STAFF_KEY, getStore(STAFF_KEY, []).map((item) => (
      item.id === staff.id ? { ...item, phone, avatarUrl: item.avatarUrl || staff.avatarUrl || '', openidBound: true } : item
    )));
    wx.showToast({ title: isAdminSideRole(account.role) ? '已进入管理端' : '已进入员工端', icon: 'success' });
    this.refresh();
  },

  loginAsDemoManager() {
    this.resolveAndLoginByPhone('15522013798', { nickname: '张明远' });
  },

  loginAsDemoStaff() {
    this.resolveAndLoginByPhone('15922251233', { nickname: '李安安' });
  },

  clearCurrentStoreData() {
    if (!this.data.isSuperAdmin) return;
    const storeId = this.data.currentStoreId;
    const storeName = this.data.currentStoreName || '当前门店';
    if (!storeId) {
      wx.showToast({ title: '未选择门店', icon: 'none' });
      return;
    }
    const selfStaffId = this.data.currentStaffId;
    wx.showModal({
      title: '清除门店数据',
      content: `将清除「${storeName}」的：本门店其他员工信息（不含自己）、打卡记录、班表安排。此操作不可恢复，是否继续？`,
      confirmColor: '#b42318',
      confirmText: '清除',
      success: (res) => {
        if (!res.confirm) return;
        // 1. 员工：保留自己，删除该门店的其他员工（不含自己）
        const staff = getStore(STAFF_KEY, []);
        const nextStaff = staff.filter((item) => {
          if (item.id === selfStaffId) return true;
          const ids = (item.storeIds && item.storeIds.length) ? item.storeIds : (item.storeId ? [item.storeId] : []);
          return ids.indexOf(storeId) < 0;
        });
        const removedStaffIds = staff.filter((item) => nextStaff.indexOf(item) < 0).map((item) => item.id);
        setStore(STAFF_KEY, nextStaff);
        // 2. 仅删除被移除员工的角色关系（不按门店删，避免误删超管/店长的关系）
        const relations = getStore(STAFF_ROLE_RELATION_KEY, []);
        const nextRelations = relations.filter((item) => removedStaffIds.indexOf(item.staffId) < 0);
        setStore(STAFF_ROLE_RELATION_KEY, nextRelations);
        // 3. 打卡记录：删除该门店的记录
        const attendance = getStore(ATTENDANCE_KEY, []);
        const nextAttendance = attendance.filter((item) => item.storeId !== storeId);
        setStore(ATTENDANCE_KEY, nextAttendance);
        // 4. 班表：删除该门店的排班
        const schedule = getStore(SCHEDULE_KEY, {});
        const nextSchedule = { ...schedule };
        delete nextSchedule[storeId];
        setStore(SCHEDULE_KEY, nextSchedule);
        wx.showToast({ title: '已清除门店数据', icon: 'success' });
        this.refresh();
      }
    });
  },

  openStaffOnboard() {
    wx.setStorageSync('netbar_staff_default_menu', 'onboard');
    wx.switchTab({ url: '/pages/staff/staff' });
  },

  openStaffList() {
    wx.setStorageSync('netbar_staff_default_menu', 'list');
    wx.switchTab({ url: '/pages/staff/staff' });
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
    if (!this.data.debugRoleSwitch) {
      wx.showToast({ title: '身份由手机号自动识别', icon: 'none' });
      return;
    }
    const role = event.currentTarget.dataset.role;
    if (!this.data.debugRoleSwitch && isAdminSideRole(role) && this.data.employeeAuth.bound) {
      wx.showToast({ title: '当前账号无管理权限', icon: 'none' });
      return;
    }
    setStore(ROLE_KEY, role);
    this.setData({ role }, () => this.refresh());
  },

  enterAdminForTest() {
    setStore(ROLE_KEY, 'manager');
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
    if (!this.data.isSuperAdmin) return;
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
      this.setData({
        employeeAuth,
        phoneAuthFailed: true,
        authError: '未完成微信手机号授权'
      });
      wx.showToast({ title: '未完成手机号授权', icon: 'none' });
      return;
    }
    this.setData({
      phoneAuthSheetVisible: false,
      authError: ''
    });
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
        const hasAccountResult = !!(result.phone || result.staffId || result.role || result.systemRole);
        if (result.staffId && !resolveAccountByPhone(result.phone || '', result.staffId, result.role || result.systemRole).staff) {
          this.loginWithCloudResult(result.phone || '', result, {
            nickname: employeeAuth.nickname,
            avatarUrl: employeeAuth.avatarUrl
          });
          return;
        }
        const account = hasAccountResult
          ? resolveAccountByPhone(
            result.phone || '',
            result.staffId || this.data.currentStaffId,
            result.role || result.systemRole
          )
          : {
            role: getStore(ROLE_KEY, 'employee'),
            staffId: this.data.currentStaffId
          };
        if (hasAccountResult && account.staffId) {
          upsertStaffRoleRelation(account.staffId, result.phone || '', account.role);
          applyResolvedRole(account);
        }
        const nextAuth = {
          ...getStore(EMPLOYEE_AUTH_KEY, {}),
          phone: result.phone || '',
          manualPhone: result.phone || '',
          nickname: employeeAuth.nickname || result.staff && result.staff.name || '',
          staffId: account.staffId || result.staffId || this.data.currentStaffId,
          phoneAuthFailed: false,
          bound: true
        };
        if (account.staffId) {
          const phone = result.phone || '';
          setStore(CURRENT_STAFF_KEY, account.staffId);
          if (result.storeId) {
            setStore(CURRENT_STORE_KEY, result.storeId);
          }
          setStore(STAFF_KEY, getStore(STAFF_KEY, []).map((item) => (
            item.id === account.staffId ? { ...item, phone: phone || item.phone, openidBound: true } : item
          )));
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
    if (!this.data.isLoggedIn && this.data.employeeAuth.manualPhone) {
      this.resolveAndLoginByPhone(this.data.employeeAuth.manualPhone);
      return;
    }
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
    const account = resolveAccountByPhone(employeeAuth.phone, this.data.currentStaffId);
    upsertStaffRoleRelation(this.data.currentStaffId, employeeAuth.phone, account.role);
    applyResolvedRole(account);
    setStore(EMPLOYEE_AUTH_KEY, employeeAuth);
    setStore(CURRENT_STAFF_KEY, this.data.currentStaffId);
    setStore(STAFF_KEY, getStore(STAFF_KEY, []).map((item) => (
      item.id === this.data.currentStaffId ? { ...item, phone: employeeAuth.phone || item.phone, openidBound: true } : item
    )));
    wx.showToast({ title: '入职注册完成', icon: 'success' });
    this.refresh();
  }
});
