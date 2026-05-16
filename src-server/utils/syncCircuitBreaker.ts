export function isKConnected(primaryDb: any): boolean {
  try {
    const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
    return (status?.value || 'CONNECTED') === 'CONNECTED';
  } catch (e) {
    return true; 
  }
}
