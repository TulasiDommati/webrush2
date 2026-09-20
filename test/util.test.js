import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, num, inr, pct, fmtH, fmtD, dayOf, dateOf, yearOf, monthKey } from "../site/util.js";

test("esc neutralises HTML metacharacters", () => {
  assert.equal(esc(`<img src=x onerror="alert('1')">&`), "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;");
  assert.equal(esc(null), "");
  assert.equal(esc(42), "42");
});

test("number formatting uses Indian grouping", () => {
  assert.equal(num(161046), "1,61,046");
  assert.equal(num(1234.6), "1,235");
  assert.equal(inr(2500), "₹2,500");
  assert.equal(pct(0.4567), "46%");
});

test("hour labels", () => {
  assert.equal(fmtH(0), "12 am");
  assert.equal(fmtH(12), "12 pm");
  assert.equal(fmtH(9), "9 am");
  assert.equal(fmtH(23), "11 pm");
});

test("day index round-trips through dates", () => {
  assert.equal(dayOf("2013-01-01"), 0);
  assert.equal(fmtD(dayOf("2017-03-12")), "12 Mar 2017");
  assert.equal(dateOf(dayOf("2024-12-31")).toISOString().slice(0, 10), "2024-12-31");
  assert.equal(yearOf(dayOf("2016-11-08")), 2016);
  assert.equal(monthKey(dayOf("2016-11-08")) - monthKey(dayOf("2016-10-08")), 1);
});
