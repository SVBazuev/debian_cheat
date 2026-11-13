/**
 * state.js — centralized application state.
 * Domain slots (orgVersions, engineer, submitLog) are registered by the
 * application via Extension.registerSlot.
 */
export const State = {
  level: 1,
  currentId: null,
  currentForm: null,
  resultsByLevel: {},
  createdProblems: [],
  _slots: {},

  registerSlot: function(name, initial) {
    this[name] = Array.isArray(initial) ? [...initial] : { ...initial };
    this._slots[name] = initial;
  },

  reset: function() {
    this.level = 1;
    this.currentId = null;
    this.currentForm = null;
    this.resultsByLevel = {};
    this.createdProblems = [];
    for (const [name, initial] of Object.entries(this._slots)) {
      this[name] = Array.isArray(initial) ? [...initial] : { ...initial };
    }
  },

  getResults: function(level) {
    if (!this.resultsByLevel[level]) this.resultsByLevel[level] = {};
    return this.resultsByLevel[level];
  },

  get results()   { return this.getResults(1); },
  set results(v)  { this.resultsByLevel[1] = v; },
  get resultsL2() { return this.getResults(2); },
  set resultsL2(v){ this.resultsByLevel[2] = v; },
  get resultsEngineer() { return this.getResults(3); },
  set resultsEngineer(v){ this.resultsByLevel[3] = v; }
};
