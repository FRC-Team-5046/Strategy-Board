/**
 * Offline-only builds (`VITE_OFFLINE_ONLY=1 bun run build`) hide every feature
 * that needs the internet or a third-party service: share-by-code (Firestore),
 * TBA import, the Statbotics tab and the contributors list. Drawing, saved
 * matches, QR and PDF/PNG export are unchanged. The default build is unaffected.
 */
export const offlineOnly: boolean = typeof __OFFLINE_ONLY__ !== "undefined" && __OFFLINE_ONLY__;
