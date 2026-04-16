import ffmpegPath from "ffmpeg-static";
import { execSync } from "child_process";
import fs from "fs";

try {
    console.log(`FFmpeg Path: ${ffmpegPath}`);
    // Check version
    console.log("Version:", execSync(`"${ffmpegPath}" -version`).toString().split('\n')[0]);
    
    // Create an empty ass file
    fs.writeFileSync("test.ass", "");

    // Test filter graph that failed
    const filter = `[0:v]geq=r=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101)*3))*(44-13)+13:g=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101)*3))*(0-13)+13:b=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101)*3))*(0-13)+13[grad]; [grad][1:v]overlay=390:640[with_icon]; [with_icon]ass=test.ass[out]`;
    
    console.log("Testing filter:", filter);
    const cmd = `"${ffmpegPath}" -f lavfi -i color=c=black:s=1080x1920:d=1 -f lavfi -i color=c=red:s=300x300:d=1 -filter_complex "${filter}" -map "[out]" -y test_static_out.mp4`;
    console.log("Running:", cmd);
    
    const output = execSync(cmd, { stdio: 'pipe' });
    console.log("Success!");
} catch(e) {
    console.error("Failed:", e.stderr ? e.stderr.toString() : e);
}
