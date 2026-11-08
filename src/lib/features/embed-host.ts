import type { BoardPhaseName, WhiteboardMatch } from "$lib/whiteboard/types";

/**
 * Connects the open whiteboard to the embed bridge (offline-only builds).
 * Kept free of other imports so components can use it without import cycles.
 */
export interface EmbedBoard {
  /** The live scene, including changes not yet saved. */
  scene(): WhiteboardMatch | null;
  /** The phase on screen, or null on the Statbotics tab. */
  phase(): BoardPhaseName | null;
  /** PNG data URLs of the given phases, rendered one after another; the open phase is restored. */
  exportPhases(phases: readonly BoardPhaseName[], maxWidth?: number): { phase: BoardPhaseName; png: string }[];
  /** Waits until every whiteboard change is saved. */
  flush(): Promise<void>;
}

let board: EmbedBoard | null = null;
let exitHandler: (() => void) | null = null;

export function registerEmbedBoard(next: EmbedBoard | null): void { board = next; }
export function embedBoard(): EmbedBoard | null { return board; }

/** When a host sets an exit handler, the whiteboard's EXIT button hands control back to the host. */
export function setEmbedExitHandler(handler: (() => void) | null): void { exitHandler = handler; }
export function embedExitHandler(): (() => void) | null { return exitHandler; }
