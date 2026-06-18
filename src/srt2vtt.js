// Minimal SubRip (.srt) -> WebVTT (.vtt) converter, zero dependencies.
//
// Browsers' <track> only accept WebVTT, so sibling .en.srt subtitle files are
// converted at build time. The two structural differences we need to handle:
//   1. A "WEBVTT" header line.
//   2. Cue timestamps use a dot before milliseconds (00:00:01.000), not a comma.
// Numeric cue-index lines are valid in WebVTT too, so they're left untouched.

function srtToVtt(srt) {
  const body = String(srt || '')
    .replace(/^﻿/, '') // strip BOM
    .replace(/\r+/g, '') // normalise CRLF -> LF
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // comma -> dot in timestamps
    .trim();

  return `WEBVTT\n\n${body}\n`;
}

module.exports = { srtToVtt };
