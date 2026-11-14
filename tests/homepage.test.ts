import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve(process.cwd(), "src/app/page.tsx");

describe("GMO ARENA homepage source", () => {
  it("provides the five required primary navigation sections in Persian", async () => {
    const source = await readFile(sourcePath, "utf8");
    for (const label of ["خانه", "بازی‌ها", "مسابقات", "کیف پول", "حساب من"]) {
      expect(source).toContain(`label: "${label}"`);
    }
  });

  it("clearly identifies the current dashboard data as demonstrative", async () => {
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain("اطلاعات این صفحه در حال حاضر نمایشی است");
  });

  it("includes the dashboard's core competitive and engagement areas", async () => {
    const source = await readFile(sourcePath, "utf8");
    for (const text of ["موجودی کل GMO", "رتبهٔ جهانی", "مسابقات پیشنهادی", "مأموریت‌های امروز"]) {
      expect(source).toContain(text);
    }
  });
});
