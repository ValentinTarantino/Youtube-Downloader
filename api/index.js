const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const contentDisposition = require('content-disposition');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// --- Ruta para obtener información del video ---
app.get('/video-info', async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL || !ytdl.validateURL(videoURL)) {
        return res.status(400).send({ error: 'URL inválida.' });
    }
    try {
        const info = await ytdl.getInfo(videoURL);
        const bestAudioFormat = ytdl.filterFormats(info.formats, 'audioonly').find(f => f.container === 'mp4' && f.audioBitrate);

        const videoFormats = info.formats
            .filter(f => f.container === 'mp4' && f.qualityLabel && parseInt(f.qualityLabel) <= 720)
            .map(f => ({
                itag: f.itag,
                quality: f.qualityLabel,
                hasAudio: f.hasAudio,
                audioItag: f.hasAudio ? null : (bestAudioFormat ? bestAudioFormat.itag : null)
            }))
            .filter((v, i, a) => a.findIndex(t => t.quality === v.quality) === i)
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        const audioFormats = info.formats
            .filter(f => f.container === 'mp4' && f.audioBitrate === 128)
            .map(f => ({ itag: f.itag, quality: `${f.audioBitrate}kbps` }))
            .filter((v, i, a) => a.findIndex(t => t.quality === v.quality) === i);

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
        if (format === 'mp3') {
            res.setHeader('Content-Type', 'audio/mpeg');
            const audioStream = ytdl(url, { quality: 'highestaudio', filter: 'audioonly' });

            const ffmpegArgs = [
                '-i', 'pipe:0',
                '-f', 'mp3',
                '-b:a', '128k',
                'pipe:1'
            ];

            const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
            audioStream.pipe(ffmpegProcess.stdin);
            ffmpegProcess.stdout.pipe(res);

            ffmpegProcess.stderr.on('data', (data) => console.error(`[FFMPEG STDERR]: ${data}`));
            ffmpegProcess.on('close', (code) => {
                if (code !== 0) console.error(`FFmpeg process exited with code ${code}`);
                res.end();
            });

        } else if (format === 'mp4') {
            res.setHeader('Content-Type', 'video/mp4');

            if (audioItag) {
                const videoStream = ytdl(url, { quality: videoItag });
                const audioStream = ytdl(url, { quality: audioItag, filter: 'audioonly' });

                const ffmpegArgs = [
                    '-i', 'pipe:3',
                    '-i', 'pipe:4',
                    '-map', '0:v',
                    '-map', '1:a',
                    '-c:v', 'copy',
                    '-c:a', 'copy',
                    '-f', 'mp4',
                    '-movflags', 'frag_keyframe+empty_moov',
                    'pipe:1'
                ];

                const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
                    stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe']
                });

                videoStream.pipe(ffmpegProcess.stdio[3]);
                audioStream.pipe(ffmpegProcess.stdio[4]);
                ffmpegProcess.stdio[1].pipe(res);

                ffmpegProcess.stderr.on('data', (data) => console.error(`[FFMPEG STDERR]: ${data}`));
                ffmpegProcess.on('close', (code) => {
                    if (code !== 0) console.error(`FFmpeg process exited with code ${code}`);
                    res.end();
                });

            } else {
                ytdl(url, { quality: videoItag }).pipe(res);
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
