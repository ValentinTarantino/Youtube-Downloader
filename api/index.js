const express = require("express");
const cors = require("cors");
// const ytdl = require("@distube/ytdl-core"); // Comentar
// const contentDisposition = require("content-disposition"); // Comentar
// const { spawn } = require("child_process"); // Comentar
// const ffmpegPath = require("ffmpeg-static"); // Comentar
// const ffmpeg = require("fluent-ffmpeg"); // Comentar

const app = express();
app.use(cors());

// -------------------- /video-info (Temporal) --------------------
app.get("/video-info", async (req, res) => {
    console.log("[TEST] Received request for /video-info. Returning dummy data."); // Esto debería aparecer en los logs de Vercel Functions
    try {
        // Simplemente devuelve data dummy para probar que la función se ejecuta
        res.json({
            title: "Dummy Video Title",
            thumbnail: "https://via.placeholder.com/150", // Una URL de imagen genérica
            videoFormats: [{ itag: "test-720p", quality: "720p", hasAudio: true, audioItag: null }],
            audioFormats: [{ itag: "test-128kbps", quality: "128kbps" }],
            message: "This is a test response. If you see this, the API is working!"
        });
    } catch (error) {
        console.error(`[VIDEO_INFO ERROR - TEST]`, error.message);
        res.status(500).send({ error: "Error al obtener info del video (TEST)." });
    }
});

// -------------------- /api/download --------------------
app.get("/api/download", async (req, res) => {
const { url, title = "video", format, videoItag, audioItag } = req.query;

if (!ytdl.validateURL(url)) {
    return res.status(400).send({ error: "URL inválida." });
}

const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-_.]/g, "_");
res.setHeader(
    "Content-Disposition",
    contentDisposition(`${sanitizedTitle}.${format}`)
);

try {
    if (format === "mp3") {
    res.setHeader("Content-Type", "audio/mpeg");
    ffmpeg.setFfmpegPath(ffmpegPath);
    const audioStream = ytdl(url, { quality: "highestaudio" });
    ffmpeg(audioStream).audioBitrate(128).toFormat("mp3").pipe(res);
    } else if (format === "mp4") {
    res.setHeader("Content-Type", "video/mp4");
    if (audioItag) {
        const videoStream = ytdl(url, { quality: videoItag });
        const audioStream = ytdl(url, {
        quality: audioItag,
        filter: "audioonly",
        });
        const ffmpegArgs = [
        "-i",
        "pipe:3",
        "-i",
        "pipe:4",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov",
        "pipe:1",
        ];
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
        });
        videoStream.pipe(ffmpegProcess.stdio[3]);
        audioStream.pipe(ffmpegProcess.stdio[4]);
        ffmpegProcess.stdio[1].pipe(res);
        ffmpegProcess.on("close", () => res.end());
    } else {
        ytdl(url, { quality: videoItag }).pipe(res);
    }
    }
} catch (error) {
    console.error(`[DOWNLOAD FATAL]`, error.message);
    if (!res.headersSent) res.status(500).send("Error inesperado.");
    res.end();
}
});

// ✅ Agregado para que Render pueda correr el servidor correctamente
module.exports = app;
