const {
  ROLE_KEY,
  INVITE_CODE_KEY,
  getStore,
  setStore,
  seedStore
} = require('./utils/store');

App({
  onLaunch(options) {
    seedStore();
    const query = options && options.query ? options.query : {};
    const inviteCode = query.inviteCode || query.scene || '';
    if (inviteCode) {
      setStore(INVITE_CODE_KEY, decodeURIComponent(inviteCode));
      setStore(ROLE_KEY, 'employee');
    }
  },
  getStore,
  setStore
});
