import { expect, it } from "vitest";
import { publicationDay, isDay, formatDay, postUrl } from "../../src/lib/day";

it.each([
  ["2026-09-11T04:59:59Z", "2026-09-10"],
  ["2026-09-11T05:00:00Z", "2026-09-11"],
  ["2026-01-02T05:59:59Z", "2026-01-01"],
  ["2026-01-02T06:00:00Z", "2026-01-02"],
  ["2026-03-08T07:59:59Z", "2026-03-08"],
  ["2026-03-08T08:00:00Z", "2026-03-08"],
  ["2026-11-01T06:30:00Z", "2026-11-01"],
  ["2026-11-01T07:30:00Z", "2026-11-01"],
])("groups %s by its Chicago calendar date", (value, expected) =>
  expect(publicationDay(new Date(value))).toBe(expected),
);
it("supports a configured timezone and stable date/entry URLs", () => {
  expect(publicationDay(new Date("2026-09-11T04:59:59Z"), "UTC")).toBe(
    "2026-09-11",
  );
  expect(formatDay("2026-09-10")).toBe("September 10, 2026");
  expect(postUrl({ id: "sample", publishedDay: "2026-09-10" })).toBe(
    "/days/2026-09-10#entry-sample",
  );
});
it.each(["2026-02-30", "2026-13-01", "2026-1-01", "not-a-date"])(
  "rejects invalid day routes: %s",
  (value) => expect(isDay(value)).toBe(false),
);
it("accepts leap days only in leap years", () => {
  expect(isDay("2024-02-29")).toBe(true);
  expect(isDay("2026-02-29")).toBe(false);
});
