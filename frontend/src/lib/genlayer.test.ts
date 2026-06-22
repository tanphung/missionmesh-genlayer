import { describe, expect, it } from "vitest";
import { formatWei, parseJson, taskStatusTone, toUnixSeconds } from "./mission";

describe("mission helpers", () => {
  it("parses contract json strings safely", () => {
    expect(parseJson('{"id":1}', { id: 0 })).toEqual({ id: 1 });
    expect(parseJson("bad", { id: 0 })).toEqual({ id: 0 });
  });

  it("formats primitive workflow values", () => {
    expect(formatWei(12000)).toBe("12,000");
    expect(taskStatusTone("ACCEPTED")).toBe("done");
    expect(toUnixSeconds("2030-01-01T00:00:00Z") > 0n).toBe(true);
  });
});
