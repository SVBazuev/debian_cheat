/**
 * validator.js — universal answer verification module.
 */
export const Validator = {
  _rules: {},
  _fieldFormatters: {},

  registerRule: function(name, fn) {
    this._rules[name] = fn;
  },
  registerFieldFormatter: function(fieldId, fn) {
    this._fieldFormatters[fieldId] = fn;
  },

  getExpectedValue: function(ticket, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], ticket);
  },

  validate: function(schema, ticket, formData) {
    const errs = [];
    const comparison = [];
    const addComp = (field, val, exp, explain, isErrOverride) => {
      const isErr = isErrOverride !== undefined ? isErrOverride : (val !== exp);
      if (isErr) errs.push(field);
      comparison.push({
        field, value: val || "Не выбрано", expected: exp || "-", isError: isErr, explain: explain || ""
      });
    };

    for (const field of schema.fields) {
      if (!field.validate) continue;

      const val = formData[field.id];
      const rule = field.validate.rule;

      const customFn = this._rules[rule];
      if (customFn) {
        customFn.call(this, ticket, formData, comparison, errs);
        continue;
      }

      const expected = this.getExpectedValue(ticket, field.validate.path);

      if (rule === "eq") {
        const fmt = this._fieldFormatters[field.id];
        let displayVal, displayExp, explain;
        if (fmt) {
          const rv = fmt(val, ticket);
          const re = fmt(expected, ticket);
          displayVal = (typeof rv === "string") ? rv
                     : (rv && rv.display != null) ? rv.display
                     : val;
          displayExp = (typeof re === "string") ? re
                     : (re && re.display != null) ? re.display
                     : expected;
          explain = (rv && rv.explain) || (re && re.explain) || "";
        } else {
          displayVal = val;
          displayExp = expected;
          explain = "";
        }
        const label = field.compactLabel || String(field.label).replace(/\s*\*+\s*$/, "");
        addComp(label, displayVal, displayExp, explain, val !== expected);
      }
      else if (rule === "includes") {
        const isErr = !formData[field.id].includes(expected);
        if (isErr) errs.push(field.label);
        comparison.push({ field: field.label, value: formData[field.id].join(", ") || "Нет продуктов", expected, isError: isErr, explain: "Версия продукта должна соответствовать." });
      }
      else if (rule === "eqIndex") {
        const isErr = parseInt(val, 10) !== expected;
        if (isErr) errs.push(field.label);
        comparison.push({
          field: field.label,
          value: "Выбран вариант №" + val,
          expected: "Вариант №" + expected,
          isError: isErr,
          explain: "Выберите решение, которое реально снимает боль или устраняет причину."
        });
      }
      else if (rule === "keywords") {
        const n = (val || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
        const matched = expected.filter(k => n.includes(k.toLowerCase()));
        const isErr = matched.length < 2;
        if (isErr) errs.push(field.label);
        comparison.push({
          field: field.label,
          value: val || "Не заполнено",
          expected: "ключевые: " + expected.join(", "),
          isError: isErr,
          explain: isErr ? "Укажите первопричину своими словами (минимум 2 ключевых слова)." : "Поймано по ключевым словам."
        });
      }
    }

    return { registered: true, errs, comparison, ok: errs.length === 0 };
  }
};
