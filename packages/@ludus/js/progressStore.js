export const ProgressStore = {
  KEY: "sds:progress:v1",

  readAll: function() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("[ProgressStore] read failed:", e);
      return {};
    }
  },

  writeAll: function(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[ProgressStore] write failed:", e);
    }
  },

  load: function(level) {
    const all = this.readAll();
    return all["level" + level] || null;
  },

  save: function(level, snapshot) {
    const all = this.readAll();
    all["level" + level] = { ...snapshot, updatedAt: Date.now() };
    this.writeAll(all);
  },

  clear: function(level) {
    const all = this.readAll();
    delete all["level" + level];
    this.writeAll(all);
  },

  reset: function() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
  },

  getSummary: function() {
    const all = this.readAll();
    const out = { level1: null, level2: null, level3: null };
    for (const k of Object.keys(out)) {
      const s = all[k];
      if (!s) continue;
      out[k] = {
        done: Object.values(s.results || {}).filter(r => r && r.registered).length,
        total: s.total || 0,
        finishedAt: s.finishedAt || null,
      };
    }
    return out;
  }
};
