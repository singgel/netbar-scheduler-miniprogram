package com.netbar.scheduler.backend.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class SnapshotRepository {

  public static final List<String> RESOURCE_NAMES = Collections.unmodifiableList(
      java.util.Arrays.asList("staff", "staffRoleRelations", "stores", "shifts", "schedule", "attendance"));

  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;

  public SnapshotRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;
  }

  @PostConstruct
  public void ensureSchema() {
    ensureColumn("staff", "avatar_url", "VARCHAR(512) DEFAULT ''");
  }

  public Map<String, Object> readSnapshot() {
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("stores", readStores());
    snapshot.put("staff", readStaff());
    snapshot.put("staffRoleRelations", readStaffRoleRelations());
    snapshot.put("shifts", readShifts());
    snapshot.put("schedule", readSchedule());
    snapshot.put("attendance", readAttendance());
    return snapshot;
  }

  public Object readResource(String resource) {
    switch (resource) {
      case "stores":
        return readStores();
      case "staff":
        return readStaff();
      case "staffRoleRelations":
        return readStaffRoleRelations();
      case "shifts":
        return readShifts();
      case "schedule":
        return readSchedule();
      case "attendance":
        return readAttendance();
      default:
        throw new IllegalArgumentException("resource_not_found");
    }
  }

  public List<Map<String, Object>> readStores() {
    return jdbcTemplate.queryForList(
        "SELECT id, name, address, latitude, longitude, checkin_radius AS checkinRadius, status "
            + "FROM stores ORDER BY created_at, id");
  }

  public List<Map<String, Object>> readStaff() {
    Map<String, List<String>> storeIdsByStaff = new LinkedHashMap<>();
    jdbcTemplate.queryForList(
        "SELECT staff_id AS staffId, store_id AS storeId FROM staff_store_memberships ORDER BY store_id")
        .forEach(row -> storeIdsByStaff
            .computeIfAbsent(asString(row.get("staffId")), key -> new ArrayList<>())
            .add(asString(row.get("storeId"))));

    return jdbcTemplate.queryForList(
        "SELECT id, name, gender, age, id_card AS idCard, role, position, phone, hire_date AS hireDate, "
            + "max_per_week AS maxPerWeek, status, invite_code AS inviteCode, avatar_url AS avatarUrl, "
            + "openid_bound AS openidBound "
            + "FROM staff ORDER BY created_at, id")
        .stream()
        .map(row -> {
          Map<String, Object> item = new LinkedHashMap<>(row);
          item.put("storeIds", storeIdsByStaff.getOrDefault(asString(row.get("id")), Collections.emptyList()));
          item.put("openidBound", toBoolean(row.get("openidBound")));
          return item;
        })
        .collect(Collectors.toList());
  }

  public List<Map<String, Object>> readStaffRoleRelations() {
    return jdbcTemplate.queryForList(
        "SELECT id, store_id AS storeId, staff_id AS staffId, phone, position, position_text AS positionText, role "
            + "FROM staff_role_relations ORDER BY created_at, id");
  }

  public List<Map<String, Object>> readShifts() {
    return jdbcTemplate.queryForList(
        "SELECT id, name, time, need_count AS need, color FROM shifts ORDER BY time, created_at, id");
  }

  public Map<String, Object> readSchedule() {
    Map<String, Object> schedule = new LinkedHashMap<>();
    jdbcTemplate.queryForList(
        "SELECT store_id AS storeId, work_date AS date, shift_id AS shiftId, "
            + "CAST(staff_ids_json AS CHAR) AS staffIdsJson FROM schedules ORDER BY store_id, work_date, shift_id")
        .forEach(row -> {
          String storeId = asString(row.get("storeId"));
          String date = asString(row.get("date"));
          String shiftId = asString(row.get("shiftId"));
          @SuppressWarnings("unchecked")
          Map<String, Object> storeSchedule = (Map<String, Object>) schedule
              .computeIfAbsent(storeId, key -> new LinkedHashMap<String, Object>());
          @SuppressWarnings("unchecked")
          Map<String, Object> daySchedule = (Map<String, Object>) storeSchedule
              .computeIfAbsent(date, key -> new LinkedHashMap<String, Object>());
          daySchedule.put(shiftId, parseJsonArray(asString(row.get("staffIdsJson"))));
        });
    return schedule;
  }

  public List<Map<String, Object>> readAttendance() {
    return jdbcTemplate.queryForList(
        "SELECT id, work_date AS date, store_id AS storeId, store_name AS storeName, staff_id AS staffId, "
            + "shift_id AS shiftId, latitude, longitude, distance, result, clock_in AS clockIn, clock_out AS clockOut, "
            + "out_latitude AS outLatitude, out_longitude AS outLongitude, out_distance AS outDistance "
            + "FROM attendance_records ORDER BY created_at, id");
  }

  @Transactional
  public void replaceSnapshot(Map<String, Object> snapshot) {
    if (snapshot.containsKey("stores")) replaceStores(asList(snapshot.get("stores")));
    if (snapshot.containsKey("staff")) replaceStaff(asList(snapshot.get("staff")));
    if (snapshot.containsKey("staffRoleRelations")) replaceStaffRoleRelations(asList(snapshot.get("staffRoleRelations")));
    if (snapshot.containsKey("shifts")) replaceShifts(asList(snapshot.get("shifts")));
    if (snapshot.containsKey("schedule")) replaceSchedule(asMap(snapshot.get("schedule")));
    if (snapshot.containsKey("attendance")) replaceAttendance(asList(snapshot.get("attendance")));
  }

  @Transactional
  public void replaceResource(String resource, Object value) {
    switch (resource) {
      case "stores":
        replaceStores(asList(value));
        return;
      case "staff":
        replaceStaff(asList(value));
        return;
      case "staffRoleRelations":
        replaceStaffRoleRelations(asList(value));
        return;
      case "shifts":
        replaceShifts(asList(value));
        return;
      case "schedule":
        replaceSchedule(asMap(value));
        return;
      case "attendance":
        replaceAttendance(asList(value));
        return;
      default:
        throw new IllegalArgumentException("resource_not_found");
    }
  }

  public Map<String, Object> resolveAccount(Map<String, Object> params) {
    String phone = onlyDigits(firstNonBlank(params, "phone", "mobile", "manualPhone"));
    String staffId = asString(params.get("staffId"));

    Map<String, Object> staff = phone.isEmpty()
        ? null
        : queryFirst("SELECT id, phone FROM staff WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') = ? "
            + "AND status != 'left' LIMIT 1", phone);
    Map<String, Object> relation = phone.isEmpty()
        ? null
        : queryFirst("SELECT staff_id AS staffId, role, phone FROM staff_role_relations "
            + "WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') = ? LIMIT 1", phone);

    String resolvedStaffId = relation != null ? asString(relation.get("staffId"))
        : staff != null ? asString(staff.get("id")) : staffId;
    Map<String, Object> roleRow = resolvedStaffId.isEmpty()
        ? null
        : queryFirst("SELECT role FROM staff_role_relations WHERE staff_id = ? LIMIT 1", resolvedStaffId);
    Map<String, Object> staffRow = resolvedStaffId.isEmpty()
        ? null
        : queryFirst("SELECT id, name, gender, age, id_card AS idCard, role, position, phone, "
            + "hire_date AS hireDate, max_per_week AS maxPerWeek, status, invite_code AS inviteCode, "
            + "avatar_url AS avatarUrl "
            + "FROM staff WHERE id = ? LIMIT 1", resolvedStaffId);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("phone", phone);
    result.put("staffId", resolvedStaffId);
    result.put("role", roleRow == null ? "employee" : normalizeRole(asString(roleRow.get("role")), ""));
    result.put("message", phone.isEmpty() ? "wechat_phone_exchange_not_configured" : "account_resolved");
    if (staffRow != null) {
      result.put("staff", staffRow);
    }
    return result;
  }

  private void replaceStores(List<Map<String, Object>> stores) {
    List<String> ids = new ArrayList<>();
    for (Map<String, Object> item : stores) {
      String id = asString(item.get("id"));
      if (id.isEmpty()) continue;
      ids.add(id);
      jdbcTemplate.update(
          "INSERT INTO stores (id, name, address, latitude, longitude, checkin_radius, status) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?) "
              + "ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), latitude=VALUES(latitude), "
              + "longitude=VALUES(longitude), checkin_radius=VALUES(checkin_radius), status=VALUES(status)",
          id,
          defaultString(item.get("name")),
          defaultString(item.get("address")),
          nullableDouble(item.get("latitude")),
          nullableDouble(item.get("longitude")),
          intValue(item.get("checkinRadius"), 200),
          defaultString(item.get("status"), "active"));
    }
    deleteMissing("stores", ids);
  }

  private void replaceStaff(List<Map<String, Object>> staff) {
    List<String> ids = new ArrayList<>();
    for (Map<String, Object> item : staff) {
      String id = asString(item.get("id"));
      if (id.isEmpty()) continue;
      ids.add(id);
      jdbcTemplate.update(
          "INSERT INTO staff (id, name, gender, age, id_card, role, position, phone, hire_date, "
              + "max_per_week, status, invite_code, avatar_url, openid_bound) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON DUPLICATE KEY UPDATE name=VALUES(name), gender=VALUES(gender), age=VALUES(age), "
              + "id_card=VALUES(id_card), role=VALUES(role), position=VALUES(position), phone=VALUES(phone), "
              + "hire_date=VALUES(hire_date), max_per_week=VALUES(max_per_week), status=VALUES(status), "
              + "invite_code=VALUES(invite_code), avatar_url=VALUES(avatar_url), openid_bound=VALUES(openid_bound)",
          id,
          defaultString(item.get("name")),
          defaultString(item.get("gender")),
          nullableInteger(item.get("age")),
          defaultString(item.get("idCard")),
          defaultString(item.get("role")),
          defaultString(item.get("position")),
          defaultString(item.get("phone")),
          defaultString(item.get("hireDate")),
          intValue(item.get("maxPerWeek"), 6),
          defaultString(item.get("status"), "active"),
          defaultString(item.get("inviteCode")),
          defaultString(item.get("avatarUrl")),
          toBoolean(item.get("openidBound")) ? 1 : 0);

      jdbcTemplate.update("DELETE FROM staff_store_memberships WHERE staff_id = ?", id);
      for (Object storeId : asObjectList(item.get("storeIds"))) {
        String normalizedStoreId = asString(storeId);
        if (normalizedStoreId.isEmpty()) continue;
        jdbcTemplate.update(
            "INSERT IGNORE INTO staff_store_memberships (staff_id, store_id) "
                + "SELECT ?, ? FROM DUAL WHERE EXISTS (SELECT 1 FROM stores WHERE id = ?)",
            id, normalizedStoreId, normalizedStoreId);
      }
    }
    deleteMissing("staff", ids);
  }

  private void replaceStaffRoleRelations(List<Map<String, Object>> relations) {
    List<String> ids = new ArrayList<>();
    for (Map<String, Object> item : relations) {
      String staffId = asString(item.get("staffId"));
      if (staffId.isEmpty()) continue;
      String id = asString(item.get("id"));
      if (id.isEmpty()) id = "rr_" + staffId;
      ids.add(id);
      jdbcTemplate.update(
          "INSERT INTO staff_role_relations (id, staff_id, store_id, phone, position, position_text, role) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?) "
              + "ON DUPLICATE KEY UPDATE staff_id=VALUES(staff_id), store_id=VALUES(store_id), phone=VALUES(phone), "
              + "position=VALUES(position), position_text=VALUES(position_text), role=VALUES(role)",
          id,
          staffId,
          defaultString(item.get("storeId")),
          defaultString(item.get("phone")),
          defaultString(item.get("position"), "staff"),
          defaultString(item.get("positionText")),
          normalizeRole(defaultString(item.get("role")), defaultString(item.get("position"))));
    }
    deleteMissing("staff_role_relations", ids);
  }

  private void replaceShifts(List<Map<String, Object>> shifts) {
    List<String> ids = new ArrayList<>();
    for (Map<String, Object> item : shifts) {
      String id = asString(item.get("id"));
      if (id.isEmpty()) continue;
      ids.add(id);
      jdbcTemplate.update(
          "INSERT INTO shifts (id, name, time, need_count, color) VALUES (?, ?, ?, ?, ?) "
              + "ON DUPLICATE KEY UPDATE name=VALUES(name), time=VALUES(time), "
              + "need_count=VALUES(need_count), color=VALUES(color)",
          id,
          defaultString(item.get("name")),
          defaultString(item.get("time")),
          intValue(item.get("need"), 1),
          defaultString(item.get("color")));
    }
    deleteMissing("shifts", ids);
  }

  private void replaceSchedule(Map<String, Object> schedule) {
    jdbcTemplate.update("DELETE FROM schedules");
    for (Map.Entry<String, Object> storeEntry : schedule.entrySet()) {
      String storeId = storeEntry.getKey();
      Map<String, Object> storeSchedule = asMap(storeEntry.getValue());
      for (Map.Entry<String, Object> dateEntry : storeSchedule.entrySet()) {
        String date = dateEntry.getKey();
        Map<String, Object> daySchedule = asMap(dateEntry.getValue());
        for (Map.Entry<String, Object> shiftEntry : daySchedule.entrySet()) {
          jdbcTemplate.update(
              "INSERT INTO schedules (store_id, work_date, shift_id, staff_ids_json) "
                  + "SELECT ?, ?, ?, ? FROM DUAL "
                  + "WHERE EXISTS (SELECT 1 FROM stores WHERE id = ?) "
                  + "AND EXISTS (SELECT 1 FROM shifts WHERE id = ?)",
              storeId,
              date,
              shiftEntry.getKey(),
              toJson(asObjectList(shiftEntry.getValue())),
              storeId,
              shiftEntry.getKey());
        }
      }
    }
  }

  private void replaceAttendance(List<Map<String, Object>> attendance) {
    jdbcTemplate.update("DELETE FROM attendance_records");
    for (Map<String, Object> item : attendance) {
      String id = asString(item.get("id"));
      if (id.isEmpty()) id = UUID.randomUUID().toString();
      jdbcTemplate.update(
          "INSERT INTO attendance_records (id, work_date, store_id, store_name, staff_id, shift_id, "
              + "latitude, longitude, distance, result, clock_in, clock_out, out_latitude, out_longitude, out_distance) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          id,
          defaultString(item.get("date")),
          defaultString(item.get("storeId")),
          defaultString(item.get("storeName")),
          defaultString(item.get("staffId")),
          defaultString(item.get("shiftId")),
          nullableDouble(item.get("latitude")),
          nullableDouble(item.get("longitude")),
          nullableInteger(item.get("distance")),
          defaultString(item.get("result"), "normal"),
          defaultString(item.get("clockIn")),
          defaultString(item.get("clockOut")),
          nullableDouble(item.get("outLatitude")),
          nullableDouble(item.get("outLongitude")),
          nullableInteger(item.get("outDistance")));
    }
  }

  private void deleteMissing(String tableName, List<String> ids) {
    if (ids.isEmpty()) {
      jdbcTemplate.update("DELETE FROM " + tableName);
      return;
    }
    String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
    jdbcTemplate.update("DELETE FROM " + tableName + " WHERE id NOT IN (" + placeholders + ")", ids.toArray());
  }

  private Map<String, Object> queryFirst(String sql, Object... args) {
    List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, args);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void ensureColumn(String tableName, String columnName, String definition) {
    List<Map<String, Object>> rows = jdbcTemplate.queryForList("SHOW COLUMNS FROM " + tableName + " LIKE ?", columnName);
    if (!rows.isEmpty()) return;
    jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + definition);
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> asList(Object value) {
    if (value instanceof List<?>) {
      return ((List<?>) value).stream()
          .filter(Map.class::isInstance)
          .map(item -> (Map<String, Object>) item)
          .collect(Collectors.toList());
    }
    return Collections.emptyList();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> asMap(Object value) {
    if (value instanceof Map<?, ?>) {
      return (Map<String, Object>) value;
    }
    return Collections.emptyMap();
  }

  private List<Object> asObjectList(Object value) {
    if (value instanceof List<?>) {
      return new ArrayList<>((List<?>) value);
    }
    return Collections.emptyList();
  }

  private List<Object> parseJsonArray(String value) {
    if (value == null || value.isEmpty()) return Collections.emptyList();
    try {
      return objectMapper.readValue(value, new TypeReference<List<Object>>() {});
    } catch (JsonProcessingException error) {
      return Collections.emptyList();
    }
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException error) {
      return "[]";
    }
  }

  private String normalizeRole(String role, String position) {
    String normalizedRole = role == null ? "" : role.toLowerCase(Locale.ROOT);
    String normalizedPosition = position == null ? "" : position.toLowerCase(Locale.ROOT);
    if ("super_admin".equals(normalizedRole)) return "super_admin";
    if ("manager".equals(normalizedRole) || "admin".equals(normalizedRole) || "manager".equals(normalizedPosition)) {
      return "manager";
    }
    return "employee";
  }

  private String firstNonBlank(Map<String, Object> params, String... keys) {
    for (String key : keys) {
      String value = asString(params.get(key));
      if (!value.isEmpty()) return value;
    }
    return "";
  }

  private String onlyDigits(String value) {
    return value == null ? "" : value.replaceAll("\\D", "");
  }

  private String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String defaultString(Object value) {
    return defaultString(value, "");
  }

  private String defaultString(Object value, String fallback) {
    String text = asString(value);
    return text.isEmpty() ? fallback : text;
  }

  private boolean toBoolean(Object value) {
    if (value instanceof Boolean) return (Boolean) value;
    if (value instanceof Number) return ((Number) value).intValue() != 0;
    return "true".equalsIgnoreCase(asString(value)) || "1".equals(asString(value));
  }

  private Integer nullableInteger(Object value) {
    String text = asString(value);
    if (text.isEmpty()) return null;
    return Integer.valueOf(text);
  }

  private Double nullableDouble(Object value) {
    String text = asString(value);
    if (text.isEmpty()) return null;
    return Double.valueOf(text);
  }

  private int intValue(Object value, int fallback) {
    Integer integer = nullableInteger(value);
    return integer == null || integer == 0 ? fallback : integer;
  }
}
