function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function currentTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function parseShiftTime(time) {
  const parts = String(time || '').split('-');
  return {
    startTime: parts[0] || '',
    endTime: parts[1] || ''
  };
}

function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!match) return 24 * 60 + 1;
  return Number(match[1]) * 60 + Number(match[2]);
}

function buildShiftTime(startTime, endTime) {
  return `${startTime || '00:00'}-${endTime || '00:00'}`;
}

function decorateShift(shift) {
  const time = parseShiftTime(shift.time);
  return {
    ...shift,
    startTime: time.startTime,
    endTime: time.endTime
  };
}

function sortShiftsByStartTime(shifts) {
  return (shifts || [])
    .map((shift, index) => ({
      ...decorateShift(shift),
      originalIndex: index
    }))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.originalIndex - b.originalIndex)
    .map(({ originalIndex, ...shift }) => shift);
}

module.exports = {
  buildShiftTime,
  currentTime,
  decorateShift,
  sortShiftsByStartTime
};
