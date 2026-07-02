const API_BASE = '';

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code || ''),
      fail: reject
    });
  });
}

function exchangePhoneCode(params) {
  if (!API_BASE) {
    return Promise.resolve({
      phone: '',
      staffId: '',
      message: 'backend_not_configured'
    });
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/employee/wechat/phone`,
      method: 'POST',
      data: params,
      success: (res) => resolve(res.data || {}),
      fail: reject
    });
  });
}

module.exports = {
  wxLogin,
  exchangePhoneCode
};
