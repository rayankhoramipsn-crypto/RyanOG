"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
let count = 0;
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else if (p.endsWith(".js")) {
      new vm.Script(fs.readFileSync(p, "utf8"), { filename: p });
      count++;
    } else if (p.endsWith(".html")) {
      const source = fs.readFileSync(p, "utf8");
      for (const match of source.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
      )) {
        if (/\bsrc\s*=|application\/ld\+json/.test(match[1])) continue;
        new vm.Script(match[2], { filename: p + ":inline" });
        count++;
      }
    }
  }
}
walk("preview");
console.log("Parsed " + count + " JavaScript sources.");
