const { ROLE_KEY, EMPLOYEE_AUTH_KEY, getStore } = require('../utils/store');
const { isAdminSideRole } = require('../utils/role');

const adminItems = [
  { pagePath: 'pages/home/home', text: '工作台', icon: '台' },
  { pagePath: 'pages/schedule/schedule', text: '班表', icon: '日' },
  { pagePath: 'pages/staff/staff', text: '员工', icon: '人' },
  { pagePath: 'pages/mine/mine', text: '我的', icon: '我' }
];

const employeeItems = [
  { pagePath: 'pages/home/home', text: '工作台', icon: '台' },
  { pagePath: 'pages/schedule/schedule', text: '班表', icon: '日' },
  { pagePath: 'pages/mine/mine', text: '我的', icon: '我' }
];

function resolveSelected(route, items) {
  if (items.some((item) => item.pagePath === route)) return route;
  if (route && route.indexOf('pages/mine/') === 0) return 'pages/mine/mine';
  return 'pages/home/home';
}

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
      const currentRoute = route || currentPage.route || 'pages/home/home';
      const items = isAdminSideRole(role) ? adminItems : employeeItems;
      this.setData({
        hidden: currentRoute === 'pages/home/home' && !(auth && auth.bound && auth.staffId),
        selected: resolveSelected(currentRoute, items),
        items
      });
    },

    switchTab(event) {
      const path = event.currentTarget.dataset.path;
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1] || {};
      if (!path || path === currentPage.route) return;
      wx.switchTab({ url: `/${path}` });
    }
  }
});
