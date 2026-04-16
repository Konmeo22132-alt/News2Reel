import { execSync } from "child_process";
import ffmpegPath from "ffmpeg-static";
try {
    const cmd = `"${ffmpegPath}" -v warning -f lavfi -i color=0x000000:s=1080x1920:r=30:d=4.716 -i "C:/Users/Admin/AppData/Local/Temp/test_1776326628115.mp3" -i "C:/Users/Admin/Downloads/Auto video/autovideo-admin/public/assets/visuals/laptop.png" -y -filter_complex "[0:v]geq=r=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101.4535850411492)*3))*(44-13)+13:g=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101.4535850411492)*3))*(0-13)+13:b=(1-exp(-(sqrt((W-540)*(W-540)+(H-960)*(H-960))/1101.4535850411492)*3))*(0-13)+13[grad]; [grad][2:v]overlay=390:640[with_icon]; [with_icon]ass='C\\:/Users/Admin/Downloads/Auto video/autovideo-admin/test_1776326628115.ass'[out]" -map "[out]" -map 1:a -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -avoid_negative_ts make_zero "test_final.mp4"`;
    console.log("Running:", cmd);
    execSync(cmd, { stdio: "inherit" });
} catch(e) { console.error("Error!") }
