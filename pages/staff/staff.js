const {
  STAFF_KEY,
  ROLE_KEY,
  STORE_KEY,
  CURRENT_STORE_KEY,
  getStore,
  setStore
} = require('../../utils/store');

Page({
  data: {
    role: 'admin',
    staff: [],
    stores: [],
    currentStoreId: '',
    currentStoreName: '',
    form: {
      name: '',
      role: '',
      phone: '',
      maxPerWeek: ''
    }
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const stores = getStore(STORE_KEY, []);
    const currentStoreId = getStore(CURRENT_STORE_KEY, stores[0] ? stores[0].id : '');
    const currentStore = stores.find((item) => item.id === currentStoreId) || {};
    const storeMap = stores.reduce((map, item) => {
      map[item.id] = item.name;
      return map;
    }, {});
    const staff = getStore(STAFF_KEY, []).map((item) => ({
      ...item,
      statusText: item.status === 'left' ? '已离职' : (item.openidBound ? '已绑定' : '待注册'),
      storeNames: (item.storeIds || [currentStoreId]).map((id) => storeMap[id] || '未知门店').join('、')
    }));
    this.setData({
      role: getStore(ROLE_KEY, 'admin'),
      staff,
      stores,
      currentStoreId,
      currentStoreName: currentStore.name || ''
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  createInviteCode() {
    return String(Date.now()).slice(-6);
  },

  addStaff() {
    if (this.data.role !== 'admin') return;
    const { name, role, phone, maxPerWeek } = this.data.form;
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    const next = this.data.staff.concat({
      id: `s${Date.now()}`,
      name: name.trim(),
      role: role.trim() || '员工',
      phone: phone.trim(),
      storeIds: [this.data.currentStoreId],
      maxPerWeek: Number(maxPerWeek) || 6,
      status: 'active',
      inviteCode: this.createInviteCode(),
      openidBound: false
    });
    setStore(STAFF_KEY, next);
    this.setData({ form: { name: '', role: '', phone: '', maxPerWeek: '' } });
    this.refresh();
  },

  markLeft(event) {
    if (this.data.role !== 'admin') return;
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '办理离职',
      content: '离职后，该员工不能打卡，也不会参与新生成的班次安排。',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return;
        setStore(STAFF_KEY, this.data.staff.map((item) => (
          item.id === id ? { ...item, status: 'left' } : item
        )));
        this.refresh();
      }
    });
  },

  restoreStaff(event) {
    if (this.data.role !== 'admin') return;
    const id = event.currentTarget.dataset.id;
    setStore(STAFF_KEY, this.data.staff.map((item) => (
      item.id === id ? { ...item, status: 'active' } : item
    )));
    wx.showToast({ title: '已恢复在职', icon: 'success' });
    this.refresh();
  }
});
