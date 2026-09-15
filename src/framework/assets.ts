export type AssetResolver = (path: string) => string;

export function defaultAssetUrl(path: string): string {
  const key = path.replace(/^\.?\/*src\//, "");
  const extension = key.endsWith(".css") ? ".css" : ".js";
  const stem = key.replace(/\.[^.]+$/, "").replaceAll("/", "-");
  return `/assets/${stem}${extension}`;
}

export const loadAssets = (
  manifestOrPath: string | Record<string, string> = "dist/manifest.json",
): AssetResolver => {
  let manifest: Record<string, string> | null = null;
  if (typeof manifestOrPath === "object" && manifestOrPath !== null) {
    manifest = manifestOrPath;
  } else if (typeof manifestOrPath === "string") {
    try {
      const text = Deno.readTextFileSync(manifestOrPath);
      manifest = JSON.parse(text);
    } catch {
      manifest = null;
    }
  }

  return function asset(path: string): string {
    const key = path.replace(/^\.?\/*src\//, "");
    if (manifest !== null) {
      const url = manifest[key];
      if (!url) {
        throw new Error(`Asset not found in manifest: ${path}`);
      }
      return url;
    }
    return defaultAssetUrl(path);
  };
};
