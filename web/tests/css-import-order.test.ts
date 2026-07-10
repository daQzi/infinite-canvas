import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const statements = css
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const firstNonImport = statements.findIndex((line) => !line.startsWith("@import "));
const lateImport = statements.slice(firstNonImport).find((line) => line.startsWith("@import "));

assert.equal(lateImport, undefined, "globals.css 的 @import 必须位于其他规则之前");

console.log("css import order tests passed");
