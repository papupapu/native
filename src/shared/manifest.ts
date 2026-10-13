export interface Assets {
  js: string[];
  css: string[];
}

/**
 * `entry`: files to load on every page (vendor + main).
 * `groups`: files of every named async chunk group (`route-*`, `modal-*`),
 * keyed by webpackChunkName. The server uses `entry` + `groups[handle.chunk]` for the
 * current route and never preloads the modal groups.
 */
export interface AssetManifest {
  entry: Assets;
  groups: Record<string, Assets>;
}
