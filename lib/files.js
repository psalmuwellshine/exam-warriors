'use strict';
/* Allowed upload types and a check that file contents match the claimed type. */
const FILE_TYPES = {
  'application/pdf': { inline: true },
  'image/png': { inline: true },
  'image/jpeg': { inline: true },
  'image/gif': { inline: true },
  'image/webp': { inline: true },
  'text/plain': { inline: true },
  'text/csv': { inline: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { inline: false },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { inline: false },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { inline: false },
};
const MAX_FILE_BYTES = 12 * 1024 * 1024;

function looksLike(buf, type) {
  const s = (a, o = 0) => a.every((b, i) => buf[o + i] === b);
  switch (type) {
    case 'application/pdf': return s([0x25, 0x50, 0x44, 0x46]);
    case 'image/png': return s([0x89, 0x50, 0x4e, 0x47]);
    case 'image/jpeg': return s([0xff, 0xd8, 0xff]);
    case 'image/gif': return s([0x47, 0x49, 0x46, 0x38]);
    case 'image/webp': return s([0x52, 0x49, 0x46, 0x46]) && s([0x57, 0x45, 0x42, 0x50], 8);
    case 'text/plain':
    case 'text/csv': return !buf.includes(0);
    default: return s([0x50, 0x4b, 0x03, 0x04]);
  }
}
module.exports = { FILE_TYPES, MAX_FILE_BYTES, looksLike };
