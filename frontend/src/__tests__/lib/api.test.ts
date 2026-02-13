import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTools } from "@/lib/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getTools", () => {
  it("returns data on success", async () => {
    const tools = [{ id: 1, slug: "serial-monitor", name: "Serial Monitor", description: "A tool", status: "active" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tools),
    });

    const result = await getTools();
    expect(result).toEqual(tools);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tools/"),
      expect.any(Object),
    );
  });

  it("returns null on network error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getTools();
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await getTools();
    expect(result).toBeNull();
  });
});
