import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist-server/server.cjs',
  format: 'cjs',
  external: [
    'express', 
    'duckdb', 
    'duckdb-async',
    'better-sqlite3', 
    'bcrypt', 
    'bcryptjs',
    'vite', 
    'compression',
    'sqlite3'
  ]
}).catch(() => process.exit(1));
