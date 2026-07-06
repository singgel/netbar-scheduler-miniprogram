const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const resourceCollections = {
  stores: 'netbar_stores',
  staff: 'netbar_staff',
  staffRoleRelations: 'netbar_staff_roles',
  shifts: 'netbar_shifts',
  schedule: 'netbar_schedules',
  attendance: 'netbar_attendance_records'
};

const positionTextByValue = {
  manager: '店长',
  cashier: '收银',
  network: '网管',
  staff: '普通员工'
};

async function list(collectionName) {
  const res = await db.collection(collectionName).limit(1000).get();
  return res.data || [];
}

async function clear(collectionName) {
  const docs = await list(collectionName);
  for (const doc of docs) {
    await db.collection(collectionName).doc(doc._id).remove();
  }
}

async function setDoc(collectionName, id, data) {
  const now = new Date();
  await db.collection(collectionName).doc(id).set({
    data: {
      ...data,
      updatedAt: now,
      createdAt: data.createdAt || now
    }
  });
}

function normalizePosition(item) {
  if (item.position) return item.position;
  if (item.role === 'super_admin' || item.role === 'manager' || item.role === 'admin') return 'manager';
  if (item.role === '收银') return 'cashier';
  if (item.role === '网管') return 'network';
  return 'staff';
}

function normalizeRole(item, position) {
  if (item.role === 'super_admin') return 'super_admin';
  if (item.role === 'manager' || item.role === 'admin' || position === 'manager') return 'manager';
  return 'employee';
}

function toStore(item) {
  const id = item.id || item.storeId;
  return {
    storeId: id,
    name: item.name || '',
    location: {
      address: item.address || (item.location && item.location.address) || '',
      latitude: item.latitude == null ? item.location && item.location.latitude : item.latitude,
      longitude: item.longitude == null ? item.location && item.location.longitude : item.longitude
    },
    checkinRadius: Number(item.checkinRadius) || 200,
    status: item.status || 'active'
  };
}

function toStaff(item) {
  const id = item.id || item.staffId;
  const storeId = item.storeId || (item.storeIds && item.storeIds[0]) || '';
  return {
    storeId,
    storeIds: item.storeIds || (storeId ? [storeId] : []),
    staffId: id,
    name: item.name || '',
    gender: item.gender || '',
    age: item.age === '' ? '' : Number(item.age || 0),
    idCard: item.idCard || '',
    phone: item.phone || '',
    hireDate: item.hireDate || '',
    position: item.position || normalizePosition(item),
    positionText: item.role || '普通员工',
    maxPerWeek: Number(item.maxPerWeek) || 6,
    status: item.status || 'active',
    inviteCode: item.inviteCode || '',
    openidBound: !!item.openidBound
  };
}

function toStaffRole(item) {
  const position = normalizePosition(item);
  const staffId = item.staffId || item.id;
  return {
    storeId: item.storeId || '',
    staffId,
    phone: item.phone || '',
    position,
    positionText: item.positionText || positionTextByValue[position] || '普通员工',
    role: normalizeRole(item, position)
  };
}

function toShift(item) {
  const id = item.id || item.shiftId;
  const parts = String(item.time || '').split('-');
  return {
    shiftId: id,
    name: item.name || '',
    startTime: item.startTime || parts[0] || '',
    endTime: item.endTime || parts[1] || '',
    time: item.time || `${item.startTime || ''}-${item.endTime || ''}`,
    need: Number(item.need) || 1,
    color: item.color || ''
  };
}

function scheduleRows(value) {
  const rows = [];
  Object.keys(value || {}).forEach((storeId) => {
    const storeSchedule = value[storeId] || {};
    Object.keys(storeSchedule).forEach((date) => {
      const day = storeSchedule[date] || {};
      Object.keys(day).forEach((shiftId) => {
        (day[shiftId] || []).forEach((staffId) => {
          rows.push({
            id: `schedule_${storeId}_${date}_${shiftId}_${staffId}`,
            data: {
              scheduleId: `schedule_${storeId}_${date}_${shiftId}_${staffId}`,
              storeId,
              date,
              shiftId,
              staffId,
              status: 'scheduled'
            }
          });
        });
      });
    });
  });
  return rows;
}

function toAttendance(item) {
  const id = item.id || item.recordId;
  return {
    recordId: id,
    date: item.date || '',
    storeId: item.storeId || '',
    storeName: item.storeName || '',
    staffId: item.staffId || '',
    shiftId: item.shiftId || '',
    latitude: item.latitude,
    longitude: item.longitude,
    distance: item.distance,
    result: item.result || 'normal',
    clockIn: item.clockIn || '',
    clockOut: item.clockOut || '',
    outLatitude: item.outLatitude,
    outLongitude: item.outLongitude,
    outDistance: item.outDistance
  };
}

async function replaceResource(resource, value) {
  const collectionName = resourceCollections[resource];
  if (!collectionName) {
    throw new Error('unknown_resource');
  }

  await clear(collectionName);

  if (resource === 'stores') {
    for (const item of value || []) await setDoc(collectionName, item.id || item.storeId, toStore(item));
  } else if (resource === 'staff') {
    for (const item of value || []) await setDoc(collectionName, item.id || item.staffId, toStaff(item));
  } else if (resource === 'staffRoleRelations') {
    for (const item of value || []) await setDoc(collectionName, item.id || `role_${item.staffId}`, toStaffRole(item));
  } else if (resource === 'shifts') {
    for (const item of value || []) await setDoc(collectionName, item.id || item.shiftId, toShift(item));
  } else if (resource === 'schedule') {
    const rows = scheduleRows(value);
    for (const row of rows) await setDoc(collectionName, row.id, row.data);
  } else if (resource === 'attendance') {
    for (const item of value || []) await setDoc(collectionName, item.id || item.recordId, toAttendance(item));
  }
}

exports.main = async (event) => {
  await replaceResource(event.resource, event.value);
  return {
    ok: true,
    resource: event.resource
  };
};
