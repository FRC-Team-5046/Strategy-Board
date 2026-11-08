import { app } from "$lib/stores/app.svelte";

/**
 * Optional bridge for apps that embed Strategy Board in a web view.
 * Installed as `window.strategyBoard` only in offline-only builds, so the
 * website is unchanged. A host calls it with its own injected JavaScript.
 */
export interface EmbedMatch {
  name: string;
  red: string[];
  blue: string[];
  /** Field year for the artwork, e.g. 2026. Optional. */
  year?: number;
}

export interface StrategyBoardEmbed {
  /** Opens the board for this match, creating it on first use. Resolves to the match id. */
  openMatch(match: EmbedMatch): Promise<string>;
  /** PNG data URL of the open board (field, robots and drawing), or null on the home screen. */
  snapshot(maxWidth?: number): string | null;
}

const TEAM = /^\d{1,5}$/;

function alliance(teams: unknown): [string, string, string] {
  const list = Array.isArray(teams) ? teams : [];
  const out = [0, 1, 2].map((i) => String(list[i] ?? "").trim());
  return out.map((t) => (TEAM.test(t) ? t : "")) as [string, string, string];
}

export function createEmbedBridge(): StrategyBoardEmbed {
  return {
    async openMatch(match) {
      await app.init();
      const name = String(match?.name ?? "").trim().slice(0, 40) || "Untitled match";
      const red = alliance(match?.red);
      const blue = alliance(match?.blue);
      const same = (a: readonly string[], b: readonly string[]) => a.every((t, i) => t === b[i]);
      const existing = app.matches.find((m) => m.matchName === name && same(m.red, red) && same(m.blue, blue));
      const year = Number.isInteger(match?.year) ? match.year : undefined;
      const id = existing?.id ?? await app.createMatch({ matchName: name, redTeams: red, blueTeams: blue, tbaYear: year });
      app.openMatch(id);
      return id;
    },
    snapshot(maxWidth) {
      if (app.screen !== "whiteboard" || typeof document === "undefined") return null;
      const layers = ["background", "items", "drawing"].map((n) => document.getElementById(`whiteboard-canvas-${n}`));
      if (layers.some((c) => !(c instanceof HTMLCanvasElement))) return null;
      const [first] = layers as HTMLCanvasElement[];
      const scale = maxWidth && maxWidth > 0 ? Math.min(1, maxWidth / first.width) : 1;
      const out = document.createElement("canvas");
      out.width = Math.round(first.width * scale); out.height = Math.round(first.height * scale);
      const context = out.getContext("2d"); if (!context) return null;
      for (const canvas of layers as HTMLCanvasElement[]) context.drawImage(canvas, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  };
}

export function installEmbedBridge(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { strategyBoard?: StrategyBoardEmbed }).strategyBoard = createEmbedBridge();
  window.dispatchEvent(new Event("strategyboard:ready"));
}
