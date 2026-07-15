const {
  STAFF_KEY,
  STAFF_ROLE_RELATION_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  getStore,
  setStore,
  saveStore,
  saveStores
} = require('../../utils/store');
const {
  upsertStaffRoleRelation,
  isAdminSideRole,
  isSuperAdminRole,
  getVisibleStoresForRole,
  getScopedCurrentStoreId,
  syncTabBar
} = require('../../utils/role');

function normalizeIdCard(idCard) {
  return String(idCard || '').trim().toUpperCase();
}

function defaultPasswordFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(-6);
  if (digits.length > 0) return digits.padStart(6, '0');
  return '123456';
}

function resolveStaffPassword(staff) {
  if (staff && staff.password) return staff.password;
  return defaultPasswordFromPhone(staff && staff.phone);
}

function birthDateFromIdCard(idCard) {
  const value = normalizeIdCard(idCard);
  let birth = '';
  if (/^\d{17}[\dX]$/.test(value)) {
    birth = value.slice(6, 14);
  } else if (/^\d{15}$/.test(value)) {
    birth = `19${value.slice(6, 12)}`;
  }
  if (!birth) return null;
  const year = Number(birth.slice(0, 4));
  const month = Number(birth.slice(4, 6));
  const day = Number(birth.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function calculateAgeFromIdCard(idCard) {
  const birth = birthDateFromIdCard(idCard);
  if (!birth) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.year;
  const birthdayPassed = now.getMonth() + 1 > birth.month ||
    (now.getMonth() + 1 === birth.month && now.getDate() >= birth.day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : '';
}

function todayDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyStaffForm() {
  return {
    name: '',
    gender: '',
    age: '',
    idCard: '',
    role: '',
    position: '',
    phone: '',
    hireDate: todayDate(),
    maxPerWeek: ''
  };
}

function roleText(role) {
  if (role === 'super_admin') return '超级管理员';
  if (role === 'manager' || role === 'admin') return '店长';
  return '普通员工';
}

function staffStoreIds(staff, fallbackStoreId) {
  if (staff.storeIds && staff.storeIds.length) return staff.storeIds;
  if (staff.storeId) return [staff.storeId];
  return fallbackStoreId ? [fallbackStoreId] : [];
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesStaffSearch(staff, keyword) {
  const value = normalizeSearchText(keyword);
  if (!value) return true;
  return [
    staff.name,
    staff.phone,
    staff.idCard
  ].some((field) => normalizeSearchText(field).indexOf(value) >= 0);
}

function firstChar(value, fallback) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1) : fallback;
}

function roleRank(position, role) {
  if (role === 'manager' || position === 'manager') return 1;
  if (position === 'cashier') return 2;
  if (position === 'network') return 3;
  if (role === 'employee' || position === 'staff') return 4;
  return 9;
}

function hireDateValue(value) {
  const time = new Date(value || '9999-12-31').getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

Page({
  data: {
    role: 'manager',
    canManage: true,
    isSuperAdmin: false,
    staff: [],
    stores: [],
    currentStoreId: '',
    currentStoreName: '',
    staffSearchKeyword: '',
    activeDropdown: '',
    activeStaffMenu: 'onboard',
    editingStaffId: '',
    genderOptions: [
      { label: '男', value: '男' },
      { label: '女', value: '女' }
    ],
    positionOptions: [
      { label: '店长', value: 'manager' },
      { label: '收银', value: 'cashier' },
      { label: '网管', value: 'network' }
    ],
    form: emptyStaffForm()
  },

  onShow() {
    const defaultMenu = wx.getStorageSync('netbar_staff_default_menu');
    if (defaultMenu === 'onboard' || defaultMenu === 'list') {
      wx.removeStorageSync('netbar_staff_default_menu');
      this.setData({ activeStaffMenu: defaultMenu });
    }
    this.refresh();
  },

  refresh() {
    const role = getStore(ROLE_KEY, 'manager');
    const canManage = isAdminSideRole(role);
    const isSuperAdmin = isSuperAdminRole(role);
    const allStores = getStore(STORE_KEY, []);
    const currentStaffId = getStore(CURRENT_STAFF_KEY, '');
    const visibleStores = getVisibleStoresForRole(role, allStores, currentStaffId);
    const storedStoreId = getStore(CURRENT_STORE_KEY, visibleStores[0] ? visibleStores[0].id : '');
    const currentStoreId = getScopedCurrentStoreId(role, allStores, storedStoreId, currentStaffId);
    if (currentStoreId && currentStoreId !== storedStoreId) {
      setStore(CURRENT_STORE_KEY, currentStoreId);
    }
    const currentStore = visibleStores.find((item) => item.id === currentStoreId) || {};
    const storeMap = visibleStores.reduce((map, item) => {
      map[item.id] = item.name;
      return map;
    }, {});
    const relations = getStore(STAFF_ROLE_RELATION_KEY, []);
    const relationMap = relations.reduce((map, item) => {
      if (item.staffId) map[item.staffId] = item;
      return map;
    }, {});
    const staffSearchKeyword = this.data.staffSearchKeyword;
    const staff = getStore(STAFF_KEY, [])
      .filter((item) => staffStoreIds(item, currentStoreId).indexOf(currentStoreId) >= 0)
      .map((item) => ({
        ...item,
        systemRole: (relationMap[item.id] || {}).role || '',
        roleSort: roleRank(item.position, (relationMap[item.id] || {}).role),
        nameInitial: firstChar(item.name, '员'),
        statusText: item.status === 'left' ? '已离职' : (item.openidBound ? '已绑定' : '待注册'),
        storeNames: staffStoreIds(item, currentStoreId).map((id) => storeMap[id] || '未知门店').join('、'),
        systemRoleText: roleText((relationMap[item.id] || {}).role),
        loginPassword: isSuperAdmin ? resolveStaffPassword(item) : '',
        canViewPassword: !!isSuperAdmin
      }))
      .filter((item) => item.systemRole !== 'super_admin')
      .filter((item) => matchesStaffSearch(item, staffSearchKeyword))
      .sort((a, b) => (
        a.roleSort - b.roleSort ||
        hireDateValue(a.hireDate) - hireDateValue(b.hireDate) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
      ));
    wx.setNavigationBarTitle({
      title: currentStore.name || '员工管理'
    });
    this.setData({
      role,
      canManage,
      isSuperAdmin,
      staff,
      stores: visibleStores,
      currentStoreId,
      currentStoreName: currentStore.name || ''
    }, () => {
      if (!this.data.form.hireDate) {
        this.setData({ 'form.hireDate': todayDate() });
      }
      syncTabBar(this);
    });
  },

  onStaffSearchInput(event) {
    this.setData({
      staffSearchKeyword: event.detail.value || ''
    }, () => this.refresh());
  },

  clearStaffSearch() {
    this.setData({
      staffSearchKeyword: ''
    }, () => this.refresh());
  },

  togglePasswordVisible(event) {
    const id = event.currentTarget.dataset.id;
    const staff = this.data.staff.map((item) => (
      item.id === id ? { ...item, passwordVisible: !item.passwordVisible } : item
    ));
    this.setData({ staff });
  },

  switchStaffMenu(event) {
    const menu = event.currentTarget.dataset.menu;
    this.setData({
      activeStaffMenu: menu,
      activeDropdown: ''
    });
    if (menu === 'onboard' && !this.data.editingStaffId) {
      this.setData({ form: emptyStaffForm() });
    }
  },

  selectStore(event) {
    if (!this.data.isSuperAdmin) return;
    const index = Number(event.detail.value);
    const store = this.data.stores[index];
    if (!store) return;
    setStore(CURRENT_STORE_KEY, store.id);
    this.setData({
      currentStoreId: store.id,
      currentStoreName: store.name,
      activeDropdown: '',
      editingStaffId: '',
      form: emptyStaffForm()
    }, () => this.refresh());
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({ [`form.${field}`]: value });
  },

  calcAgeFromIdCard(event) {
    const value = event.detail.value;
    const age = calculateAgeFromIdCard(value);
    if (age !== '') {
      this.setData({ 'form.age': age });
    }
  },

  noop() {},

  closeDropdowns() {
    if (this.data.activeDropdown) {
      this.setData({ activeDropdown: '' });
    }
  },

  toggleDropdown(event) {
    const dropdown = event.currentTarget.dataset.dropdown;
    this.setData({
      activeDropdown: this.data.activeDropdown === dropdown ? '' : dropdown
    });
  },

  selectDropdownOption(event) {
    const { field, value, label } = event.currentTarget.dataset;
    const nextData = {
      activeDropdown: ''
    };
    if (field === 'gender') {
      nextData['form.gender'] = label;
    }
    if (field === 'position') {
      nextData['form.position'] = value;
      nextData['form.role'] = label;
    }
    this.setData(nextData);
  },

  selectHireDate(event) {
    this.setData({
      activeDropdown: '',
      'form.hireDate': event.detail.value || todayDate()
    });
  },

  createInviteCode() {
    return String(Date.now()).slice(-6);
  },

  saveStaff() {
    if (!this.data.canManage) return;
    const { name, gender, age, idCard, role, position: formPosition, phone, hireDate, maxPerWeek } = this.data.form;
    const targetStoreId = this.data.currentStoreId || (this.data.stores[0] && this.data.stores[0].id) || '';
    if (!targetStoreId) {
      wx.showToast({ title: '请先配置门店', icon: 'none' });
      return;
    }
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    const staffId = this.data.editingStaffId || `s${Date.now()}`;
    const roleText = role.trim() || '普通员工';
    const position = formPosition || (roleText === '店长'
      ? 'manager'
      : (roleText === '收银' ? 'cashier' : (roleText === '网管' ? 'network' : 'staff')));
    const systemRole = position === 'manager' ? 'manager' : 'employee';
    const rawStaff = getStore(STAFF_KEY, []);
    const existingStaff = rawStaff.find((item) => item.id === staffId) || {};
    const savedStaff = {
      id: staffId,
      name: name.trim(),
      gender: gender.trim(),
      age: Number(age) || '',
      idCard: normalizeIdCard(idCard),
      role: roleText,
      position,
      phone: phone.trim(),
      storeIds: [targetStoreId],
      maxPerWeek: Number(maxPerWeek) || 6,
      status: this.data.editingStaffId ? (existingStaff.status || 'active') : 'active',
      hireDate: hireDate.trim() || todayDate(),
      inviteCode: this.data.editingStaffId
        ? (existingStaff.inviteCode || this.createInviteCode())
        : this.createInviteCode(),
      avatarUrl: existingStaff.avatarUrl || '',
      openidBound: this.data.editingStaffId
        ? !!existingStaff.openidBound
        : false,
      password: this.data.editingStaffId
        ? (existingStaff.password || '')
        : ''
    };
    const next = this.data.editingStaffId
      ? rawStaff.map((item) => (item.id === staffId ? { ...item, ...savedStaff } : item))
      : rawStaff.concat(savedStaff);
    wx.showLoading({ title: '保存中' });
    const nextRelations = upsertStaffRoleRelation(staffId, phone.trim(), systemRole, {
      storeId: targetStoreId,
      position,
      persist: false
    });
    saveStores({
      [STAFF_KEY]: next,
      [STAFF_ROLE_RELATION_KEY]: nextRelations
    })
      .then(() => {
        wx.hideLoading();
        this.setData({
          activeDropdown: '',
          activeStaffMenu: 'list',
          editingStaffId: '',
          staffSearchKeyword: '',
          currentStoreId: targetStoreId,
          form: emptyStaffForm()
        });
        wx.showToast({ title: '已保存', icon: 'success' });
        this.refresh();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存到数据库失败', icon: 'none' });
      });
  },

  startEdit(event) {
    const id = event.currentTarget.dataset.id;
    const staff = getStore(STAFF_KEY, []).find((item) => item.id === id);
    if (!staff) return;
    this.setData({
      activeStaffMenu: 'onboard',
      activeDropdown: '',
      editingStaffId: id,
      form: {
        name: staff.name || '',
        gender: staff.gender || '',
        age: staff.age || '',
        idCard: staff.idCard || '',
        role: staff.role || '',
        position: staff.position || '',
        phone: staff.phone || '',
        hireDate: staff.hireDate || todayDate(),
        maxPerWeek: staff.maxPerWeek || ''
      }
    });
  },

  cancelEdit() {
    this.setData({
      editingStaffId: '',
      activeDropdown: '',
      form: emptyStaffForm()
    });
  },

  markLeft(event) {
    if (!this.data.canManage) return;
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '办理离职',
      content: '离职后，该员工不能打卡，也不会参与新生成的班次安排。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        const next = getStore(STAFF_KEY, []).map((item) => (
          item.id === id ? { ...item, status: 'left' } : item
        ));
        wx.showLoading({ title: '保存中' });
        saveStore(STAFF_KEY, next)
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

  restoreStaff(event) {
    if (!this.data.canManage) return;
    const id = event.currentTarget.dataset.id;
    const next = getStore(STAFF_KEY, []).map((item) => (
      item.id === id ? { ...item, status: 'active' } : item
    ));
    wx.showLoading({ title: '保存中' });
    saveStore(STAFF_KEY, next)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已恢复在职', icon: 'success' });
        this.refresh();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存到数据库失败', icon: 'none' });
      });
  },

  deleteStaff(event) {
    if (!this.data.canManage) return;
    const id = event.currentTarget.dataset.id;
    const staff = getStore(STAFF_KEY, []).find((item) => item.id === id);
    if (!staff || staff.status !== 'left') {
      wx.showToast({ title: '离职后才可删除', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除员工信息',
      content: '删除后员工档案和角色关系会被移除。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        const nextStaff = getStore(STAFF_KEY, []).filter((item) => item.id !== id);
        const nextRelations = getStore(STAFF_ROLE_RELATION_KEY, []).filter((item) => item.staffId !== id);
        wx.showLoading({ title: '保存中' });
        saveStores({
          [STAFF_KEY]: nextStaff,
          [STAFF_ROLE_RELATION_KEY]: nextRelations
        })
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已删除', icon: 'success' });
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
