const http = require('http');
const path = require('path');
const {
  RESOURCE_NAMES,
  openDatabase,
  readSnapshot,
  replaceResource,
  replaceSnapshot,
  resolveAccount
} = require('./db');

const DEFAULT_PORT = 3000;
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'netbar-scheduler.sqlite');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024 * 5) {
        req.destroy(new Error('request_body_too_large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('invalid_json_body'));
      }
    });
    req.on('error', reject);
  });
}

function getResource(snapshot, resource) {
  if (resource === 'staff') return snapshot.staff;
  if (resource === 'staffRoleRelations') return snapshot.staffRoleRelations;
  if (resource === 'stores') return snapshot.stores;
  if (resource === 'shifts') return snapshot.shifts;
  if (resource === 'schedule') return snapshot.schedule;
  if (resource === 'attendance') return snapshot.attendance;
  return null;
}

function createServer(options) {
  const db = openDatabase((options && options.dbPath) || process.env.DB_PATH || DEFAULT_DB_PATH);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const method = req.method.toUpperCase();
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    try {
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === 'GET' && pathname === '/api/snapshot') {
        sendJson(res, 200, readSnapshot(db));
        return;
      }

      if (method === 'POST' && pathname === '/api/snapshot') {
        const body = await readBody(req);
        replaceSnapshot(db, body || {});
        sendJson(res, 200, readSnapshot(db));
        return;
      }

      const snapshotResourceMatch = pathname.match(/^\/api\/snapshot\/([^/]+)$/);
      if (snapshotResourceMatch && method === 'PUT') {
        const resource = snapshotResourceMatch[1];
        if (!RESOURCE_NAMES.includes(resource)) {
          sendJson(res, 404, { message: 'resource_not_found' });
          return;
        }
        const body = await readBody(req);
        replaceResource(db, resource, body.value);
        sendJson(res, 200, { ok: true, [resource]: getResource(readSnapshot(db), resource) });
        return;
      }

      const resourceMatch = pathname.match(/^\/api\/([^/]+)$/);
      if (resourceMatch && RESOURCE_NAMES.includes(resourceMatch[1])) {
        const resource = resourceMatch[1];
        if (method === 'GET') {
          sendJson(res, 200, getResource(readSnapshot(db), resource));
          return;
        }
        if (method === 'PUT') {
          const body = await readBody(req);
          replaceResource(db, resource, Array.isArray(body) ? body : body.value);
          sendJson(res, 200, getResource(readSnapshot(db), resource));
          return;
        }
      }

      if (method === 'POST' && pathname === '/api/employee/wechat/phone') {
        const body = await readBody(req);
        sendJson(res, 200, resolveAccount(db, body));
        return;
      }

      sendJson(res, 404, { message: 'not_found' });
    } catch (error) {
      sendJson(res, error.message === 'invalid_json_body' ? 400 : 500, {
        message: error.message || 'server_error'
      });
    }
  });
}

if (require.main === module) {
  const initOnly = process.argv.includes('--init-only');
  if (initOnly) {
    openDatabase(process.env.DB_PATH || DEFAULT_DB_PATH).close();
    console.log(`database initialized: ${process.env.DB_PATH || DEFAULT_DB_PATH}`);
  } else {
    const port = Number(process.env.PORT) || DEFAULT_PORT;
    createServer().listen(port, () => {
      console.log(`netbar scheduler backend listening on http://127.0.0.1:${port}`);
    });
  }
}

module.exports = {
  createServer
};
