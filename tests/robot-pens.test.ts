import { describe, expect, it } from "vitest";
import { penColor, ROBOT_PEN } from "../src/lib/whiteboard";

describe("robot pens", () => {
  it("gives each robot its own pen, after the original five", () => {
    const pens = Object.values(ROBOT_PEN);
    expect(new Set(pens).size).toBe(6);
    expect(Math.min(...pens)).toBe(5);
    expect(new Set(pens.map(penColor)).size).toBe(6);
  });

  it("keeps the meaning of saved colour indices", () => {
    // Strokes in saved boards, share links and QR packets store these indices.
    expect([0, 1, 2, 3, 4].map(penColor)).toEqual(["#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#eab308"]);
    expect(penColor(99)).toBe("#ffffff");
    expect(penColor(-1)).toBe("#ffffff");
  });

  it("warm pens on the red alliance, cool pens on the blue, none the plain alliance colour", () => {
    expect([ROBOT_PEN.redOne, ROBOT_PEN.redTwo, ROBOT_PEN.redThree].map(penColor)).toEqual(["#facc15", "#fb923c", "#f472b6"]);
    expect([ROBOT_PEN.blueOne, ROBOT_PEN.blueTwo, ROBOT_PEN.blueThree].map(penColor)).toEqual(["#22d3ee", "#4ade80", "#a78bfa"]);
    for (const pen of Object.values(ROBOT_PEN)) expect(["#ef4444", "#3b82f6", "#dc2626", "#2563eb"]).not.toContain(penColor(pen));
  });
});
