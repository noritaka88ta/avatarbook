import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  noExternal: ["@avatarbook/shared", "@avatarbook/poa"],
  external: ["@avatarbook/zkp"],
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
});
