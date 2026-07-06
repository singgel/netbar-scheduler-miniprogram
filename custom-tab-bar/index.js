const { ROLE_KEY, EMPLOYEE_AUTH_KEY, getStore } = require('../utils/store');
const { isAdminSideRole } = require('../utils/role');

const adminItems = [
  { pagePath: 'pages/home/home', text: '工作台', icon: '台' },
  { pagePath: 'pages/schedule/schedule', text: '班表', icon: '日' },
  { pagePath: 'pages/staff/staff', text: '员工', icon: '人' },
  { pagePath: 'pages/settings/settings', text: '设置', icon: '设' }
];

const employeeItems = [
  { pagePath: 'pages/home/home', text: '工作台', icon: '台' },
  { pagePath: 'pages/schedule/schedule', text: '班表', icon: '日' },
  { pagePath: 'pages/attendance/attendance', text: '打卡', icon: '卡' }
];

Component({
  data: {
    hidden: false,
    selected: 'pages/home/home',
    items: employeeItems
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  methods: {
    refresh(route) {
      const role = getStore(ROLE_KEY, 'employee');
      const auth = getStore(EMPLOYEE_AUTH_KEY, {});
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1] || {};
      const selected = route || currentPage.route || 'pages/home/home';
      this.setData({
        hidden: selected === 'pages/home/home' && !(auth && auth.bound && auth.staffId),
        selected,
        items: isAdminSideRole(role) ? adminItems : employeeItems
      });
    },

    switchTab(event) {
      const path = event.currentTarget.dataset.path;
      if (!path || path === this.data.selected) return;
      wx.switchTab({ url: `/${path}` });
    }
  }
});
