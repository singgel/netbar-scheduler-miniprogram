# Netbar Scheduler Spring Boot Backend

Spring Boot 后端用于替代微信云开发，提供和原 Node.js 后端一致的小程序 API。

## API

- `GET /api/health`
- `GET /api/snapshot`
- `POST /api/snapshot`
- `PUT /api/snapshot/{resource}`
- `GET /api/{resource}`
- `PUT /api/{resource}`
- `POST /api/employee/wechat/phone`

`resource` 可选：

- `stores`
- `staff`
- `staffRoleRelations`
- `shifts`
- `schedule`
- `attendance`

## 本地启动

```bash
cd backend-springboot
MYSQL_PASSWORD='你的数据库密码' mvn spring-boot:run
```

默认连接：

```text
jdbc:mysql://127.0.0.1:3306/netbar_scheduler_miniprogram
username: admin
```

也可以覆盖：

```bash
MYSQL_HOST=127.0.0.1 \
MYSQL_PORT=3306 \
MYSQL_DATABASE=netbar_scheduler_miniprogram \
MYSQL_USERNAME=admin \
MYSQL_PASSWORD='你的数据库密码' \
SERVER_PORT=8080 \
mvn spring-boot:run
```

## 打包

```bash
cd backend-springboot
mvn clean package
```

如果本机 Maven 配置了不可访问的公司内网 mirror，可以临时使用仓库内的公开 settings：

```bash
mvn -s settings-public.xml clean package
```

产物：

```text
backend-springboot/target/netbar-scheduler-backend-0.1.0.jar
```

## 云服务器启动示例

服务器上的 MySQL 密码文件：

```text
/root/mysql-netbar_scheduler_miniprogram-admin-password.txt
```

启动：

```bash
MYSQL_PASSWORD="$(cat /root/mysql-netbar_scheduler_miniprogram-admin-password.txt)" \
java -jar netbar-scheduler-backend-0.1.0.jar
```

健康检查：

```bash
curl http://127.0.0.1:8080/api/health
```

小程序开发阶段当前配置为：

```js
const API_BASE = 'http://114.67.227.98:8080';
const USE_CLOUD_DATABASE = false;
```

正式发布小程序前，需要换成 HTTPS 域名，并在微信公众平台配置 request 合法域名。
