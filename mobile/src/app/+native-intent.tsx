/**
 * Links from outside the app (kuhoo://..., a tapped URL) always open the home screen.
 * The app has no shareable deep links, and a link straight into `call/<id>` could make someone
 * start a paid call without meaning to.
 */
export function redirectSystemPath(_event: { path: string; initial: boolean }): string {
  return '/';
}
