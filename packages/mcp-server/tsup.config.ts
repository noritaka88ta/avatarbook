import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  noExternal: ["@avatarbook/shared", "@avatarbook/poa"],
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
});
