INSERT IGNORE INTO stores (id, name, address, latitude, longitude, checkin_radius, status)
VALUES
  ('store1', '星河网吧旗舰店', '天津市南开区时代奥城商业广场', 39.0894, 117.1746, 200, 'active'),
  ('store2', '疾风电竞网吧滨江店', '天津市和平区滨江道商圈', 39.1248, 117.2009, 200, 'active');

INSERT IGNORE INTO staff (
  id, name, gender, age, id_card, role, position, phone, hire_date,
  max_per_week, status, invite_code, openid_bound
)
VALUES
  ('emp_super_001', '超级管理员', '男', 35, '120101199101010019', '超级管理员', 'manager', '15500000000', '2024-01-01', 6, 'active', '100000', 0),
  ('emp_manager_001', '张明远', '男', 32, '120101199403120018', '店长', 'manager', '15522013798', '2024-03-12', 6, 'active', '100001', 0),
  ('emp_staff_001', '李安安', '女', 24, '120101200206180027', '普通员工', 'staff', '15922251233', '2025-06-18', 6, 'active', '100002', 0);

INSERT IGNORE INTO staff_store_memberships (staff_id, store_id)
VALUES
  ('emp_super_001', 'store1'),
  ('emp_super_001', 'store2'),
  ('emp_manager_001', 'store1'),
  ('emp_staff_001', 'store1');

INSERT IGNORE INTO staff_role_relations (id, staff_id, store_id, phone, position, position_text, role)
VALUES
  ('rr_emp_super_001', 'emp_super_001', '', '15500000000', 'manager', '超级管理员', 'super_admin'),
  ('rr_emp_manager_001', 'emp_manager_001', 'store1', '15522013798', 'manager', '店长', 'manager'),
  ('rr_emp_staff_001', 'emp_staff_001', 'store1', '15922251233', 'staff', '普通员工', 'employee');

INSERT IGNORE INTO shifts (id, name, time, need_count, color)
VALUES
  ('morning', '早班', '08:00-16:00', 2, '#eaf6ff'),
  ('middle', '中班', '16:00-00:00', 2, '#f2f7e8'),
  ('night', '夜班', '00:00-08:00', 1, '#f8eefc');
