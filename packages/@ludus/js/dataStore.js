/**
 * dataStore.js — centralized data store.
 * Wraps the exported constants from build/data.js (build artifact).
 */
import {
  ORGS, CONTACTS, EMPLOYEES, EMPLOYEES_L3, COMMENTS_L2,
  INTROS, TAX, MATRIX, LEVELS, LEVEL_DATA,
  PROBLEMS, KB_L3, PROBLEM_METHODS
} from "../../../build/data.js";

export const DataStore = {
  getOrgs: () => ORGS,
  getOrg: (id) => ORGS.find(o => o.id === id),

  getContacts: () => CONTACTS,
  getContactsByOrg: (orgId) => CONTACTS.filter(c => c.orgId === orgId),

  getEmployees: () => EMPLOYEES,
  getEmployeesL3: () => EMPLOYEES_L3,
  getCommentsL2: () => COMMENTS_L2,

  getIntro: (def) => {
    if (!def) return null;
    const key = typeof def === "string" ? def : def.template;
    const base = INTROS[key];
    if (!base) return null;
    if (typeof def === "string") return base;
    return {
      title: (def.title !== undefined) ? def.title : base.title,
      body:  (def.body  !== undefined) ? def.body  : base.body
    };
  },

  getTax: () => TAX,
  getMatrix: () => MATRIX,

  getLevels: () => LEVELS,
  getLevel: (id) => LEVELS.find(l => l.id === id) || null,
  getLevelWorkflow: (id) => {
    const lvl = LEVELS.find(l => l.id === id);
    return lvl ? lvl.workflow : null;
  },

  getTickets: (level) => {
    const data = LEVEL_DATA[level];
    return data ? data.tickets : [];
  },
  getTicket: (level, id) => {
    const tickets = DataStore.getTickets(level);
    return tickets.find(t => t.id === id);
  },

  getSchema: (level) => {
    const data = LEVEL_DATA[level];
    return data ? data.schema : null;
  },
  getSchemas: () => {
    const map = {};
    for (const lvl of LEVELS) map[lvl.id] = LEVEL_DATA[lvl.id].schema;
    return map;
  },

  getProblems: () => PROBLEMS,
  getKbL3: () => KB_L3,
  getProblemMethods: () => PROBLEM_METHODS
};
