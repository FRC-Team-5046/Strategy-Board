import { indexedDB } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/lib/stores/app.svelte";
import { native } from "../src/lib/native/api";
import { createEmbedBridge, phaseHasContent, phaseLabels } from "../src/lib/features/embed";
import { registerEmbedBoard } from "../src/lib/features/embed-host";
import { loadTeamNumber } from "../src/lib/features/preferences";
import { createBrowserMatchPacket } from "../src/lib/native/web";
import { whiteboardMatchFromPacket } from "../src/lib/whiteboard";

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

  it("stores the host's team number and tells the page", async () => {
    const seen: string[] = [];
    vi.stubGlobal("window", { dispatchEvent: (e: CustomEvent) => { seen.push(`${e.type}:${e.detail}`); return true; } });
    expect(await createEmbedBridge().setTeamNumber(" 254 ")).toBe("254");
    expect(await loadTeamNumber()).toBe("254");
    expect(seen).toEqual(["strategyboard:team-number:254"]);
    await expect(createEmbedBridge().setTeamNumber("abc")).rejects.toThrow();
    vi.stubGlobal("window", {});
  });

  it("names phases as the toolbar does for the field year", () => {
    expect(phaseLabels(2026).map(([, l]) => l)).toEqual(["AUTO", "TRANSITION", "ACTIVE", "INACTIVE", "NOTES"]);
    expect(phaseLabels(2025).map(([p, l]) => `${p}=${l}`)).toEqual(["auto=AUTO", "teleop=TELEOP", "endgame=ENDGAME", "notes=NOTES"]);
  });

  it("counts a phase as drawn when it has strokes, checkboxes or a moved robot", () => {
    const scene = whiteboardMatchFromPacket(createBrowserMatchPacket({ matchName: "", redTeams: ["", "", ""], blueTeams: ["", "", ""], tbaYear: 2026 }, "x"));
    const start = structuredClone(scene.auto);
    expect(phaseHasContent(scene.teleop, start)).toBe(false);
    scene.teleop.drawing.push([1, [0, 0], [5, 5]]);
    expect(phaseHasContent(scene.teleop, start)).toBe(true);
    scene.endgame.redOneRobot.x += 200;
    expect(phaseHasContent(scene.endgame, start)).toBe(true);
    scene.notes.checkboxes.push([1, 1, 0, false]);
    expect(phaseHasContent(scene.notes, start)).toBe(true);
  });

  it("snapshots every drawn phase with its label, or the open phase when none is drawn", async () => {
    await createEmbedBridge().openMatch({ name: "Q9", red: ["1", "2", "3"], blue: ["4", "5", "6"], year: 2026 });
    const scene = whiteboardMatchFromPacket(app.activeMatch!.packet);
    const asked: string[][] = [];
    registerEmbedBoard({
      scene: () => scene, phase: () => "teleop", flush: async () => {},
      exportPhases: (phases) => { asked.push([...phases]); return phases.map((phase) => ({ phase, png: `data:image/png;base64,${phase}` })); },
    });
    vi.stubGlobal("document", {});
    try {
      expect(createEmbedBridge().snapshotPhases().map((s) => s.label)).toEqual(["ACTIVE"]);
      scene.auto.drawing.push([0, [1, 1], [2, 2]]);
      scene.endgame.blueTwoRobot.r = 1.5;
      expect(createEmbedBridge().snapshotPhases().map((s) => `${s.phase}=${s.label}`)).toEqual(["auto=AUTO", "endgame=INACTIVE"]);
      expect(asked.at(-1)).toEqual(["auto", "endgame"]);
    } finally {
      registerEmbedBoard(null);
    }
  });

  it("exit saves first, then hands control to the host's handler", async () => {
    const order: string[] = [];
    registerEmbedBoard({ scene: () => null, phase: () => null, exportPhases: () => [], flush: async () => { order.push("flush"); } });
    const bridge = createEmbedBridge();
    bridge.setExitHandler(() => order.push("exit"));
    try {
      await bridge.exit();
      expect(order).toEqual(["flush", "exit"]);
    } finally {
      bridge.setExitHandler(null);
      registerEmbedBoard(null);
    }
  });
});
