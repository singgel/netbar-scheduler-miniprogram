const {
  STAFF_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  getStore
} = require('../../../utils/store');

function staffStoreIds(staff) {
  if (staff.storeIds && staff.storeIds.length) return staff.storeIds;
  if (staff.storeId) return [staff.storeId];
  return [];
}

function firstChar(value, fallback) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1) : fallback;
}

Page({
  data: {
    storeCards: []
  },

  onShow() {
    const staffList = getStore(STAFF_KEY, []);
    const stores = getStore(STORE_KEY, []);
    const auth = getStore(EMPLOYEE_AUTH_KEY, {});
    const currentStaffId = auth.staffId || getStore(CURRENT_STAFF_KEY, '');
    const staff = staffList.find((item) => item.id === currentStaffId) || {};
    const storeIds = staffStoreIds(staff);
    this.setData({
      storeCards: stores
        .filter((store) => storeIds.indexOf(store.id) >= 0)
        .map((store) => ({
          ...store,
          nameInitial: firstChar(store.name, '店')
        }))
    });
  }
});
