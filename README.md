# 班次小助手小程序

这是一个微信小程序 MVP，用于人员班次安排和打卡记录。

## 当前功能

- 月份班表视图
- 管理端 / 员工端工作台
- 多门店管理和当前门店切换
- 员工入职邀请、入职码注册和离职管理
- 员工微信头像、昵称、手机号授权流程
- 早班 / 中班 / 夜班三班次
- 按班次人数自动生成本月班表
- 点班次单元格手动调整伙伴
- 员工新增、删除
- 员工归属门店
- 班次所需人数调整
- 基于定位自动匹配门店打卡
- 本地存储班表数据

## 员工登录说明

- 管理端在「员工维护」里办理入职，系统生成入职码。
- 员工扫码进入小程序时可带入 `inviteCode` 参数，或在员工端手动输入入职码。
- 员工完成头像、昵称、手机号和入职码绑定后，本机后续打开会自动识别为员工端。
- 管理端办理离职后，该员工不会参与新生成的班次安排，也不能继续打卡。
- 体验版默认开启角色切换入口，方便同一台手机同时测试管理端和员工端；正式上线前可在「门店与规则」关闭。
- 头像：使用 `button open-type="chooseAvatar"` 获取。
- 昵称：使用 `input type="nickname"` 获取。
- 手机号：使用 `button open-type="getPhoneNumber"` 获取一次性 `code`。
- 小程序前端不能直接拿到真实手机号，需要把 `code` 发给后端或云函数，再由服务端调用微信接口换取手机号。
- 当前 MVP 已在 `utils/auth.js` 预留 `/employee/wechat/phone` 接口位置；未配置后端或手机号授权失败时，可手动填写手机号完成体验版绑定。

## 多门店打卡说明

- 管理端在「门店与规则」里维护门店名称、地址、经纬度和打卡半径。
- 工作台可切换当前门店，班表会按当前门店生成和展示。
- 员工新增时默认归属当前门店。
- 员工打卡时调用 `wx.getLocation` 获取当前位置，系统会在员工所属门店或当天被安排门店中匹配最近门店。
- 距离小于门店设置的打卡半径才允许打卡，记录会保存门店、经纬度和距离。
- 正式发布前，需要在小程序后台申请位置接口权限，并在隐私协议里说明定位仅用于打卡门店匹配。

## 后端与数据库

项目已新增 `backend-springboot/` Spring Boot + MySQL 后端，用于替代微信云开发并持久化员工信息、员工角色、门店、班次、班表和打卡记录。原轻量 Node.js + SQLite 后端仍保留为本地开发参考。

当前小程序的 `utils/config.js` 已切换为自有服务器模式：

```js
const API_BASE = 'http://114.67.227.98:8080';
const USE_CLOUD_DATABASE = false;
```

正式发布前需要把 `API_BASE` 换成 HTTPS 域名，并在微信公众平台配置 request 合法域名。

### Spring Boot + MySQL 后端

后端目录：

```text
backend-springboot/
```

默认连接数据库：

```text
database: netbar_scheduler_miniprogram
username: admin
password file on server: /root/mysql-netbar_scheduler_miniprogram-admin-password.txt
```

本地打包：

```bash
cd backend-springboot
mvn -s settings-public.xml clean package
```

云服务器上已部署为 systemd 服务：

```bash
systemctl status netbar-scheduler-backend
systemctl restart netbar-scheduler-backend
journalctl -u netbar-scheduler-backend -f
```

健康检查：

```bash
curl http://114.67.227.98:8080/api/health
```

接口契约与原 Node 后端保持一致，小程序无需大改页面逻辑。

### 微信云开发数据库

微信云开发里数据库“表”对应的是集合。项目已新增以下云函数：

- `initCloudDatabase`：创建集合并写入初始化数据。
- `getCloudSnapshot`：读取门店、员工、职位、班次、排班和打卡数据。
- `saveCloudResource`：保存小程序侧变更，例如办理入职、排班、打卡。
- `getPhoneNumberAndRole`：通过微信手机号授权 code 获取手机号，并查询员工职位。
- `getCurrentUserRole`：根据当前微信 openid 查询已绑定员工，用于打开小程序时自动登录。

需要创建的集合如下：

- `netbar_stores`：网吧店表，包含 `storeId`、`location`、`name`、`checkinRadius`、`status`。
- `netbar_staff`：员工表，包含 `storeId`、`staffId`、`name`、`gender`、`age`、`idCard`、`phone`、`hireDate`、`status`。
- `netbar_staff_roles`：员工职位表，包含 `storeId`、`staffId`、`phone`、`position`、`positionText`、`role`。`position` 枚举：`manager` 店长、`cashier` 收银、`staff` 普通员工。
- `netbar_shifts`：班次表，包含 `shiftId`、`name`、`startTime`、`endTime`、`need`。
- `netbar_schedules`：排班表，包含 `scheduleId`、`storeId`、`date`、`startTime`、`endTime`、`shiftId`、`shiftName`、`staffId`、`staffName`、`position`、`status`。
- `netbar_attendance_records`：打卡记录表，包含 `recordId`、`storeId`、`staffId`、`shiftId`、`date`、`clockIn`、`clockOut`、定位和距离信息。

