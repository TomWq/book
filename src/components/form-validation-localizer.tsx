"use client";

import { useEffect } from "react";

type ValidatableField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isValidatableField(target: EventTarget | null): target is ValidatableField {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function fieldLabel(field: ValidatableField) {
  const explicitLabel = field.id
    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(field.id)}"]`)?.textContent
    : "";
  const wrappedLabel = field.closest("label")?.textContent;
  const ariaLabel = field.getAttribute("aria-label");
  const placeholder = field.getAttribute("placeholder");
  const name = field.getAttribute("name");
  const raw = [explicitLabel, wrappedLabel, ariaLabel, placeholder, name]
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim())
    .find(Boolean);

  if (!raw) {
    return "此项";
  }

  if (/激活码|license/i.test(raw)) {
    return "激活码";
  }

  return raw.replace(/[：:*]*(必填|required)?$/i, "").slice(0, 16) || "此项";
}

function validationMessageFor(field: ValidatableField) {
  const validity = field.validity;
  const label = fieldLabel(field);

  if (validity.valueMissing) {
    return label === "此项" ? "请填写此项" : `请填写${label}`;
  }

  if (validity.typeMismatch) {
    if (field instanceof HTMLInputElement && field.type === "email") {
      return "请输入正确的邮箱地址";
    }

    if (field instanceof HTMLInputElement && field.type === "url") {
      return "请输入正确的网址";
    }

    return "请输入正确的格式";
  }

  if (validity.tooShort) {
    const minLength = field.getAttribute("minlength");
    return minLength ? `内容不能少于 ${minLength} 个字符` : "内容太短了";
  }

  if (validity.tooLong) {
    const maxLength = field.getAttribute("maxlength");
    return maxLength ? `内容不能超过 ${maxLength} 个字符` : "内容太长了";
  }

  if (validity.rangeUnderflow) {
    const min = field.getAttribute("min");
    return min ? `数值不能小于 ${min}` : "数值太小了";
  }

  if (validity.rangeOverflow) {
    const max = field.getAttribute("max");
    return max ? `数值不能大于 ${max}` : "数值太大了";
  }

  if (validity.stepMismatch) {
    return "请输入符合步长要求的数值";
  }

  if (validity.patternMismatch) {
    return "请输入符合要求的内容";
  }

  if (validity.badInput) {
    return "请输入有效内容";
  }

  return "";
}

export function FormValidationLocalizer() {
  useEffect(() => {
    function handleInvalid(event: Event) {
      if (!isValidatableField(event.target)) {
        return;
      }

      event.target.setCustomValidity("");
      event.target.setCustomValidity(validationMessageFor(event.target));
    }

    function handleInput(event: Event) {
      if (!isValidatableField(event.target)) {
        return;
      }

      event.target.setCustomValidity("");
    }

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);

    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
    };
  }, []);

  return null;
}
