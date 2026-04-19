import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";

ffmpeg.setFfmpegPath(ffmpegPath!);

const yExpr = "2120 - min(t,0.8)/0.8*(2-min(t,0.8)/0.8)*(2120 - ((1920-500)/2 - 50))";

// Build the exact filter string from video-renderer.ts
const filterComplex = `
[0:v]geq=r=100:g=100:b=100[bg];
[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='zoom+0.0005':d=150:s=1080x1920:fps=30,setpts=PTS-STARTPTS,format=yuv420p[kb_img];
[bg][kb_img]overlay=x=0:y=0:eval=init[bg_img];
[bg_img]vignette=angle=PI/4[bg_vign];
[2:v]scale=1040:-1,format=rgba[social_raw];
[social_raw]fade=t=in:st=0:d=0.66:alpha=1[social_faded];
[bg_vign][social_faded]overlay=x=(W-w)/2:y='${yExpr}':eval=frame[with_social];
[with_social]null[out]
`.replace(/\n/g, " ").trim();

const cmd = ffmpeg();
cmd.input(`color=c=black:s=1080x1920:r=30:d=2`).inputOptions(["-f", "lavfi"]);
cmd.input(`color=c=red:s=1080x1920:r=30:d=2`).inputOptions(["-f", "lavfi"]);
cmd.input(`color=c=blue:s=1040x500:r=30:d=2`).inputOptions(["-f", "lavfi"]);

cmd.outputOptions([
  "-filter_complex", filterComplex,
  "-map", "[out]",
  "-y"
]);
cmd.output(".tmp/test_out.mp4");

cmd.on("start", (cmdString) => console.log("Running:", cmdString));
cmd.on("error", (err) => console.error("FFMPEG ERROR:", err.message));
cmd.on("end", () => console.log("SUCCESS!"));
cmd.run();

