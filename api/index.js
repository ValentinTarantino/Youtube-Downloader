const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const contentDisposition = require('content-disposition');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// --- SOLUCIÓN DEFINITIVA: Preparar encabezados para engañar a YouTube ---
function getRequestOptions() {
const headers = {};
  // Usamos un User-Agent de un navegador real
    headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

  // Si la variable de entorno de cookies existe, la añadimos
    if (process.env.YOUTUBE_COOKIE) {
    console.log('[Auth] Usando cookies y User-Agent.');
    headers.cookie = process.env.YOUTUBE_COOKIE;
    } else {
    console.log('[Auth] Usando solo User-Agent.');
    }

return { requestOptions: { headers } };
}

// --- Ruta para obtener información del video ---
app.get('/video-info', async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL || !ytdl.validateURL(videoURL)) {
        return res.status(400).send({ error: 'URL inválida.' });
    }
    try {
        const requestOptions = getRequestOptions(); // Obtenemos los encabezados
        const info = await ytdl.getInfo(videoURL, requestOptions); // Usamos los encabezados
        
        const bestAudioFormat = ytdl.filterFormats(info.formats, 'audioonly').find(f => f.container === 'mp4' && f.audioBitrate);
        const videoFormats = info.formats
            .filter(f => f.container === 'mp4' && f.qualityLabel && parseInt(f.qualityLabel) <= 720)
            .map(f => ({ itag: f.itag, quality: f.qualityLabel, hasAudio: f.hasAudio, audioItag: f.hasAudio ? null : (bestAudioFormat ? bestAudioFormat.itag : null) }))
            .filter((v, i, a) => a.findIndex(t => (t.quality === v.quality)) === i)
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
        const audioFormats = info.formats
            .filter(f => f.container === 'mp4' && f.audioBitrate === 128)
            .map(f => ({ itag: f.itag, quality: `${f.audioBitrate}kbps` }))
            .filter((v, i, a) => a.findIndex(t => (t.quality === v.quality)) === i);

        res.json({
            title: info.videoDetails.title || 'Título no disponible',
            thumbnail: info.videoDetails.thumbnails.pop().url,
            videoFormats,
            audioFormats
        });
    } catch (error) {
        console.error(`[VIDEO_INFO ERROR]`, error.message);
        res.status(500).send({ error: 'Error al obtener info del video.' });
    }
});

// --- Ruta de Descarga ---
app.get('/download', async (req, res) => {
    const { url, title = 'video', format, videoItag, audioItag } = req.query;

    if (!ytdl.validateURL(url)) {
        return res.status(400).send({ error: 'URL inválida.' });
    }

    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-_.]/g, "_");
    res.setHeader('Content-Disposition', contentDisposition(`${sanitizedTitle}.${format}`));

    try {
        const requestOptions = getRequestOptions(); // Obtenemos los encabezados

        if (format === 'mp3') {
            res.setHeader('Content-Type', 'audio/mpeg');
            const ffmpeg = require('fluent-ffmpeg');
            ffmpeg.setFfmpegPath(ffmpegPath);
            const audioStream = ytdl(url, { ...requestOptions, quality: 'highestaudio' });
            ffmpeg(audioStream).audioBitrate(128).toFormat('mp3').pipe(res);
        } else if (format === 'mp4') {
            res.setHeader('Content-Type', 'video/mp4');
            if (audioItag) {
                const videoStream = ytdl(url, { ...requestOptions, quality: videoItag });
                const audioStream = ytdl(url, { ...requestOptions, quality: audioItag, filter: 'audioonly' });
                const ffmpegArgs = ['-i', 'pipe:3', '-i', 'pipe:4', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1'];
                const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });
                videoStream.pipe(ffmpegProcess.stdio[3]);
                audioStream.pipe(ffmpegProcess.stdio[4]);
                ffmpegProcess.stdio[1].pipe(res);
                ffmpegProcess.on('close', () => res.end());
            } else {
                ytdl(url, { ...requestOptions, quality: videoItag }).pipe(res);
            }
        }
    } catch (error) {
        console.error(`[DOWNLOAD FATAL]`, error.message);
        if (!res.headersSent) res.status(500).send('Error inesperado.');
        res.end();
    }
});

// --- Iniciar el Servidor ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));