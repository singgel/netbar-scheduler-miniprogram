const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function findOne(collectionName, where) {
  const res = await db.collection(collectionName).where(where).limit(1).get();
  return (res.data || [])[0] || null;
}

function normalizeRole(role, position) {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'manager' || role === 'admin' || position === 'manager') return 'manager';
  return 'employee';
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return {
      loggedIn: false,
      message: 'openid_not_found'
    };
  }

  const staffDoc = await findOne('netbar_staff', {
    openid,
    status: 'active'
  });
  if (!staffDoc) {
    return {
      loggedIn: false,
      openid,
      message: 'staff_binding_not_found'
    };
  }

  const roleDoc = await findOne('netbar_staff_roles', {
    staffId: staffDoc.staffId
  });
  const role = roleDoc ? normalizeRole(roleDoc.role, roleDoc.position) : 'employee';

  return {
    loggedIn: true,
    openid,
    phone: staffDoc.phone || (roleDoc && roleDoc.phone) || '',
    staffId: staffDoc.staffId,
    storeId: staffDoc.storeId || (roleDoc && roleDoc.storeId) || '',
    role,
    systemRole: role,
    position: roleDoc ? roleDoc.position : '',
    positionText: roleDoc ? roleDoc.positionText : '',
    staff: staffDoc
  };
};