初始化数据包含：

- 门店 1：星河网吧旗舰店
- 门店 2：疾风电竞网吧滨江店
- 店长员工：张明远，手机号 `15522013798`，职位 `manager`
- 普通员工：李安安，手机号 `15922251233`，职位 `staff`

创建集合和初始化数据：

1. 用微信开发者工具打开项目。
2. 确认 `project.config.json` 中已有 `"cloudfunctionRoot": "cloudfunctions/"`。
3. 在「云开发」面板确认当前环境为 `cloud1-d9g6y0rdyaa7aecd9`。
4. 右键 `cloudfunctions/initCloudDatabase`，选择「上传并部署：云端安装依赖」。
5. 同样上传部署 `getCloudSnapshot`、`saveCloudResource`、`getPhoneNumberAndRole`、`getCurrentUserRole`。
6. 右键 `initCloudDatabase`，选择「云端测试」或「本地调试」，参数填 `{}`，运行一次。
7. 到云开发控制台的数据库里查看上述集合和初始化数据。

用户进入小程序后的身份链路：

1. 小程序启动时 `wx.cloud.init` 连接云环境。
2. 首页先调用 `getCurrentUserRole`，如果当前 openid 已绑定员工则自动进入对应工作台。
3. 自动登录失败时展示极简登录页，支持手机号 + 验证码 / 密码登录。
4. 用户点击「微信手机号授权登录」后，小程序调用 `getPhoneNumberAndRole`。
5. 云函数用手机号查询 `netbar_staff_roles`。
6. `position = manager` 或 `role = admin` 时进入管理端；其他职位进入员工端。
7. 管理端可查看本店员工和班表，并在「员工维护」里办理普通员工入职。

### 体验不同角色登录

首页现在是极简登录页。未登录时不会直接进入管理端，也不会显示底部菜单栏，可以用两种方式体验：

- 输入手机号 `15522013798`，验证码或密码填 `123456`，进入管理端。
- 输入手机号 `15922251233`，验证码或密码填 `123456`，进入员工端。
- 或点击「微信手机号授权登录」，先弹出授权确认面板，再点击「授权手机号并登录」触发微信原生手机号授权弹窗，授权后自动识别职位。

如果开发者工具仍然直接显示工作台，通常是本地缓存里还有旧身份。可以在模拟器里点击首页「退出」，或在微信开发者工具中选择「清缓存」后重新编译。

### 启动后端

1. 确认本机 Node.js 版本不低于 22.5。后端使用 Node.js 内置 SQLite，脚本已关闭对应实验特性提示。
2. 在仓库根目录执行 `npm run server:init` 初始化数据库。
3. 执行 `npm run server` 启动接口服务，默认地址为 `http://127.0.0.1:3000`。
4. 在 `utils/config.js` 中把 `API_BASE` 改成后端地址，例如：

```js
const API_BASE = 'http://127.0.0.1:3000';
```

`API_BASE` 为空时，小程序仍按原来的本地存储 MVP 模式运行；配置后，启动时会从后端拉取数据，员工、角色、门店、班次、班表和打卡记录的变更会异步写回后端。

### 数据库表

- `stores`：门店信息、坐标和打卡半径。
- `staff`：员工档案、岗位、手机号、入职码和在职状态。
- `staff_store_memberships`：员工归属门店关系。
- `staff_role_relations`：员工系统角色，区分管理员和普通员工。
- `shifts`：早班 / 中班 / 夜班等班次规则。
- `schedules`：按门店、日期、班次保存排班员工。
- `attendance_records`：上下班打卡时间、门店、定位坐标和距离。
- `employee_bindings`：预留微信 openid / unionid 与员工档案绑定。

### 主要接口

- `GET /api/health`：健康检查。
- `GET /api/snapshot`：一次性读取小程序所需全量数据。
- `POST /api/snapshot`：批量覆盖全量数据，适合导入或迁移。
- `PUT /api/snapshot/:resource`：覆盖单个资源，`resource` 可选 `staff`、`staffRoleRelations`、`stores`、`shifts`、`schedule`、`attendance`。
- `POST /api/employee/wechat/phone`：员工手机号识别接口。当前后端保留微信手机号换取位置，接入正式微信接口后可用 `phoneCode` 换取真实手机号。

## 使用方式

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择本仓库根目录。
4. AppID 可先使用测试号或替换 `project.config.json` 里的 `appid`。

## 后续可扩展

- 导入 / 导出 Excel 班表
- 云函数或正式服务端换取手机号并自动匹配员工档案
- 权限鉴权、管理员登录和接口签名
- 员工请假、不可安排日期
- 夜班后自动休息约束
- 按岗位匹配班次，例如收银、网管、店长
- 班次冲突检测和统计报表
