import { CommandHandler } from './types.js';
import { CONFIG } from '../config.js';
import bcrypt from 'bcryptjs';

export const verifySecurityKey: CommandHandler = (ctx, args) => {
  const { key } = args;
  if (key === CONFIG.SECURITY_KEY) {
    ctx.res.json({ verified: true });
  } else {
    ctx.res.status(403).json({ verified: false, error: 'Invalid security key' });
  }
};

export const handleLogin: CommandHandler = async (ctx, args) => {
  const { primaryDb, res } = ctx;
  const username = args.username || args.loginUsername;
  const password = args.password || args.loginPassword;
  
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  
  const user = primaryDb.prepare(`
    SELECT u.id, u.username, u.name, u.password, u.role_id, r.name as role_name, r.module_scope, u.is_hidden_superadmin 
    FROM users u 
    LEFT JOIN roles r ON u.role_id = r.id 
    WHERE u.username = ?
  `).get(username) as any;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = user.password.startsWith('$argon') ? false : await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const bridgeRow = primaryDb.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
  const isDisconnected = bridgeRow?.state === 'DISCONNECTED_AUDIT';
  let available_modules = isDisconnected ? ['P'] : ['K', 'P'];
  if (user.is_hidden_superadmin === 1) available_modules = ['K', 'P']; // Admin can always access both.

  const rolePermissions = primaryDb.prepare('SELECT * FROM role_permissions WHERE role_id = ?').all(user.role_id) as any[];
  const permissionsMap: Record<string, boolean> = {};
  for (const rp of rolePermissions) {
      if (rp.can_view) permissionsMap[`${rp.page_key}.view`] = true;
      if (rp.can_insert) permissionsMap[`${rp.page_key}.insert`] = true;
      if (rp.can_edit) permissionsMap[`${rp.page_key}.edit`] = true;
      if (rp.can_delete) permissionsMap[`${rp.page_key}.delete`] = true;
      if (rp.can_view) permissionsMap[rp.page_key] = true;
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role_name,
    is_hidden_superadmin: user.is_hidden_superadmin === 1,
    rbac_cache: {
      permissions: permissionsMap,
      module_scope: user.module_scope || 'NONE'
    },
    available_modules,
    connection_status: isDisconnected ? 'DISCONNECTED' : 'CONNECTED'
  });
};

export const userCrud: CommandHandler = async (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { operation, data, id } = args;
  if (operation === 'list') {
    const rows = primaryDb.prepare('SELECT u.id, u.name, u.username, u.role_id, r.name as role_name, u.status, u.is_locked FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE IFNULL(u.is_hidden_superadmin, 0) = 0').all();
    res.json(rows);
  } else if (operation === 'get_roles') {
    const rows = primaryDb.prepare('SELECT id, name, description, module_scope FROM roles').all();
    res.json(rows);
  } else if (operation === 'create') {
    if (!data.password) return res.status(400).json({ error: 'Password is required' });
    const hash = await bcrypt.hash(data.password, 10);
    primaryDb.prepare('INSERT INTO users (name, username, password, role_id, status) VALUES (?, ?, ?, ?, ?)')
      .run(data.name, data.username, hash, data.role_id, data.status);
    res.json({ status: 'success' });
  } else if (operation === 'update') {
    if (data.password) {
      const hash = await bcrypt.hash(data.password, 10);
      primaryDb.prepare('UPDATE users SET name = ?, username = ?, password = ?, role_id = ?, status = ? WHERE id = ?')
        .run(data.name, data.username, hash, data.role_id, data.status, id);
    } else {
      primaryDb.prepare('UPDATE users SET name = ?, username = ?, role_id = ?, status = ? WHERE id = ?')
        .run(data.name, data.username, data.role_id, data.status, id);
    }
    res.json({ status: 'success' });
  } else if (operation === 'delete') {
    primaryDb.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ status: 'success' });
  }
};

export const updateConnectionStatus: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { status } = args; // 'CONNECTED' or 'DISCONNECTED' (which maps to 'DISCONNECTED_AUDIT')
  const dbStatus = status === 'DISCONNECTED' ? 'DISCONNECTED_AUDIT' : 'CONNECTED';
  const userId = req.headers['x-user-id'] || null;

  primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
  primaryDb.prepare(`INSERT OR REPLACE INTO bridge_state (id, state, updated_at, updated_by) VALUES (1, ?, CURRENT_TIMESTAMP, ?)`).run(dbStatus, userId);
  primaryDb.prepare(`INSERT INTO reconnect_audit_logs (action, performed_by, reason) VALUES (?, ?, ?)`).run(dbStatus, userId, 'Manual Toggle via Connection UI');

  statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
  statutoryDb.prepare(`INSERT OR REPLACE INTO bridge_state (id, state, updated_at, updated_by) VALUES (1, ?, CURRENT_TIMESTAMP, ?)`).run(dbStatus, userId);
  statutoryDb.prepare(`INSERT INTO reconnect_audit_logs (action, performed_by, reason) VALUES (?, ?, ?)`).run(dbStatus, userId, 'Manual Toggle via Connection UI');

  if (status === 'CONNECTED') {
    try {
      const { SyncEngineService } = await import('../domains/sync-engine/service.js');
      const syncService = new SyncEngineService(primaryDb, statutoryDb);
      await syncService.processQueue();
    } catch (e: any) {
      console.error('[SyncEngine] process queue failed after connect:', e);
    }
  }

  res.json({ status: 'success' });
};

