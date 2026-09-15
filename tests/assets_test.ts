import { defaultAssetUrl, loadAssets } from "../src/framework/assets.ts";
import { resolveBundleOptions } from "../src/framework/bundle/bundle.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, but got ${actual}`);
  }
}

Deno.test("resolveBundleOptions defaults hash and manifest to false", () => {
  const options = resolveBundleOptions();
  assertEquals(options.hash, false);
  assertEquals(options.manifest, false);
  assertEquals(options.watch, false);
});

Deno.test("resolveBundleOptions respects explicit options", () => {
  const withHash = resolveBundleOptions({ hash: true });
  assertEquals(withHash.hash, true);
  assertEquals(withHash.manifest, false);

  const withHashFiles = resolveBundleOptions({ hashFiles: true });
  assertEquals(withHashFiles.hash, true);

  const withManifest = resolveBundleOptions({ manifest: true });
  assertEquals(withManifest.manifest, true);

  const withBoth = resolveBundleOptions({ hash: true, manifest: true });
  assertEquals(withBoth.hash, true);
  assertEquals(withBoth.manifest, true);
});

Deno.test("defaultAssetUrl maps source paths to unhashed asset URLs", () => {
  assertEquals(
    defaultAssetUrl("features/editor/editor.client.ts"),
    "/assets/features-editor-editor.client.js",
  );
  assertEquals(
    defaultAssetUrl("src/features/editor/editor.client.ts"),
    "/assets/features-editor-editor.client.js",
  );
  assertEquals(
    defaultAssetUrl("features/editor/editor.client.css"),
    "/assets/features-editor-editor.client.css",
  );
  assertEquals(
    defaultAssetUrl("src/features/about/about.client.ts"),
    "/assets/features-about-about.client.js",
  );
});

Deno.test("loadAssets resolves unhashed paths when manifest does not exist", () => {
  const resolver = loadAssets("dist/non-existent-manifest.json");
  assertEquals(
    resolver("features/editor/editor.client.ts"),
    "/assets/features-editor-editor.client.js",
  );
  assertEquals(
    resolver("src/features/about/about.client.css"),
    "/assets/features-about-about.client.css",
  );
});

Deno.test("loadAssets resolves paths from provided manifest object", () => {
  const manifest = {
    "features/editor/editor.client.ts": "/assets/features-editor-editor.client-12345678.js",
    "features/editor/editor.client.css": "/assets/features-editor-editor.client-87654321.css",
  };
  const resolver = loadAssets(manifest);

  assertEquals(
    resolver("features/editor/editor.client.ts"),
    "/assets/features-editor-editor.client-12345678.js",
  );
  assertEquals(
    resolver("src/features/editor/editor.client.css"),
    "/assets/features-editor-editor.client-87654321.css",
  );
});

Deno.test("loadAssets throws when key not found in existing manifest", () => {
  const manifest = {
    "features/editor/editor.client.ts": "/assets/features-editor-editor.client.js",
  };
  const resolver = loadAssets(manifest);

  let threw = false;
  try {
    resolver("features/missing/missing.client.ts");
  } catch (error) {
    threw = true;
    assert(error instanceof Error && error.message.includes("Asset not found in manifest"));
  }
  assert(threw, "Expected resolver to throw for missing asset");
});
