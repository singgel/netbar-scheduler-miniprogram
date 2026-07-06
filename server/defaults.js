const defaultStaff = [
  { id: 'super1', name: '超级管理员', role: '超级管理员', position: 'manager', phone: '15500000000', storeIds: ['store1', 'store2'], maxPerWeek: 6, status: 'active', inviteCode: '100000', avatarUrl: '', openidBound: false },
  { id: 's1', name: '员工1', role: '收银', phone: '', storeIds: ['store1'], maxPerWeek: 6, status: 'active', inviteCode: '100001', avatarUrl: '', openidBound: true },
  { id: 's2', name: '员工2', role: '网管', phone: '', storeIds: ['store1'], maxPerWeek: 6, status: 'active', inviteCode: '100002', avatarUrl: '', openidBound: false },
  { id: 's3', name: '员工3', role: '网管', phone: '', storeIds: ['store1', 'store2'], maxPerWeek: 6, status: 'active', inviteCode: '100003', avatarUrl: '', openidBound: false },
  { id: 's4', name: '员工4', role: '保洁', phone: '', storeIds: ['store2'], maxPerWeek: 5, status: 'active', inviteCode: '100004', avatarUrl: '', openidBound: false },
  { id: 's5', name: '员工5', role: '值班店长', phone: '', storeIds: ['store1'], maxPerWeek: 6, status: 'active', inviteCode: '100005', avatarUrl: '', openidBound: false }
];

const defaultStaffRoleRelations = [
  { id: 'rr_super1', staffId: 'super1', phone: '15500000000', role: 'super_admin', position: 'manager', positionText: '超级管理员' },
  { id: 'rr_s1', staffId: 's1', phone: '', role: 'manager', position: 'manager', positionText: '店长' },
  { id: 'rr_s2', staffId: 's2', phone: '', role: 'employee', position: 'staff', positionText: '普通员工' },
  { id: 'rr_s3', staffId: 's3', phone: '', role: 'employee', position: 'staff', positionText: '普通员工' },
  { id: 'rr_s4', staffId: 's4', phone: '', role: 'employee', position: 'staff', positionText: '普通员工' },
  { id: 'rr_s5', staffId: 's5', phone: '', role: 'manager', position: 'manager', positionText: '店长' }
];

const defaultStores = [
  {
    id: 'store1',
    name: '一号门店',
    address: '示例地址 1',
    latitude: 39.9042,
    longitude: 116.4074,
    checkinRadius: 200,
    status: 'active'
  },
  {
    id: 'store2',
    name: '二号门店',
    address: '示例地址 2',
    latitude: 39.9142,
    longitude: 116.4174,
    checkinRadius: 200,
    status: 'active'
  }
];

const defaultShifts = [
  { id: 'morning', name: '早班', time: '08:00-16:00', need: 2, color: '#eaf6ff' },
  { id: 'middle', name: '中班', time: '16:00-00:00', need: 2, color: '#f2f7e8' },
  { id: 'night', name: '夜班', time: '00:00-08:00', need: 1, color: '#f8eefc' }
];

module.exports = {
  defaultStaff,
  defaultStaffRoleRelations,
  defaultStores,
  defaultShifts
};
