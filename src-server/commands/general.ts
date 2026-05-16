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
    SELECT u.id, u.username, u.name, u.password, u.role_id, r.name as role_name, r.module_scope 
    FROM users u 
    LEFT JOIN roles r ON u.role_id = r.id 
    WHERE u.username = ?
  `).get(username) as any;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = user.password.startsWith('$argon') ? false : await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
  const available_modules = status?.value === 'DISCONNECTED' ? ['P'] : ['K', 'P'];

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
    rbac_cache: {
      permissions: permissionsMap,
      module_scope: user.module_scope || 'NONE'
    },
    available_modules,
    connection_status: status?.value || 'CONNECTED'
  });
};

export const userCrud: CommandHandler = async (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { operation, data, id } = args;
  if (operation === 'list') {
    const rows = primaryDb.prepare('SELECT id, name, username, role, permissions, is_locked FROM users').all();
    res.json(rows.map((r: any) => ({ ...r, permissions: JSON.parse(r.permissions || '[]') })));
  } else if (operation === 'create') {
    if (!data.password) return res.status(400).json({ error: 'Password is required' });
    const hash = await bcrypt.hash(data.password, 10);
    primaryDb.prepare('INSERT INTO users (name, username, password, role, permissions) VALUES (?, ?, ?, ?, ?)')
      .run(data.name, data.username, hash, data.role, JSON.stringify(data.permissions || []));
    res.json({ status: 'success' });
  } else if (operation === 'update') {
    if (data.password) {
      const hash = await bcrypt.hash(data.password, 10);
      primaryDb.prepare('UPDATE users SET name = ?, username = ?, password = ?, role = ?, permissions = ? WHERE id = ?')
        .run(data.name, data.username, hash, data.role, JSON.stringify(data.permissions || []), id);
    } else {
      primaryDb.prepare('UPDATE users SET name = ?, username = ?, role = ?, permissions = ? WHERE id = ?')
        .run(data.name, data.username, data.role, JSON.stringify(data.permissions || []), id);
    }
    res.json({ status: 'success' });
  } else if (operation === 'delete') {
    primaryDb.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ status: 'success' });
  }
};

export const updateConnectionStatus: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { status } = args;
  primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
  statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);

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
  
          const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
          res.json(status?.value || 'CONNECTED');
          
};

export const getLastSyncTimestamp: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const row = primaryDb.prepare("SELECT MAX(updated_at) as ts FROM sync_queue WHERE status = 'COMPLETED'").get() as any;
  res.json({ timestamp: row?.ts || '1970-01-01T00:00:00Z' });
};

