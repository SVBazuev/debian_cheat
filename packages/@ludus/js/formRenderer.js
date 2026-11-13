/**
 * formRenderer.js — генератор форм и Component Registry (dynamic anchors).
 */
import { DataStore } from "./dataStore.js";
import { fillSelect } from "./utils.js";

export const FormRenderer = {
  currentContext: null,
  currentRegistry: null,

  _uid: function(fieldId) {
    return 'fld-' + fieldId + '-' + Math.random().toString(36).substr(2, 6);
  },

  resolvePath: function(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  },

  _normalizeOptions: function(raw) {
    if (!raw) return [];
    return raw.map(o => typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label });
  },

  render: function(container, schema, context = {}) {
    if (typeof container === 'string') {
      container = document.querySelector(`[data-slot="${container}"]`);
    }
    if (!container || !schema) return null;

    container.innerHTML = '';
    this.currentContext = context;

    const registry = {
      fields: {},
      buttons: {},
      slots: {},
      container: container,
      submitBtn: context.submitBtn || null,
      hintEl: context.hintEl || null
    };

    for (const field of schema.fields) {
      const el = this.renderField(field, registry);
      if (el) container.appendChild(el);
    }

    this.updateVisibility(container);

    if (!container.dataset.frbBound) {
      container.dataset.frbBound = "1";
      container.addEventListener('change', (e) => {
        this.updateVisibility(container);
        if (context.onFieldChange && e.target && e.target.dataset && e.target.dataset.field) {
          context.onFieldChange(e.target.dataset.field, e.target.value);
        }
        if (context.onValidate) context.onValidate();
      });
      container.addEventListener('input', () => {
        this.updateVisibility(container);
        if (context.onValidate) context.onValidate();
      });
    }

    this.currentRegistry = registry;
    return registry;
  },

  renderField: function(field, registry) {
    if (field.type === 'composite') {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'composite-field';
      fieldset.dataset.field = field.id;
      if (field.showIf) fieldset.dataset.showIf = JSON.stringify(field.showIf);
      const legend = document.createElement('legend');
      legend.textContent = field.title;
      fieldset.appendChild(legend);
      registry.slots[field.id] = fieldset;
      for (const sub of field.fields) {
        const el = this.renderField(sub, registry);
        if (el) fieldset.appendChild(el);
      }
      return fieldset;
    }

    if (field.type === 'checkboxGroup') {
      const wrap = document.createElement('div');
      wrap.className = 'form-field full';
      if (field.showIf) wrap.dataset.showIf = JSON.stringify(field.showIf);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'form-label';
      labelSpan.textContent = field.label;
      wrap.appendChild(labelSpan);

      const list = document.createElement('div');
      list.className = 'checkbox-group';
      list.dataset.field = field.id;

      let items = [];
      if (field.source && this.currentContext.ticket) {
        items = this.resolvePath(this.currentContext.ticket, field.source);
      }
      if ((!items || items.length === 0) && field.fallback === 'currentTicket') {
        items = [this.currentContext.ticket.id];
      }
      if (!items) items = [];

      items.forEach(item => {
        let val = typeof item === 'string' ? item : item.id;
        let label = typeof item === 'string' ? item : item.title;
        if (typeof item === 'string') {
          const inc = DataStore.getTicket(3, item);
          if (inc) label = inc.id + ' • ' + inc.title;
        }
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:4px;';
        lbl.innerHTML = `<input type="checkbox" value="${val}"> <span>${label}</span>`;
        list.appendChild(lbl);
      });
      wrap.appendChild(list);
      registry.slots[field.id] = list;
      return wrap;
    }

    if (field.type === 'versions') return null;

    const id = this._uid(field.id);
    const label = document.createElement('label');
    label.className = 'form-field' + (field.type === 'textarea' ? ' full' : '');
    if (field.showIf) label.dataset.showIf = JSON.stringify(field.showIf);

    const span = document.createElement('span');
    span.className = 'form-label';
    span.textContent = field.label;
    label.appendChild(span);

    let input;
    if (field.type === 'text') input = document.createElement('input');
    else if (field.type === 'textarea') input = document.createElement('textarea');
    else if (field.type === 'select') input = document.createElement('select');
    else return null;

    input.id = id;
    input.dataset.field = field.id;
    input.name = field.id;
    if (field.required) input.required = true;

    if (field.type === 'select') {
      this.populateSelect(input, field);
    }

    label.appendChild(input);
    registry.fields[field.id] = input;
    return label;
  },

  populateSelect: function(input, field) {
    let opts = this._normalizeOptions(field.options);
    if (field.source && this.currentContext.ticket) {
      const t = this.currentContext.ticket;
      if (field.source === 'WORKAROUNDS') opts = (t.workarounds || []).map((w, i) => ({ value: String(i), label: w }));
      else if (field.source === 'RADICAL') opts = (t.radical || []).map((w, i) => ({ value: String(i), label: w }));
      else if (field.source === 'EMPLOYEES_L3') opts = DataStore.getEmployeesL3().map(e => ({ value: e.id, label: e.name + " (" + e.role + ")" }));
      else if (field.source === 'PROBLEM_METHODS') opts = DataStore.getProblemMethods().map(m => ({ value: m, label: m }));
      else if (field.source === 'PROBLEMS') opts = [{ value: "", label: "Выберите проблему..." }];
    }
    fillSelect(input, opts);
  },

  updateVisibility: function(container) {
    const elements = container.querySelectorAll('[data-show-if]');
    elements.forEach(el => {
      let condition;
      try { condition = JSON.parse(el.dataset.showIf); } catch (e) { return; }
      const targetEl = document.querySelector(`[data-field="${condition.field}"]`);
      if (!targetEl) return;
      const val = targetEl.value;
      let visible = false;
      if (condition.eq) visible = (val === condition.eq);
      if (condition.in) visible = condition.in.includes(val);
      el.style.display = visible ? '' : 'none';
    });
  },

  getFormData: function(registry, schema) {
    const data = {};
    if (!registry || !schema) return data;
    const collect = (fields) => {
      for (const field of fields) {
        if (field.type === 'composite') {
          collect(field.fields);
        } else if (field.type === 'checkboxGroup') {
          const list = registry.slots[field.id];
          if (list) data[field.id] = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
        } else if (field.type === 'versions') {
          // skip — populated separately by the application
        } else {
          const el = registry.fields[field.id];
          if (el) data[field.id] = el.value;
        }
      }
    };
    collect(schema.fields);
    return data;
  },

  validate: function(registry, schema, extraCheck) {
    if (!registry || !schema) return;
    const formData = this.getFormData(registry, schema);
    const missing = [];
    let ok = true;
    if (extraCheck && !extraCheck()) ok = false;

    const checkField = (field) => {
      if (!field.required) return;
      if (field.type === 'composite') {
        const fieldset = registry.slots[field.id];
        if (fieldset && fieldset.style.display !== 'none') field.fields.forEach(checkField);
      } else if (field.type === 'checkboxGroup') {
        const val = formData[field.id];
        if (!val || val.length === 0) { missing.push(field.label); ok = false; }
      } else if (field.type === 'versions') {
        // versions checked in extraCheck
      } else {
        const val = formData[field.id];
        if (!val || (typeof val === 'string' && val.trim() === '')) { missing.push(field.label); ok = false; }
      }
    };
    schema.fields.forEach(checkField);

    if (registry.submitBtn) registry.submitBtn.disabled = !ok;
    if (registry.hintEl) {
      if (!ok) {
        registry.hintEl.style.display = "block";
        registry.hintEl.innerHTML = missing.length > 0 ? "Заполните: " + missing.join(", ") : "Заполните обязательные поля";
      } else {
        registry.hintEl.style.display = "none";
        registry.hintEl.textContent = "";
      }
    }
  }
};
