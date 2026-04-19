import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";

ffmpeg.setFfmpegPath(ffmpegPath!);

import path from "path";
const assFilePath = path.join(process.cwd(), ".tmp", "test_sub.ass");
fs.writeFileSync(assFilePath, "blank");
const assEscaped = assFilePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "'\\''");

const cx = 540, cy = 960, maxDist = 1101, cycleSlow = 10, pulseAmp = 0.08;
const distExpr = `sqrt((W-${cx})*(W-${cx})+(H-${cy})*(H-${cy}))`;
const fromRGB = {r: 10, g: 10, b: 10};
const toRGB = {r: 30, g: 30, b: 30};

const rExpr = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.r}-${fromRGB.r})+${fromRGB.r}+${pulseAmp}*${fromRGB.r}*sin(T*2*PI/${cycleSlow})`;
const gExpr = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.g}-${fromRGB.g})+${fromRGB.g}+${pulseAmp}*${fromRGB.g}*cos(T*2*PI/${cycleSlow}*1.3)`;
const bExpr = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.b}-${fromRGB.b})+${fromRGB.b}+${pulseAmp}*${fromRGB.b}*sin(T*2*PI/${cycleSlow}*0.7)`;

const gradFilter = `geq=r=${rExpr}:g=${gExpr}:b=${bExpr}`;

let filterComplex = "";
filterComplex += `[0:v]${gradFilter}[bg]; `;
filterComplex += `[bg]ass='${assEscaped}'[out]`;

const cmd = ffmpeg();
cmd.input(`color=0x000000:s=1080x1920:r=30:d=2`).inputOptions(["-f", "lavfi"]);

cmd.complexFilter(filterComplex);
cmd.outputOptions(["-map", "[out]"]);
cmd.output(".tmp/test_scene1.mp4");

cmd.on("start", (cmdString) => console.log("Running:", cmdString));
cmd.on("error", (err) => console.error("FFMPEG ERROR:", err.message));
cmd.on("end", () => console.log("SUCCESS!"));
cmd.run();
