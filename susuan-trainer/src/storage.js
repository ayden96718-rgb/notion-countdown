const PREFIX = 'susuan.v1.';
export class LocalStore {
  constructor(storage) { this.storage = storage; this.available = true; }
  read(key, fallback) {
    try {
      const value = this.storage.getItem(PREFIX + key);
      return value === null ? fallback : JSON.parse(value);
    } catch { this.available = false; return fallback; }
  }
  write(key, value) {
    try { this.storage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch { this.available = false; return false; }
  }
  history() {
    const records = this.read('history', []);
    return Array.isArray(records) ? records.filter(item => item && typeof item.id === 'string' && typeof item.modeId === 'string' && Array.isArray(item.records) && item.summary && Number.isInteger(item.summary.total)) : [];
  }
  add(result) {
    const history = this.history();
    if (history.some(r => r.id === result.id)) return true;
    return this.write('history', [result, ...history].slice(0, 100));
  }
  clear() { return this.write('history', []); }
}
