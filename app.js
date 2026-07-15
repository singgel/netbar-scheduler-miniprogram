const {
  CLOUD_ENV_ID,
  USE_CLOUD_DATABASE
} = require('./utils/config');
const {
  ROLE_KEY,
  EMPLOYEE_AUTH_KEY,
  INVITE_CODE_KEY,
  getStore,
  setStore,
  seedStore,
  syncStoreFromBackend
} = require('./utils/store');
const { syncRoleFromAuth } = require('./utils/role');

App({
  onLaunch(options) {
    if (USE_CLOUD_DATABASE && wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      });
    }
    seedStore();
    const query = options && options.query ? options.query : {};
    const inviteCode = query.inviteCode || query.scene || '';
    if (inviteCode) {
      setStore(INVITE_CODE_KEY, decodeURIComponent(inviteCode));
      setStore(ROLE_KEY, 'employee');
    }
    syncStoreFromBackend()
      .then(() => {
        syncRoleFromAuth(getStore(EMPLOYEE_AUTH_KEY, {}));
      })
      .catch(() => {
        syncRoleFromAuth(getStore(EMPLOYEE_AUTH_KEY, {}));
      });
  },
  getStore,
  setStore
});
