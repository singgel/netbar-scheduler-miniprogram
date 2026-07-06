const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeRole(role, position) {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'manager' || role === 'admin' || position === 'manager') return 'manager';
  return 'employee';
}

async function getPhoneFromCode(phoneCode) {
  if (!phoneCode || !cloud.openapi || !cloud.openapi.phonenumber) {
    return '';
  }
  const res = await cloud.openapi.phonenumber.getPhoneNumber({
    code: phoneCode
  });
  return normalizePhone(res && res.phoneInfo && res.phoneInfo.phoneNumber);
}

async function findOne(collectionName, where) {
  const res = await db.collection(collectionName).where(where).limit(1).get();
  return (res.data || [])[0] || null;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  let phone = normalizePhone(event.phone || event.manualPhone);
  if (!phone) {
    try {
      phone = await getPhoneFromCode(event.phoneCode);
    } catch (error) {
      phone = '';
    }
  }

  if (!phone) {
    return {
      phone: '',
      staffId: '',
      role: 'employee',
      message: 'phone_not_available'
    };
  }

  const roleDoc = await findOne('netbar_staff_roles', { phone });
  const staffId = roleDoc ? roleDoc.staffId : '';
  const staffDoc = staffId
    ? await findOne('netbar_staff', { staffId })
    : await findOne('netbar_staff', { phone });

  if (staffDoc) {
    await db.collection('netbar_staff').doc(staffDoc._id).update({
      data: {
        openidBound: true,
        openid: wxContext.OPENID,
        nickname: event.nickname || staffDoc.nickname || '',
        avatarUrl: event.avatarUrl || staffDoc.avatarUrl || '',
        updatedAt: new Date()
      }
    });
  }

  return {
    phone,
    staffId: staffDoc ? staffDoc.staffId : staffId,
    storeId: roleDoc ? roleDoc.storeId : (staffDoc ? staffDoc.storeId : ''),
    role: roleDoc ? normalizeRole(roleDoc.role, roleDoc.position) : 'employee',
    systemRole: roleDoc ? normalizeRole(roleDoc.role, roleDoc.position) : 'employee',
    position: roleDoc ? roleDoc.position : '',
    positionText: roleDoc ? roleDoc.positionText : '',
    staff: staffDoc || null,
    openid: wxContext.OPENID,
    message: staffDoc || roleDoc ? 'account_resolved' : 'staff_not_found'
  };
};
