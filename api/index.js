console.log("[API STARTUP] Function api/index.js is attempting to start!"); // ¡Este log debe aparecer en Vercel Functions!

const express = require("express");
const cors = require("cors");
// --- Comentar o eliminar las siguientes líneas ---
// const ytdl = require("@distube/ytdl-core");
// const contentDisposition = require("content-disposition");
// const { spawn } = require("child_process");
// const ffmpegPath = require("ffmpeg-static");
// const ffmpeg = require("fluent-ffmpeg");
// --- Fin de líneas a comentar ---

const app = express();
app.use(cors());

// Esta ruta capturará CUALQUIER petición a la API
app.all('*', (req, res) => {
    console.log(`[API RECEIVED] Method: ${req.method}, Path: ${req.path}, OriginalUrl: ${req.originalUrl}, Query: ${JSON.stringify(req.query)}`);
    res.status(200).json({
        message: "API function is running and serving this test response!",
        receivedPath: req.path,
        originalUrl: req.originalUrl,
        query: req.query
    });
});

// --- Comentar o eliminar las siguientes líneas (todas tus rutas originales y manejadores de error) ---
// app.get("/video-info", ...)
// app.get("/download", ...)
// app.use((req, res) => { ... }) // Tu manejador de 404
// app.use((err, req, res, next) => { ... }) // Tu manejador de 500
// --- Fin de líneas a comentar ---

module.exports = app;