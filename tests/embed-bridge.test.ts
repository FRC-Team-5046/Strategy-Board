import { indexedDB } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/lib/stores/app.svelte";
import { native } from "../src/lib/native/api";
import { createEmbedBridge } from "../src/lib/features/embed";

beforeAll(async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("indexedDB", indexedDB);
  await native.storage.set("legacyIndexedDbMigrationV1", true);
  await app.init();
});
beforeEach(async () => { app.closeMatch(); await app.clearAll(); });
afterAll(() => vi.unstubAllGlobals());

describe("embed bridge", () => {
  it("creates and opens a match with the host's teams", async () => {
    const id = await createEmbedBridge().openMatch({ name: "Q76", red: ["254", "1678", "118"], blue: ["971", "2056", "4414"], year: 2026 });
    expect(app.screen).toBe("whiteboard");
    expect(app.activeMatch?.id).toBe(id);
    expect(app.activeMatch?.red).toEqual(["254", "1678", "118"]);
    expect(app.activeMatch?.blue).toEqual(["971", "2056", "4414"]);
  });

  it("reopens the same board instead of creating a duplicate", async () => {
    const bridge = createEmbedBridge();
    const match = { name: "Q76", red: ["1", "2", "3"], blue: ["4", "5", "6"] };
    const first = await bridge.openMatch(match);
    app.closeMatch();
    expect(await bridge.openMatch(match)).toBe(first);
    expect(app.matches).toHaveLength(1);
  });

  it("drops invalid team values and caps the name", async () => {
    await createEmbedBridge().openMatch({ name: "x".repeat(100), red: ["<b>", "254"], blue: ["123456", "", "7"] });
    expect(app.activeMatch?.red).toEqual(["", "254", ""]);
    expect(app.activeMatch?.blue).toEqual(["", "", "7"]);
    expect(app.activeMatch?.matchName).toHaveLength(40);
  });

  it("returns no snapshot on the home screen", () => {
    expect(createEmbedBridge().snapshot()).toBeNull();
  });
});
