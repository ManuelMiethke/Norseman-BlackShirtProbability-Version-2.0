/**
 * Resolves a file from the public data folder against the app's base path.
 * Locally the base is "/", on GitHub Pages it is "/<repository>/", so plain
 * absolute paths like "/course_profile.csv" would 404 there.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
