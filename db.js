const DB = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (e) {
      return fallback;
    }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
};

if (typeof module !== 'undefined') {
  module.exports = { DB };
} else {
  window.DB = DB;
}
