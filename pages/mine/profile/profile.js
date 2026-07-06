const {
  STAFF_KEY,
  ROLE_KEY,
  CURRENT_STAFF_KEY,
  EMPLOYEE_AUTH_KEY,
  getStore
} = require('../../../utils/store');
const { syncRoleFromAuth, isSuperAdminRole, isManagerRole } = require('../../../utils/role');

function roleText(role) {
  if (isSuperAdminRole(role)) return '超级管理员';
  if (isManagerRole(role)) return '店长';
  return '普通员工';
}

Page({
  data: {
    staff: {},
    roleText: '普通员工',
    phoneText: '未填写手机号'
  },

  onShow() {
    const staffList = getStore(STAFF_KEY, []);
    const auth = getStore(EMPLOYEE_AUTH_KEY, {});
    const role = syncRoleFromAuth(auth);
    const currentStaffId = auth.staffId || getStore(CURRENT_STAFF_KEY, '');
    const staff = staffList.find((item) => item.id === currentStaffId) || {};
    this.setData({
      staff,
      roleText: roleText(role || getStore(ROLE_KEY, 'employee')),
      phoneText: auth.phone || auth.manualPhone || staff.phone || '未填写手机号'
    });
  }
});
