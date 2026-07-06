const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const {
  defaultStaff,
  defaultStaffRoleRelations,
  defaultStores,
  defaultShifts
} = require('./defaults');

const RESOURCE_NAMES = ['staff', 'staffRoleRelations', 'stores', 'shifts', 'schedule', 'attendance'];

function ensureDirForDatabase(dbPath) {
  if (dbPath === ':memory:') return;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function intToBool(value) {
  return Number(value) === 1;
}

function normalizeRole(role, position) {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'manager' || role === 'admin' || position === 'manager') return 'manager';
  return 'employee';
}

function transaction(db, work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrate(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      checkin_radius INTEGER DEFAULT 200,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT DEFAULT '',
      age INTEGER,
      id_card TEXT DEFAULT '',
      role TEXT DEFAULT '',
      position TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      hire_date TEXT DEFAULT '',
      max_per_week INTEGER DEFAULT 6,
      status TEXT DEFAULT 'active',
      invite_code TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      openid_bound INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_store_memberships (
      staff_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      PRIMARY KEY (staff_id, store_id),
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staff_role_relations (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      phone TEXT DEFAULT '',
      position TEXT DEFAULT 'staff',
      position_text TEXT DEFAULT '普通员工',
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      time TEXT DEFAULT '',
      need INTEGER DEFAULT 1,
      color TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedules (
      store_id TEXT NOT NULL,
      work_date TEXT NOT NULL,
      shift_id TEXT NOT NULL,
      staff_ids_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (store_id, work_date, shift_id),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      work_date TEXT NOT NULL,
      store_id TEXT DEFAULT '',
      store_name TEXT DEFAULT '',
      staff_id TEXT NOT NULL,
      shift_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      distance INTEGER,
      result TEXT DEFAULT 'normal',
      clock_in TEXT DEFAULT '',
      clock_out TEXT DEFAULT '',
      out_latitude REAL,
      out_longitude REAL,
      out_distance INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employee_bindings (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      openid TEXT DEFAULT '',
      unionid TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      nickname TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      role TEXT DEFAULT 'employee',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );
  `);
  ensureColumn(db, 'staff', 'gender', "TEXT DEFAULT ''");
  ensureColumn(db, 'staff', 'age', 'INTEGER');
  ensureColumn(db, 'staff', 'id_card', "TEXT DEFAULT ''");
  ensureColumn(db, 'staff', 'position', "TEXT DEFAULT ''");
  ensureColumn(db, 'staff', 'hire_date', "TEXT DEFAULT ''");
  ensureColumn(db, 'staff', 'avatar_url', "TEXT DEFAULT ''");
  ensureColumn(db, 'staff_role_relations', 'position', "TEXT DEFAULT 'staff'");
  ensureColumn(db, 'staff_role_relations', 'position_text', "TEXT DEFAULT '普通员工'");
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function readStores(db) {
  return db.prepare(`
    SELECT id, name, address, latitude, longitude, checkin_radius AS checkinRadius, status
    FROM stores
    ORDER BY created_at, id
  `).all();
}

function readStaff(db) {
  const memberships = db.prepare('SELECT staff_id AS staffId, store_id AS storeId FROM staff_store_memberships ORDER BY store_id').all();
  const storeIdsByStaff = memberships.reduce((map, item) => {
    if (!map[item.staffId]) map[item.staffId] = [];
    map[item.staffId].push(item.storeId);
    return map;
  }, {});

  return db.prepare(`
    SELECT
      id,
      name,
      gender,
      age,
      id_card AS idCard,
      role,
      position,
      phone,
      hire_date AS hireDate,
      max_per_week AS maxPerWeek,
      status,
      invite_code AS inviteCode,
      avatar_url AS avatarUrl,
      openid_bound AS openidBound
    FROM staff
    ORDER BY created_at, id
  `).all().map((item) => ({
    ...item,
    storeIds: storeIdsByStaff[item.id] || [],
    openidBound: intToBool(item.openidBound)
  }));
}

function readStaffRoleRelations(db) {
  return db.prepare(`
    SELECT id, staff_id AS staffId, phone, position, position_text AS positionText, role
    FROM staff_role_relations
    ORDER BY created_at, id
  `).all();
}

function readShifts(db) {
  return db.prepare(`
    SELECT id, name, time, need, color
    FROM shifts
    ORDER BY time, created_at, id
  `).all();
}

function readSchedule(db) {
  const rows = db.prepare(`
    SELECT store_id AS storeId, work_date AS date, shift_id AS shiftId, staff_ids_json AS staffIdsJson
    FROM schedules
    ORDER BY store_id, work_date, shift_id
  `).all();

  return rows.reduce((schedule, row) => {
    if (!schedule[row.storeId]) schedule[row.storeId] = {};
    if (!schedule[row.storeId][row.date]) schedule[row.storeId][row.date] = {};
    schedule[row.storeId][row.date][row.shiftId] = parseJson(row.staffIdsJson, []);
    return schedule;
  }, {});
}

function readAttendance(db) {
  return db.prepare(`
    SELECT
      id,
      work_date AS date,
      store_id AS storeId,
      store_name AS storeName,
      staff_id AS staffId,
      shift_id AS shiftId,
      latitude,
      longitude,
      distance,
      result,
      clock_in AS clockIn,
      clock_out AS clockOut,
      out_latitude AS outLatitude,
      out_longitude AS outLongitude,
      out_distance AS outDistance
    FROM attendance_records
    ORDER BY created_at, id
  `).all();
}

function readSnapshot(db) {
  return {
    stores: readStores(db),
    staff: readStaff(db),
    staffRoleRelations: readStaffRoleRelations(db),
    shifts: readShifts(db),
    schedule: readSchedule(db),
    attendance: readAttendance(db)
  };
}

function replaceStores(db, stores) {
  const insert = db.prepare(`
    INSERT INTO stores (id, name, address, latitude, longitude, checkin_radius, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      checkin_radius = excluded.checkin_radius,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `);
  const ids = [];
  (stores || []).forEach((item) => {
    ids.push(item.id);
    insert.run(
      item.id,
      item.name || '',
      item.address || '',
      item.latitude == null ? null : Number(item.latitude),
      item.longitude == null ? null : Number(item.longitude),
      Number(item.checkinRadius) || 200,
      item.status || 'active'
    );
  });
  if (ids.length) {
    db.prepare(`DELETE FROM stores WHERE id NOT IN (${ids.map(() => '?').join(',')})`).run(...ids);
  } else {
    db.prepare('DELETE FROM stores').run();
  }
}

function replaceStaff(db, staff) {
  const insertStaff = db.prepare(`
    INSERT INTO staff (
      id, name, gender, age, id_card, role, position, phone, hire_date,
      max_per_week, status, invite_code, avatar_url, openid_bound, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      gender = excluded.gender,
      age = excluded.age,
      id_card = excluded.id_card,
      role = excluded.role,
      position = excluded.position,
      phone = excluded.phone,
      hire_date = excluded.hire_date,
      max_per_week = excluded.max_per_week,
      status = excluded.status,
      invite_code = excluded.invite_code,
      avatar_url = excluded.avatar_url,
      openid_bound = excluded.openid_bound,
      updated_at = CURRENT_TIMESTAMP
  `);
  const insertMembership = db.prepare(`
    INSERT OR IGNORE INTO staff_store_memberships (staff_id, store_id)
    VALUES (?, ?)
  `);
  const deleteMemberships = db.prepare('DELETE FROM staff_store_memberships WHERE staff_id = ?');
  const ids = [];
  (staff || []).forEach((item) => {
    ids.push(item.id);
    insertStaff.run(
      item.id,
      item.name || '',
      item.gender || '',
      item.age === '' ? null : Number(item.age || 0),
      item.idCard || '',
      item.role || '',
      item.position || '',
      item.phone || '',
      item.hireDate || '',
      Number(item.maxPerWeek) || 6,
      item.status || 'active',
      item.inviteCode || '',
      item.avatarUrl || '',
      boolToInt(item.openidBound)
    );
    deleteMemberships.run(item.id);
    (item.storeIds || []).forEach((storeId) => {
      insertMembership.run(item.id, storeId);
    });
  });
  if (ids.length) {
    db.prepare(`DELETE FROM staff WHERE id NOT IN (${ids.map(() => '?').join(',')})`).run(...ids);
  } else {
    db.prepare('DELETE FROM staff').run();
  }
}

function replaceStaffRoleRelations(db, relations) {
  const insert = db.prepare(`
    INSERT INTO staff_role_relations (id, staff_id, phone, position, position_text, role, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      staff_id = excluded.staff_id,
      phone = excluded.phone,
      position = excluded.position,
      position_text = excluded.position_text,
      role = excluded.role,
      updated_at = CURRENT_TIMESTAMP
  `);
  const ids = [];
  (relations || []).forEach((item) => {
    const id = item.id || `rr_${item.staffId}`;
    ids.push(id);
    insert.run(
      id,
      item.staffId,
      item.phone || '',
      item.position || 'staff',
      item.positionText || '',
      normalizeRole(item.role, item.position)
    );
  });
  if (ids.length) {
    db.prepare(`DELETE FROM staff_role_relations WHERE id NOT IN (${ids.map(() => '?').join(',')})`).run(...ids);
  } else {
    db.prepare('DELETE FROM staff_role_relations').run();
  }
}

function replaceShifts(db, shifts) {
  const insert = db.prepare(`
    INSERT INTO shifts (id, name, time, need, color, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      time = excluded.time,
      need = excluded.need,
      color = excluded.color,
      updated_at = CURRENT_TIMESTAMP
  `);
  const ids = [];
  (shifts || []).forEach((item) => {
    ids.push(item.id);
    insert.run(
      item.id,
      item.name || '',
      item.time || '',
      Number(item.need) || 1,
      item.color || ''
    );
  });
  if (ids.length) {
    db.prepare(`DELETE FROM shifts WHERE id NOT IN (${ids.map(() => '?').join(',')})`).run(...ids);
  } else {
    db.prepare('DELETE FROM shifts').run();
  }
}

function replaceSchedule(db, schedule) {
  const insert = db.prepare(`
    INSERT INTO schedules (store_id, work_date, shift_id, staff_ids_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  db.prepare('DELETE FROM schedules').run();
  Object.keys(schedule || {}).forEach((storeId) => {
    const storeSchedule = schedule[storeId] || {};
    Object.keys(storeSchedule).forEach((date) => {
      const day = storeSchedule[date] || {};
      Object.keys(day).forEach((shiftId) => {
        insert.run(storeId, date, shiftId, JSON.stringify(day[shiftId] || []));
      });
    });
  });
}

function replaceAttendance(db, attendance) {
  const insert = db.prepare(`
    INSERT INTO attendance_records (
      id, work_date, store_id, store_name, staff_id, shift_id, latitude, longitude, distance,
      result, clock_in, clock_out, out_latitude, out_longitude, out_distance, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  db.prepare('DELETE FROM attendance_records').run();
  (attendance || []).forEach((item) => {
    insert.run(
      item.id,
      item.date,
      item.storeId || '',
      item.storeName || '',
      item.staffId,
      item.shiftId,
      item.latitude == null ? null : Number(item.latitude),
      item.longitude == null ? null : Number(item.longitude),
      item.distance == null ? null : Number(item.distance),
      item.result || 'normal',
      item.clockIn || '',
      item.clockOut || '',
      item.outLatitude == null ? null : Number(item.outLatitude),
      item.outLongitude == null ? null : Number(item.outLongitude),
      item.outDistance == null ? null : Number(item.outDistance)
    );
  });
}

function replaceResource(db, resource, value) {
  transaction(db, () => {
    if (resource === 'stores') replaceStores(db, value);
    if (resource === 'staff') replaceStaff(db, value);
    if (resource === 'staffRoleRelations') replaceStaffRoleRelations(db, value);
    if (resource === 'shifts') replaceShifts(db, value);
    if (resource === 'schedule') replaceSchedule(db, value);
    if (resource === 'attendance') replaceAttendance(db, value);
  });
}

function replaceSnapshot(db, snapshot) {
  transaction(db, () => {
    if (snapshot.stores) replaceStores(db, snapshot.stores);
    if (snapshot.staff) replaceStaff(db, snapshot.staff);
    if (snapshot.staffRoleRelations) replaceStaffRoleRelations(db, snapshot.staffRoleRelations);
    if (snapshot.shifts) replaceShifts(db, snapshot.shifts);
    if (snapshot.schedule) replaceSchedule(db, snapshot.schedule);
    if (snapshot.attendance) replaceAttendance(db, snapshot.attendance);
  });
}

function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM stores').get();
  if (row.count > 0) return;
  replaceSnapshot(db, {
    stores: defaultStores,
    staff: defaultStaff,
    staffRoleRelations: defaultStaffRoleRelations,
    shifts: defaultShifts,
    schedule: {},
    attendance: []
  });
}

function resolveAccount(db, params) {
  const phone = String((params && (params.phone || params.mobile)) || '').replace(/\D/g, '');
  const staffId = params && params.staffId ? params.staffId : '';
  const staff = phone
    ? db.prepare('SELECT id, phone FROM staff WHERE REPLACE(REPLACE(phone, " ", ""), "-", "") = ? AND status != "left" LIMIT 1').get(phone)
    : null;
  const relation = phone
    ? db.prepare('SELECT staff_id AS staffId, role, phone FROM staff_role_relations WHERE REPLACE(REPLACE(phone, " ", ""), "-", "") = ? LIMIT 1').get(phone)
    : null;
  const resolvedStaffId = (relation && relation.staffId) || (staff && staff.id) || staffId || '';
  const roleRow = resolvedStaffId
    ? db.prepare('SELECT role FROM staff_role_relations WHERE staff_id = ? LIMIT 1').get(resolvedStaffId)
    : null;

  return {
    phone,
    staffId: resolvedStaffId,
    role: roleRow ? normalizeRole(roleRow.role) : 'employee',
    message: phone ? 'account_resolved' : 'wechat_phone_exchange_not_configured'
  };
}

function openDatabase(dbPath) {
  ensureDirForDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  migrate(db);
  seedIfEmpty(db);
  return db;
}

module.exports = {
  RESOURCE_NAMES,
  openDatabase,
  readSnapshot,
  replaceResource,
  replaceSnapshot,
  resolveAccount
};
