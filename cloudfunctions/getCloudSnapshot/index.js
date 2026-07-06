const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function list(collectionName) {
  const res = await db.collection(collectionName).limit(1000).get();
  return res.data || [];
}

function toStore(doc) {
  const location = doc.location || {};
  return {
    id: doc.storeId || doc._id,
    name: doc.name || '',
    address: location.address || doc.address || '',
    latitude: location.latitude == null ? doc.latitude : location.latitude,
    longitude: location.longitude == null ? doc.longitude : location.longitude,
    checkinRadius: doc.checkinRadius || 200,
    status: doc.status || 'active'
  };
}

function toStaff(doc) {
  return {
    id: doc.staffId || doc._id,
    storeId: doc.storeId || '',
    storeIds: doc.storeIds || (doc.storeId ? [doc.storeId] : []),
    name: doc.name || '',
    gender: doc.gender || '',
    age: doc.age || '',
    idCard: doc.idCard || '',
    role: doc.positionText || doc.role || '普通员工',
    position: doc.position || '',
    phone: doc.phone || '',
    hireDate: doc.hireDate || '',
    maxPerWeek: doc.maxPerWeek || 6,
    status: doc.status || 'active',
    inviteCode: doc.inviteCode || '',
    openidBound: !!doc.openidBound
  };
}

function toStaffRole(doc) {
  const role = doc.role === 'super_admin'
    ? 'super_admin'
    : ((doc.role === 'manager' || doc.role === 'admin' || doc.position === 'manager') ? 'manager' : 'employee');
  return {
    id: doc._id,
    storeId: doc.storeId || '',
    staffId: doc.staffId || '',
    phone: doc.phone || '',
    role,
    position: doc.position || 'staff',
    positionText: doc.positionText || ''
  };
}

function toShift(doc) {
  return {
    id: doc.shiftId || doc._id,
    name: doc.name || '',
    startTime: doc.startTime || '',
    endTime: doc.endTime || '',
    time: doc.time || `${doc.startTime || ''}-${doc.endTime || ''}`,
    need: doc.need || 1,
    color: doc.color || ''
  };
}

function toSchedule(docs) {
  return docs.reduce((schedule, doc) => {
    const storeId = doc.storeId || '';
    const date = doc.date || '';
    const shiftId = doc.shiftId || '';
    const staffIds = doc.staffIds || (doc.staffId ? [doc.staffId] : []);
    if (!storeId || !date || !shiftId) return schedule;
    if (!schedule[storeId]) schedule[storeId] = {};
    if (!schedule[storeId][date]) schedule[storeId][date] = {};
    if (!schedule[storeId][date][shiftId]) schedule[storeId][date][shiftId] = [];
    staffIds.forEach((staffId) => {
      if (schedule[storeId][date][shiftId].indexOf(staffId) < 0) {
        schedule[storeId][date][shiftId].push(staffId);
      }
    });
    return schedule;
  }, {});
}

function toAttendance(doc) {
  return {
    id: doc.recordId || doc._id,
    date: doc.date || '',
    storeId: doc.storeId || '',
    storeName: doc.storeName || '',
    staffId: doc.staffId || '',
    shiftId: doc.shiftId || '',
    latitude: doc.latitude,
    longitude: doc.longitude,
    distance: doc.distance,
    result: doc.result || 'normal',
    clockIn: doc.clockIn || '',
    clockOut: doc.clockOut || '',
    outLatitude: doc.outLatitude,
    outLongitude: doc.outLongitude,
    outDistance: doc.outDistance
  };
}

exports.main = async () => {
  const [stores, staff, staffRoles, shifts, schedules, attendance] = await Promise.all([
    list('netbar_stores'),
    list('netbar_staff'),
    list('netbar_staff_roles'),
    list('netbar_shifts'),
    list('netbar_schedules'),
    list('netbar_attendance_records')
  ]);

  return {
    stores: stores.map(toStore),
    staff: staff.map(toStaff),
    staffRoleRelations: staffRoles.map(toStaffRole),
    shifts: shifts.map(toShift),
    schedule: toSchedule(schedules),
    attendance: attendance.map(toAttendance)
  };
};
