const { exchangePhoneCode, getCurrentUserRole } = require('./backend');

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code || ''),
      fail: reject
    });
  });
}

module.exports = {
  wxLogin,
  exchangePhoneCode,
  getCurrentUserRole
};
