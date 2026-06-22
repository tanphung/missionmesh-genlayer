import { describe, expect, it } from "vitest";
import { executionSucceeded } from "./genlayer";
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

  it("classifies GenLayer transaction receipts defensively", () => {
    expect(executionSucceeded({ statusName: "ACCEPTED", resultName: "AGREE" })).toBe(true);
    expect(executionSucceeded({ status: 2 })).toBe(false);
    expect(executionSucceeded({ statusName: "VALIDATORS_TIMEOUT", resultName: "TIMEOUT" })).toBe(false);
    expect(executionSucceeded({ statusName: "ACCEPTED", resultName: "DISAGREE" })).toBe(false);
  });
});
