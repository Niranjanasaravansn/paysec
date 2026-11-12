const pool = require('../config/db');
async function log(conn, userId, action, entity, entityId, details, ip) {
  await (conn || pool).query('INSERT INTO audit_logs (user_id,action,entity,entity_id,details,ip) VALUES (?,?,?,?,?,?)',
    [userId, action, entity, String(entityId ?? ''), JSON.stringify(details || {}), ip || null]);
}
module.exports = { log };
