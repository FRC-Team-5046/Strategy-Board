import { app } from "$lib/stores/app.svelte";
import { createBrowserMatchPacket } from "$lib/native/web";
import { whiteboardMatchFromPacket, type BoardPhaseName, type WhiteboardMatch, type WhiteboardPhase } from "$lib/whiteboard";
import { embedBoard, embedExitHandler, setEmbedExitHandler } from "./embed-host";
import { saveTeamNumber } from "./preferences";

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

export interface PhaseSnapshot {
  /** Data key of the phase: auto, transition, teleop, endgame or notes. */
  phase: BoardPhaseName;
  /** The phase's name as the toolbar shows it, e.g. "AUTO" or "ACTIVE". */
  label: string;
  /** PNG data URL of the field, robots and drawing in that phase. */
  png: string;
}

export interface StrategyBoardEmbed {
  /** Opens the board for this match, creating it on first use. Resolves to the match id. */
  openMatch(match: EmbedMatch): Promise<string>;
  /** Stores the host's team number, so the board does not ask for it. */
  setTeamNumber(team: string): Promise<string>;
  /** PNG data URL of the open board (field, robots and drawing), or null on the home screen. */
  snapshot(maxWidth?: number): string | null;
  /**
   * One PNG per phase that has drawing, checkboxes or moved robots, in toolbar
   * order; the open phase if none has. Empty on the home screen.
   */
  snapshotPhases(maxWidth?: number): PhaseSnapshot[];
  /** Makes EXIT save and then call the handler instead of returning to the match list. Null restores EXIT. */
  setExitHandler(handler: (() => void) | null): void;
  /** Saves pending changes, then calls the exit handler if one is set. */
  exit(): Promise<void>;
}

const TEAM = /^\d{1,5}$/;
export const TEAM_NUMBER_SET_EVENT = "strategyboard:team-number";

function alliance(teams: unknown): [string, string, string] {
  const list = Array.isArray(teams) ? teams : [];
  const out = [0, 1, 2].map((i) => String(list[i] ?? "").trim());
  return out.map((t) => (TEAM.test(t) ? t : "")) as [string, string, string];
}

/** Phases in toolbar order, with the toolbar's names for the field year. */
export function phaseLabels(year: number | null | undefined): [BoardPhaseName, string][] {
  const y2026 = year === 2026;
  return [
    ["auto", "AUTO"],
    ...(y2026 ? [["transition", "TRANSITION"] as [BoardPhaseName, string]] : []),
    ["teleop", y2026 ? "ACTIVE" : "TELEOP"],
    ["endgame", y2026 ? "INACTIVE" : "ENDGAME"],
    ["notes", "NOTES"],
  ];
}

const robotKeys = ["redOneRobot", "redTwoRobot", "redThreeRobot", "blueOneRobot", "blueTwoRobot", "blueThreeRobot"] as const;

/** True when the phase has drawing or checkboxes, or a robot is away from its starting pose. */
export function phaseHasContent(phase: WhiteboardPhase, start: WhiteboardPhase): boolean {
  if (phase.drawing.length || phase.checkboxes.length) return true;
  return robotKeys.some((key) => {
    const a = phase[key]; const b = start[key];
    return Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.r - b.r) > 0.01;
  });
}

function startingPhase(match: WhiteboardMatch): WhiteboardPhase {
  const year = match.fieldMetadata?.selectedFieldYear ?? match.tbaYear ?? undefined;
  const packet = createBrowserMatchPacket({ matchName: "", redTeams: ["", "", ""], blueTeams: ["", "", ""], tbaYear: year ?? undefined }, "start");
  return whiteboardMatchFromPacket(packet).auto;
}

async function openOne(match: EmbedMatch): Promise<string> {
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
}

// Calls to openMatch run one at a time: two overlapping calls for a new match must not both
// miss the lookup and create two boards with the same name.
let opening: Promise<unknown> = Promise.resolve();

export function createEmbedBridge(): StrategyBoardEmbed {
  return {
    openMatch(match) {
      const run = opening.then(() => openOne(match), () => openOne(match));
      opening = run.catch(() => undefined);
      return run;
    },
    async setTeamNumber(team) {
      const saved = await saveTeamNumber(String(team ?? ""));
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent(TEAM_NUMBER_SET_EVENT, { detail: saved }));
      return saved;
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
    snapshotPhases(maxWidth) {
      const board = embedBoard();
      const scene = board?.scene();
      if (app.screen !== "whiteboard" || !board || !scene || typeof document === "undefined") return [];
      const start = startingPhase(scene);
      const labels = phaseLabels(scene.fieldMetadata?.selectedFieldYear ?? scene.tbaYear);
      let chosen = labels.filter(([phase]) => phaseHasContent(scene[phase], start));
      if (!chosen.length) chosen = labels.filter(([phase]) => phase === (board.phase() ?? "auto"));
      const label = new Map(labels);
      return board.exportPhases(chosen.map(([phase]) => phase), maxWidth).map(({ phase, png }) => ({ phase, label: label.get(phase) ?? phase.toUpperCase(), png }));
    },
    setExitHandler(handler) {
      setEmbedExitHandler(typeof handler === "function" ? handler : null);
    },
    async exit() {
      await embedBoard()?.flush();
      embedExitHandler()?.();
    },
  };
}

export function installEmbedBridge(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { strategyBoard?: StrategyBoardEmbed }).strategyBoard = createEmbedBridge();
  window.dispatchEvent(new Event("strategyboard:ready"));
}
