const { API_BASE, USE_CLOUD_DATABASE } = require('./config');

const RESOURCE_BY_STORAGE_KEY = {
  netbar_staff: 'staff',
  netbar_staff_role_relations: 'staffRoleRelations',
  netbar_shifts: 'shifts',
  netbar_schedule: 'schedule',
  netbar_attendance: 'attendance',
  netbar_stores: 'stores'
};

function backendEnabled() {
  return !!API_BASE || cloudEnabled();
}

function cloudEnabled() {
  return !!(USE_CLOUD_DATABASE && wx.cloud);
}

function callCloudFunction(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data: data || {},
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  });
}

function request(path, options) {
  if (!backendEnabled()) {
    return Promise.resolve(null);
  }

  const method = options && options.method ? options.method : 'GET';
  const data = options ? options.data : undefined;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }
        reject(new Error((res.data && res.data.message) || `request_failed_${res.statusCode}`));
      },
      fail: reject
    });
  });
}

function pullSnapshot() {
  if (cloudEnabled()) {
    return callCloudFunction('getCloudSnapshot').catch(() => (
      API_BASE ? request('/api/snapshot') : null
    ));
  }
  if (!backendEnabled()) {
    return Promise.resolve(null);
  }
  return request('/api/snapshot');
}

function persistResource(storageKey, value) {
  const resource = RESOURCE_BY_STORAGE_KEY[storageKey];
  if (!backendEnabled() || !resource) {
    return;
  }

  if (cloudEnabled()) {
    callCloudFunction('saveCloudResource', {
      resource,
      value
    }).catch(() => {
      if (!API_BASE) return;
      request(`/api/snapshot/${resource}`, {
        method: 'PUT',
        data: {
          value
        }
      }).catch(() => {});
    });
    return;
  }

  request(`/api/snapshot/${resource}`, {
    method: 'PUT',
    data: {
      value
    }
  }).catch(() => {});
}

function exchangePhoneCode(params) {
  if (cloudEnabled()) {
    return callCloudFunction('getPhoneNumberAndRole', params).catch(() => (
      API_BASE ? request('/api/employee/wechat/phone', {
        method: 'POST',
        data: params
      }) : {
        phone: '',
        staffId: '',
        message: 'cloud_function_not_deployed'
      }
    ));
  }
  if (!backendEnabled()) {
    return Promise.resolve({
      phone: '',
      staffId: '',
      message: 'backend_not_configured'
    });
  }

  return request('/api/employee/wechat/phone', {
    method: 'POST',
    data: params
  });
}

function getCurrentUserRole() {
  if (cloudEnabled()) {
    return callCloudFunction('getCurrentUserRole').catch(() => null);
  }
  return Promise.resolve(null);
}

module.exports = {
  backendEnabled,
  cloudEnabled,
  pullSnapshot,
  persistResource,
  exchangePhoneCode,
  getCurrentUserRole
};
