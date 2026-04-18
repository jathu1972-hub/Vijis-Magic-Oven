import xss from "xss";

function normalizeLineBreaks(value) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function cleanText(value, { maxLength = 255 } = {}) {
  if (typeof value !== "string") {
    return "";
  }

  const sanitized = xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script"]
  });

  return sanitized.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function cleanMultilineText(value, { maxLength = 1000 } = {}) {
  if (typeof value !== "string") {
    return "";
  }

  const sanitized = xss(normalizeLineBreaks(value), {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script"]
  });

  return sanitized.trim().slice(0, maxLength);
}
