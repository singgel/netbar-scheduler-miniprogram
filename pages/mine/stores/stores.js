const {
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  STORE_KEY,
  getStore,
  syncStoreFromBackend
} = require('../../../utils/store');
const { syncRoleFromAuth, getVisibleStoresForRole } = require('../../../utils/role');

function firstChar(value, fallback) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1) : fallback;
}

Page({
  data: {
    storeCards: []
  },

  onShow() {
    this.refresh();
    syncStoreFromBackend()
      .then(() => this.refresh())
      .catch(() => {});
  },

  refresh() {
    const stores = getStore(STORE_KEY, []);
    const auth = getStore(EMPLOYEE_AUTH_KEY, {});
    const role = syncRoleFromAuth(auth);
    const currentStaffId = auth.staffId || getStore(CURRENT_STAFF_KEY, '');
    const visibleStores = currentStaffId ? getVisibleStoresForRole(role, stores, currentStaffId) : [];
    this.setData({
      storeCards: visibleStores.map((store) => ({
        ...store,
        nameInitial: firstChar(store.name, '店')
      }))
    });
  }
});
