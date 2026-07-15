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

function persistResource(storageKey, value, options) {
  const resource = RESOURCE_BY_STORAGE_KEY[storageKey];
  const requireBackend = options && options.requireBackend;
  if (!backendEnabled() || !resource) {
    return requireBackend
      ? Promise.reject(new Error(!resource ? 'resource_not_persistable' : 'backend_not_configured'))
      : Promise.resolve(null);
  }

  if (cloudEnabled()) {
    return callCloudFunction('saveCloudResource', {
      resource,
      value
    }).catch(() => {
      if (!API_BASE) {
        return requireBackend
          ? Promise.reject(new Error('backend_not_configured'))
          : null;
      }
      return request(`/api/snapshot/${resource}`, {
        method: 'PUT',
        data: {
          value
        }
      });
    });
  }

  return request(`/api/snapshot/${resource}`, {
    method: 'PUT',
    data: {
      value
    }
  });
}

function persistSnapshot(storageValues, options) {
  const requireBackend = options && options.requireBackend;
  const snapshot = Object.keys(storageValues || {}).reduce((result, storageKey) => {
    const resource = RESOURCE_BY_STORAGE_KEY[storageKey];
    if (resource) {
      result[resource] = storageValues[storageKey];
    }
    return result;
  }, {});

  if (!backendEnabled() || !Object.keys(snapshot).length) {
    return requireBackend
      ? Promise.reject(new Error(!Object.keys(snapshot).length ? 'snapshot_not_persistable' : 'backend_not_configured'))
      : Promise.resolve(null);
  }

  if (cloudEnabled() && !API_BASE) {
    return requireBackend
      ? Promise.reject(new Error('backend_not_configured'))
      : Promise.resolve(null);
  }

  return request('/api/snapshot', {
    method: 'POST',
    data: snapshot
  });
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
  persistSnapshot,
  exchangePhoneCode,
  getCurrentUserRole
};
