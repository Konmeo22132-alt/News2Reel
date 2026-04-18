import ffmpegPath from "ffmpeg-static";
import { execSync } from "child_process";

try {
    const cmd = `"${ffmpegPath}" -f lavfi -i color=0x000000:s=1080x1920:r=30:d=4.7 -f lavfi -i anullsrc -i "C:/Users/Admin/Downloads/Auto video/autovideo-admin/public/assets/visuals/laptop.png" -y -filter_complex "[0:v]geq=r=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101.4)*3))*(44-13)+13:g=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101.4)*3))*(0-13)+13:b=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101.4)*3))*(0-13)+13[grad]; [grad][2:v]overlay=390:640[with_icon]; [with_icon]ass=test_1776326302150.ass[out]" -map "[out]" -map 1:a -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -shortest -avoid_negative_ts make_zero C:/Users/Admin/Downloads/test_out.mp4`;
    
    console.log("Running exactly:", cmd);
    const output = execSync(cmd, { stdio: 'pipe' });
    console.log("Success!");
} catch(e: unknown) {
    console.error("FFMPEG FAILED!");
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    console.error("STDOUT:", err.stdout?.toString());
    console.error("STDERR:", err.stderr?.toString());
}
