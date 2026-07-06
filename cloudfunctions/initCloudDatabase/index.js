const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const collections = [
  'netbar_stores',
  'netbar_staff',
  'netbar_staff_roles',
  'netbar_shifts',
  'netbar_schedules',
  'netbar_attendance_records'
];

const stores = [
  {
    _id: 'store1',
    storeId: 'store1',
    name: '星河网吧旗舰店',
    location: {
      address: '天津市南开区时代奥城商业广场',
      latitude: 39.0894,
      longitude: 117.1746
    },
    checkinRadius: 200,
    status: 'active'
  },
  {
    _id: 'store2',
    storeId: 'store2',
    name: '疾风电竞网吧滨江店',
    location: {
      address: '天津市和平区滨江道商圈',
      latitude: 39.1248,
      longitude: 117.2009
    },
    checkinRadius: 200,
    status: 'active'
  }
];

const staff = [
  {
    _id: 'emp_super_001',
    storeId: 'store1',
    storeIds: ['store1', 'store2'],
    staffId: 'emp_super_001',
    name: '超级管理员',
    gender: '男',
    age: 35,
    idCard: '120101199101010019',
    position: 'manager',
    positionText: '超级管理员',
    phone: '15500000000',
    hireDate: '2024-01-01',
    status: 'active',
    inviteCode: '100000',
    openidBound: false
  },
  {
    _id: 'emp_manager_001',
    storeId: 'store1',
    staffId: 'emp_manager_001',
    name: '张明远',
    gender: '男',
    age: 32,
    idCard: '120101199403120018',
    position: 'manager',
    positionText: '店长',
    phone: '15522013798',
    hireDate: '2024-03-12',
    status: 'active',
    inviteCode: '100001',
    openidBound: false
  },
  {
    _id: 'emp_staff_001',
    storeId: 'store1',
    staffId: 'emp_staff_001',
    name: '李安安',
    gender: '女',
    age: 24,
    idCard: '120101200206180027',
    position: 'staff',
    positionText: '普通员工',
    phone: '15922251233',
    hireDate: '2025-06-18',
    status: 'active',
    inviteCode: '100002',
    openidBound: false
  }
];

const staffRoles = [
  {
    _id: 'role_emp_super_001',
    storeId: '',
    staffId: 'emp_super_001',
    phone: '15500000000',
    position: 'manager',
    positionText: '超级管理员',
    role: 'super_admin'
  },
  {
    _id: 'role_emp_manager_001',
    storeId: 'store1',
    staffId: 'emp_manager_001',
    phone: '15522013798',
    position: 'manager',
    positionText: '店长',
    role: 'manager'
  },
  {
    _id: 'role_emp_staff_001',
    storeId: 'store1',
    staffId: 'emp_staff_001',
    phone: '15922251233',
    position: 'staff',
    positionText: '普通员工',
    role: 'employee'
  }
];

const shifts = [
  { _id: 'morning', shiftId: 'morning', name: '早班', startTime: '08:00', endTime: '16:00', time: '08:00-16:00', need: 2, color: '#eaf6ff' },
  { _id: 'middle', shiftId: 'middle', name: '中班', startTime: '16:00', endTime: '00:00', time: '16:00-00:00', need: 2, color: '#f2f7e8' },
  { _id: 'night', shiftId: 'night', name: '夜班', startTime: '00:00', endTime: '08:00', time: '00:00-08:00', need: 1, color: '#f8eefc' }
];

const schedules = [
  {
    _id: 'schedule_store1_2026-07-04_morning_emp_manager_001',
    scheduleId: 'schedule_store1_2026-07-04_morning_emp_manager_001',
    storeId: 'store1',
    date: '2026-07-04',
    startTime: '08:00',
    endTime: '16:00',
    shiftId: 'morning',
    shiftName: '早班',
    staffId: 'emp_manager_001',
    staffName: '张明远',
    position: 'manager',
    status: 'scheduled',
    note: '初始化示例班次'
  },
  {
    _id: 'schedule_store1_2026-07-04_middle_emp_staff_001',
    scheduleId: 'schedule_store1_2026-07-04_middle_emp_staff_001',
    storeId: 'store1',
    date: '2026-07-04',
    startTime: '16:00',
    endTime: '00:00',
    shiftId: 'middle',
    shiftName: '中班',
    staffId: 'emp_staff_001',
    staffName: '李安安',
    position: 'staff',
    status: 'scheduled',
    note: '初始化示例班次'
  }
];

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
    return { name, created: true };
  } catch (error) {
    return { name, created: false, message: error.message };
  }
}

async function upsert(collectionName, doc) {
  const now = new Date();
  const { _id, ...data } = doc;
  await db.collection(collectionName).doc(doc._id).set({
    data: {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now
    }
  });
}

exports.main = async () => {
  const created = [];
  for (const name of collections) {
    created.push(await ensureCollection(name));
  }

  for (const item of stores) await upsert('netbar_stores', item);
  for (const item of staff) await upsert('netbar_staff', item);
  for (const item of staffRoles) await upsert('netbar_staff_roles', item);
  for (const item of shifts) await upsert('netbar_shifts', item);
  for (const item of schedules) await upsert('netbar_schedules', item);

  return {
    ok: true,
    collections: created,
    seed: {
      stores: stores.length,
      staff: staff.length,
      staffRoles: staffRoles.length,
      shifts: shifts.length,
      schedules: schedules.length
    }
  };
};
