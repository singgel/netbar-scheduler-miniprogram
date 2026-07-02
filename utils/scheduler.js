function nextStaff(staff, cursor, usage) {
  if (!staff.length) return null;
  const sorted = staff
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => (usage[a.id] || 0) - (usage[b.id] || 0) || a.index - b.index);
  const picked = sorted[cursor % sorted.length];
  usage[picked.id] = (usage[picked.id] || 0) + 1;
  return picked.id;
}

function generateMonthSchedule(days, shifts, staff) {
  const usage = {};
  const result = {};
  let cursor = 0;

  days.forEach((day) => {
    result[day.date] = {};
    const assignedToday = {};
    shifts.forEach((shift) => {
      result[day.date][shift.id] = [];
      for (let i = 0; i < shift.need; i += 1) {
        const candidates = staff.filter((person) => !assignedToday[person.id]);
        const picked = nextStaff(candidates.length ? candidates : staff, cursor, usage);
        cursor += 1;
        if (picked) {
          assignedToday[picked] = true;
          result[day.date][shift.id].push(picked);
        }
      }
    });
  });

  return result;
}

function staffNameMap(staff) {
  return staff.reduce((map, item) => {
    map[item.id] = item.name;
    return map;
  }, {});
}

module.exports = {
  generateMonthSchedule,
  staffNameMap
};
