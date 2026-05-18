/**
 * Thin wrapper around the Tauri runtime API.
 *
 * The viewer is also runnable in a plain browser tab (`npm start`) for UI
 * iteration — in that mode `window.__TAURI_INTERNALS__` is missing and we
 * fall back to a friendly stub that explains why no Sudhaus can be tapped.
 */

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function invokeBridge<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      `HopsMD läuft gerade ohne Braukessel (browser-only). ` +
        `Command "${command}" steht nur unter "npm run tauri:dev" zur Verfügung.`,
    );
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function pickBrewhouse(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error(
      'Sudhaus-Auswahl ist nur im Tauri-Shell verfügbar — bitte "npm run tauri:dev" nutzen.',
    );
  }
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Sudhaus auswählen — pick a Markdown folder',
  });
  return typeof result === 'string' ? result : null;
}

export async function toAssetUrl(filePath: string): Promise<string> {
  if (!isTauri()) return filePath;
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  return convertFileSrc(filePath);
}

/**
 * Open a path with its system-default association (e.g. opens an .md file in
 * the user's editor, opens a folder in Explorer/Finder/Nautilus). No-op when
 * running browser-only.
 */
export async function openPathBridge(path: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Pfad-Öffnen ist nur im Tauri-Shell verfügbar.');
  }
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(path);
}

/**
 * Reveal a file or folder in the OS file manager (Explorer on Windows,
 * Finder on macOS, Nautilus/Dolphin on Linux), highlighting the item.
 */
export async function revealInExplorer(path: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Im Explorer anzeigen ist nur im Tauri-Shell verfügbar.');
  }
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}

/**
 * Subscribe to a Tauri event. In browser-only mode this resolves to a no-op
 * unsubscribe so callers don't need to special-case the dev workflow.
 */
export async function listenBridge<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<T>(event, (msg) => handler(msg.payload));
  return unlisten;
}
