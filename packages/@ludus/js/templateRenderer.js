/**
 * templateRenderer.js — schema-driven UI shell (panels + form + widgets).
 * Domain templates (workflows, readonly, widgets, panel kinds) are
 * registered by the application via Extension API; core stays generic.
 *
 * Two registries are distinct:
 *   _templateSources — HTML templates, registered via registerTemplates.
 *   templates        — workflow descriptors, registered via registerWorkflow.
 */
import { FormRenderer } from "./formRenderer.js";

export const TemplateRenderer = {
  templates: {},          // workflow descriptors (via Extension.registerWorkflow)
  _widgets: {},           // widget factories (via Extension.registerWidget)
  _readonly: {},          // readonly block factories (via Extension.registerReadonly)
  _templateSources: {},   // HTML templates (via Extension.registerTemplates)
  _parsedCache: {},       // parsed <template> elements, keyed by id

  registerTemplates: function(source) {
    if (!source || typeof source !== "object") return;
    for (const [id, html] of Object.entries(source)) {
      if (typeof html !== "string" || html.trim() === "") {
        console.warn(`[TemplateRenderer] skip empty template '${id}'`);
        continue;
      }
      this._templateSources[id] = html;
      delete this._parsedCache[id];
    }
  },

  _getParsedTemplate: function(templateId) {
    if (this._parsedCache[templateId]) return this._parsedCache[templateId];
    const html = this._templateSources[templateId];
    if (html === undefined) {
      throw new Error(`TemplateRenderer: unknown template '${templateId}'`);
    }
    const t = document.createElement("template");
    t.innerHTML = html;
    this._parsedCache[templateId] = t;
    return t;
  },

  bind: function(templateId, opts) {
    opts = opts || {};
    const tpl = this._getParsedTemplate(templateId);
    const frag = tpl.content.cloneNode(true);

    for (const [slotId, value] of Object.entries(opts.slots || {})) {
      const el = frag.querySelector(`[data-slot="${slotId}"]`);
      if (!el) {
        console.warn(`[TemplateRenderer] slot '${slotId}' not found in '${templateId}'`);
        continue;
      }
      if (typeof value === "string") el.textContent = value;
      else if (typeof value === "function") value(el);
      else if (value && typeof value === "object" && "html" in value) el.innerHTML = value.html;
    }

    for (const [slotId, visible] of Object.entries(opts.show || {})) {
      const el = frag.querySelector(`[data-slot="${slotId}"]`);
      if (el) el.hidden = !visible;
    }

    for (const [slotId, attrs] of Object.entries(opts.attrs || {})) {
      const el = frag.querySelector(`[data-slot="${slotId}"]`);
      if (!el) continue;
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    }

    if (typeof opts.onMount === "function") opts.onMount(frag);
    return frag;
  },

  bindElement: function(templateId, opts) {
    const frag = this.bind(templateId, opts);
    if (frag.childNodes.length !== 1) {
      throw new Error(`TemplateRenderer.bindElement: template '${templateId}' must have exactly one root element`);
    }
    return frag.firstElementChild;
  },

  _panelKinds: {
    form: function(panel, schema, ticket, context, result) {
      const section = this.bindElement("panel", { slots: { title: panel.title || "Карточка" } });
      const body = section.querySelector(".panel-body");
      const footer = section.querySelector(".panel-footer");

      if (panel.readonly && this._readonly[panel.readonly]) {
        const ro = this._readonly[panel.readonly].call(this, ticket);
        if (ro) body.appendChild(ro);
      }

      const formContainer = document.createElement("div");
      formContainer.className = "form-grid";
      body.appendChild(formContainer);
      result.formContainer = formContainer;

      const submitBtn = footer.querySelector('[data-slot="submit-btn"]');
      submitBtn.textContent = panel.submitLabel || "Сохранить";
      result.submitBtn = submitBtn;

      const hintEl = document.createElement("div");
      hintEl.className = "prio-hint";
      hintEl.style.cssText = "display:none;background:#fffbeb;border-color:#fde68a;color:#92400e;font-size:12.5px;margin-top:12px;";
      body.appendChild(hintEl);

      const registry = FormRenderer.render(formContainer, schema, {
        ticket: ticket,
        submitBtn: submitBtn,
        hintEl: hintEl,
        onFieldChange: context.onFieldChange,
        onValidate: context.onValidate
      });
      result.registry = registry;

      for (const w of (panel.after || [])) {
        const el = this._widgets[w].call(this, ticket, context, result);
        if (el) body.appendChild(el);
      }

      FormRenderer.updateVisibility(formContainer);
      return section;
    }
  },

  render: function(templateName, schema, ticket, context) {
    const def = this.templates[templateName];
    if (!def) throw new Error("TemplateRenderer: unknown template '" + templateName + "'");
    context = context || {};

    const result = {
      panels: [],
      withExtra: false,
      registry: null,
      submitBtn: null,
      formContainer: null
    };

    for (const panel of def.panels) {
      const el = this._renderPanel(panel, schema, ticket, context, result);
      if (el) result.panels.push(el);
    }
    result.withExtra = result.panels.length >= 3;
    return result;
  },

  _renderPanel: function(panel, schema, ticket, context, result) {
    const fn = this._panelKinds[panel.kind];
    if (!fn) throw new Error("TemplateRenderer: unknown panel kind '" + panel.kind + "'");
    return fn.call(this, panel, schema, ticket, context, result);
  }
};
