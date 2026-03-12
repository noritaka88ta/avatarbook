#!/usr/bin/env node
/**
 * Capture demo screenshots from AvatarBook and generate an animated GIF.
 * Usage: node scripts/capture-demo.mjs
 * Requires: puppeteer (dev dep), ffmpeg
 */

import puppeteer from "puppeteer";
import { execFileSync } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TMP = join(ROOT, ".demo-frames");
const OUT = join(ROOT, "docs", "demo.gif");
const BASE = "http://localhost:3456";
const WIDTH = 1280;
const HEIGHT = 800;

// Pages to capture with delays (ms) between frames
const SCENES = [
  { url: "/", name: "01-landing", wait: 1500 },
  { url: "/feed", name: "02-feed", wait: 2000 },
  { url: "/feed", name: "03-feed-scroll", wait: 500, scroll: 400 },
  { url: "/market", name: "04-market", wait: 2000 },
  { url: "/dashboard", name: "05-dashboard", wait: 2000 },
];

async function main() {
  // Clean/create temp dir
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  // Dark background
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

  let frameIdx = 0;
  for (const scene of SCENES) {
    console.log(`Capturing ${scene.name}...`);
    await page.goto(`${BASE}${scene.url}`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, scene.wait));

    if (scene.scroll) {
      await page.evaluate((y) => window.scrollBy(0, y), scene.scroll);
      await new Promise((r) => setTimeout(r, 500));
    }

    const path = join(TMP, `frame-${String(frameIdx).padStart(3, "0")}.png`);
    await page.screenshot({ path, type: "png" });
    frameIdx++;
  }

  await browser.close();
  console.log(`Captured ${frameIdx} frames.`);

  // Convert to GIF using ffmpeg
  // Each frame shown for 2 seconds, looping
  console.log("Generating GIF...");
  const args = [
    "-y",
    "-framerate", "0.5",
    "-i", join(TMP, "frame-%03d.png"),
    "-vf", "scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
    "-loop", "0",
    OUT,
  ];

  execFileSync("ffmpeg", args, { stdio: "inherit" });

  // Cleanup
  rmSync(TMP, { recursive: true });

  console.log(`\nDemo GIF saved to: ${OUT}`);

  // Also check file size
  const { statSync } = await import("fs");
  const size = statSync(OUT).size;
  console.log(`Size: ${(size / 1024 / 1024).toFixed(1)} MB`);

  if (size > 5 * 1024 * 1024) {
    console.log("GIF is large (>5MB). Consider optimizing or using a video format instead.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
