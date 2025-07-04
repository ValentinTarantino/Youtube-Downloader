const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const contentDisposition = require('content-disposition');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// --- HEALTH CHECK (RENDER) ---
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// --- VIDEO INFO --- 
app.get('/video-info', async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL || !ytdl.validateURL(videoURL)) {
        return res.status(400).send({ error: 'URL inválida.' });
    }

    try {
        const info = await ytdl.getInfo(videoURL);

        const seenVideoQualities = new Set();
        const seenAudioQualities = new Set();

        const bestAudioFormat = ytdl
            .filterFormats(info.formats, 'audioonly')
            .filter(f => f.container === 'mp4' && f.audioBitrate)
            .sort((a, b) => b.audioBitrate - a.audioBitrate)[0];

        const videoFormats = info.formats
            .filter(f => f.container === 'mp4' && f.qualityLabel)
            .filter(f => {
                const qualityNum = parseInt(f.qualityLabel);
                return (
                    qualityNum <= 720 &&
                    !seenVideoQualities.has(f.qualityLabel) &&
                    seenVideoQualities.add(f.qualityLabel)
                );
            })
            .map(f => ({
                itag: f.itag,
                quality: f.qualityLabel,
                hasAudio: f.hasAudio,
                audioItag: f.hasAudio ? null : (bestAudioFormat ? bestAudioFormat.itag : null)
            }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        const audioFormats = ytdl
            .filterFormats(info.formats, 'audioonly')
            .filter(f => f.container === 'mp4' && f.audioBitrate === 128)
            .filter(f => {
                const quality = `${f.audioBitrate}kbps`;
                return (
                    !seenAudioQualities.has(quality) &&
                    seenAudioQualities.add(quality)
                );
            })
            .map(f => ({
                itag: f.itag,
                quality: `${f.audioBitrate}kbps`
            }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        res.json({
            title: info.videoDetails.title || 'Título no disponible',
            thumbnail: info.videoDetails.thumbnails.pop().url,
            videoFormats,
            audioFormats
        });
    } catch (error) {
        console.error('Error en /video-info de API:', error.message);
        res.status(500).send({ error: 'Error interno del servidor al obtener info.' });
    }
});


// --- DOWNLOAD (MODIFICADO PARA STREAMING DIRECTO) ---
app.get('/download', async (req, res) => {
    const { url, title = 'video', format, videoItag, audioItag } = req.query;

    if (!ytdl.validateURL(url)) {
        return res.status(400).send({ error: 'URL inválida o parámetros faltantes.' });
    }

    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-_.]/g, "_");
    res.setHeader('Content-Disposition', contentDisposition(`${sanitizedTitle}.${format}`));

    try {
        if (format === 'mp3') {
            res.setHeader('Content-Type', 'audio/mpeg');
            ffmpeg(ytdl(url, { quality: 'highestaudio' }))
                .audioBitrate(128)
                .toFormat('mp3')
                .on('error', (err) => {
                    console.error('Error durante la conversión a MP3:', err.message);
                    if (!res.headersSent) res.status(500).send('Error durante la conversión a MP3.');
                })
                .pipe(res);
        } else if (format === 'mp4') {
            res.setHeader('Content-Type', 'video/mp4');
            ytdl(url, { quality: videoItag })
                .on('error', (err) => {
                    console.error('Error durante la descarga de MP4:', err.message);
                    if (!res.headersSent) res.status(500).send('Error durante la descarga de MP4.');
                })
                .pipe(res);
        } else {
            return res.status(400).send({ error: 'Formato o itag no soportado.' });
        }
    } catch (error) {
        console.error('[ERROR FATAL] Proceso de descarga/conversión falló:', error.message);
        if (!res.headersSent) {
            res.status(500).send({ error: 'La operación falló en el servidor.' });
        }
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log('Modo de desarrollo activo.');
    }
});