export const verifyIdentity: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { mobile, birth_date, answer_1, answer_2 } = args;
          const user = primaryDb.prepare('SELECT id FROM users WHERE mobile_number = ? AND birth_date = ? AND secret_answer_1 = ? AND secret_answer_2 = ?').get(mobile, birth_date, answer_1, answer_2) as any;
          if (!user) return res.status(400).json({ error: 'Information does not match our records' });
          
          const token = `TKN-${Date.now()}`;
          const expires = new Date(Date.now() + 15 * 60000).toISOString();
          primaryDb.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);
          res.json({ token });
          
};

export const resetPasswordWithToken: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { token, new_password } = args;
          const record = primaryDb.prepare('SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ? AND is_used = 0').get(token) as any;
          if (!record) return res.status(400).json({ error: 'Invalid or used token' });
          if (new Date() > new Date(record.expires_at)) return res.status(400).json({ error: 'Token expired' });
          
          const hash = await bcrypt.hash(new_password, 10);
          primaryDb.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, record.user_id);
          primaryDb.prepare('UPDATE password_reset_tokens SET is_used = 1 WHERE token = ?').run(token);
          res.json({ status: 'success' });
          
};

export const getConnectionStatus: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const bridgeRow = primaryDb.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
  if (bridgeRow) {
    const s = bridgeRow.state === 'DISCONNECTED_AUDIT' ? 'DISCONNECTED' : 'CONNECTED';
    res.json(s);
  } else {
    // fallback
    const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
    res.json(status?.value || 'CONNECTED');
  }
};

export const getReconnectAuditLogs: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  try {
    const logs = primaryDb.prepare(`
      SELECT r.id, r.action, r.timestamp, r.reason, u.username as performed_by_user 
      FROM reconnect_audit_logs r 
      LEFT JOIN users u ON r.performed_by = u.id 
      ORDER BY r.timestamp DESC LIMIT 50
    `).all();
    res.json(logs);
  } catch(e) {
    res.json([]);
  }
};

export const reconcileKP: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  try {
    const bridgeRow = primaryDb.prepare("SELECT state, updated_at FROM bridge_state WHERE id = 1").get() as any;
    if (!bridgeRow || bridgeRow.state !== 'DISCONNECTED_AUDIT') {
        return res.json({ k_count: 0, p_count: 0 });
    }

    const kCount = primaryDb.prepare("SELECT count(*) as c FROM attendance_logs WHERE created_at >= ?").get(bridgeRow.updated_at) as any;
    let pCount = {c: 0};
    try {
        pCount = statutoryDb.prepare("SELECT count(*) as c FROM attendance_logs WHERE origin = 'P_AUDIT_MODE'").get() as any;
    } catch(e) {}

    res.json({
        audit_start_time: bridgeRow.updated_at,
        k_records: kCount.c,
        p_records: pCount.c
    });
  } catch(e) {
    res.json({ k_count: 0, p_count: 0 });
  }
};

export const resolveReconnect: CommandHandler = async (ctx, args) => {
   const { primaryDb, statutoryDb, res, req } = ctx;
   const { resolution } = args; // KEEP_K, KEEP_P, DUAL_LEDGER
   const bridgeRow = primaryDb.prepare("SELECT state, updated_at FROM bridge_state WHERE id = 1").get() as any;
   if (!bridgeRow || bridgeRow.state !== 'DISCONNECTED_AUDIT') {
       return res.status(400).json({ error: 'Not in disconnected state' });
   }

   const auditStart = bridgeRow.updated_at;

   if (resolution === 'KEEP_K') {
       try { statutoryDb.prepare("DELETE FROM attendance_logs WHERE origin = 'P_AUDIT_MODE'").run(); } catch(e) {}
       try { statutoryDb.prepare("DELETE FROM wage_attendance_transactions WHERE origin = 'P_AUDIT_MODE'").run(); } catch(e) {}
   } else if (resolution === 'KEEP_P') {
       try {
           const pAtt = statutoryDb.prepare("SELECT * FROM attendance_logs WHERE origin = 'P_AUDIT_MODE'").all() as any[];
           for (const r of pAtt) {
               // Simple upsert back to K
               primaryDb.prepare("INSERT OR IGNORE INTO attendance_logs (emp_id, date, punch_in, punch_out, attendance_value, status, origin) VALUES (?, ?, ?, ?, ?, ?, 'K_NORMAL')")
                 .run(r.emp_id, r.date, r.punch_in, r.punch_out, r.attendance_value, r.status);
           }
       } catch(e) {}
   } else if (resolution === 'DUAL_LEDGER') {
       // Do nothing, let records diverge
   }

   const userId = req.headers['x-user-id'] || null;
   primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', 'CONNECTED')").run();
   primaryDb.prepare(`INSERT OR REPLACE INTO bridge_state (id, state, updated_at, updated_by) VALUES (1, 'CONNECTED', CURRENT_TIMESTAMP, ?)`).run(userId);
   primaryDb.prepare(`INSERT INTO reconnect_audit_logs (action, performed_by, reason) VALUES (?, ?, ?)`).run('CONNECTED', userId, `Reconnected with resolution: ${resolution}`);

   statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', 'CONNECTED')").run();

   res.json({ status: 'success' });
};

export const getLastSyncTimestamp: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const row = primaryDb.prepare("SELECT MAX(updated_at) as ts FROM sync_queue WHERE status = 'COMPLETED'").get() as any;
  res.json({ timestamp: row?.ts || '1970-01-01T00:00:00Z' });
};

