import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel } from "../lib/data/ingestion";

function makeWorkbook(rows: any[], headers?: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf;
}

describe("parseExcel hardening", () => {
  it("rejects oversized files", () => {
    // create ~6MB buffer
    const bigArray = Array.from({ length: 60000 }, (_, i) => ({ A: i, B: i }));
    const buf = makeWorkbook(bigArray.slice(0, 500)); // keep smaller to avoid huge mem
    // simulate size over limit by passing option
    expect(() => parseExcel(buf, { maxBytes: 1 })).toThrow(/too large/);
  });

  it("limits rows and columns", () => {
    const rows = Array.from({ length: 5 }, () => ({ A: 1, B: 2 }));
    const buf = makeWorkbook(rows);
    expect(() => parseExcel(buf, { maxRows: 3 })).toThrow(/too large/);
    const manyCols = [{}, {}] as any[];
    const headers = Array.from({ length: 205 }, (_, i) => `col${i}`);
    const bufCols = makeWorkbook(manyCols, headers);
    expect(() => parseExcel(bufCols, { maxCols: 200 })).toThrow(/too many columns/);
  });

  it("sanitizes headers and neutralizes formulas", () => {
    const rows = [{ "Bad/Name": 1, "": 2, Formula: "=SUM(1,2)" }];
    const buf = makeWorkbook(rows);
    const parsed = parseExcel(buf);
    expect(parsed.headers[0]).toBe("BadName");
    expect(parsed.headers[1]).toMatch(/column_2/i);
    expect(parsed.notes.some((n) => n.toLowerCase().includes("formula"))).toBe(true);
    expect(parsed.rows[0][parsed.headers[2]]).toBe("");
  });

  it("selects first sheet only", () => {
    const ws1 = XLSX.utils.json_to_sheet([{ A: 1 }]);
    const ws2 = XLSX.utils.json_to_sheet([{ A: 2 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");
    XLSX.utils.book_append_sheet(wb, ws2, "Sheet2");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const parsed = parseExcel(buf);
    expect(parsed.rows[0][parsed.headers[0]]).toBe(1);
  });
});
