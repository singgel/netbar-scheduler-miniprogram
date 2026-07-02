function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthLabel(year, month) {
  return `${year}年${pad(month)}月`;
}

function getMonthDays(year, month) {
  const total = new Date(year, month, 0).getDate();
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const days = [];
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(year, month - 1, day);
    days.push({
      date: formatDate(date),
      day,
      week: weekNames[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }
  return days;
}

module.exports = {
  formatDate,
  monthLabel,
  getMonthDays
};
