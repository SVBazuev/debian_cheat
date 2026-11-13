/**
 * extensions.js — facade for registering application extensions.
 * G.1e: single named export used by service-desk/* modules.
 */
import { TemplateRenderer } from "./templateRenderer.js";
import { Validator } from "./validator.js";
import { State } from "./state.js";
import { ProgressStore } from "./progressStore.js";

export const Extension = {
  _middlewares: [],
  _progressStore: null,

  registerWorkflow: function(name, descriptor) {
    TemplateRenderer.templates[name] = descriptor;
  },
  registerPanelKind: function(kind, fn) {
    TemplateRenderer._panelKinds[kind] = fn;
  },
  registerWidget: function(name, fn) {
    TemplateRenderer._widgets[name] = fn;
  },
  registerReadonly: function(name, fn) {
    TemplateRenderer._readonly[name] = fn;
  },
  registerValidator: function(rule, fn) {
    Validator.registerRule(rule, fn);
  },
  registerSlot: function(name, initial) {
    State.registerSlot(name, initial);
  },
  registerFieldFormatter: function(fieldId, fn) {
    Validator.registerFieldFormatter(fieldId, fn);
  },

  registerTemplates: function(source) {
    if (!source || typeof source !== "object") {
      throw new Error("Extension.registerTemplates: source must be an object");
    }
    TemplateRenderer.registerTemplates(source);
  },

  use: function(fn) {
    if (typeof fn !== "function") {
      throw new Error("Extension.use: middleware must be a function");
    }
    this._middlewares.push(fn);
  },

  runMiddleware: function(ctx, terminal) {
    const stack = this._middlewares;
    const dispatch = (i) => {
      if (i >= stack.length) return terminal(ctx);
      return stack[i](ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  },

  setProgressStore: function(store) {
    if (store === null || store === undefined) {
      this._progressStore = null;
      return;
    }
    if (typeof store !== "object") {
      throw new Error("Extension.setProgressStore: store must be an object");
    }
    const required = ["load", "save", "reset", "getSummary"];
    for (const m of required) {
      if (typeof store[m] !== "function") {
        throw new Error("Extension.setProgressStore: missing method '" + m + "'");
      }
    }
    this._progressStore = store;
  },

  getProgressStore: function() {
    return this._progressStore || ProgressStore;
  }
};
