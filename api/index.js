const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const contentDisposition = require('content-disposition');
const fs = require('fs');
const path = require('path');

const app = express();

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.use(cors({ origin: '*' }));

// --- Endpoint de información (con filtros de calidad exactos) ---
app.get('/video-info', async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL || !ytdl.validateURL(videoURL)) {
        return res.status(400).send({ error: 'URL inválida.' });
    }

    try {
        const info = await ytdl.getInfo(videoURL);
        const seenVideoQualities = new Set();
        const seenAudioQualities = new Set();

        const bestAudioFormat = ytdl.filterFormats(info.formats, 'audioonly')
            .filter(f => f.container === 'mp4' && f.audioBitrate)
            .sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
        
        const videoFormats = info.formats
            .filter(f => f.container === 'mp4' && f.qualityLabel)
            .filter(f => {
                const qualityNum = parseInt(f.qualityLabel);
                return qualityNum <= 720 && !seenVideoQualities.has(f.qualityLabel) && seenVideoQualities.add(f.qualityLabel);
            })
            .map(f => ({
                itag: f.itag,
                quality: f.qualityLabel,
                hasAudio: f.hasAudio,
                audioItag: f.hasAudio ? null : (bestAudioFormat ? bestAudioFormat.itag : null)
            }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        // --- CAMBIO CLAVE AQUÍ ---
        // Filtramos para obtener SOLO la calidad de audio de 128kbps y nada más.
        const audioFormats = info.formats
            .filter(f => f.container === 'mp4' && f.audioBitrate === 128) // ¡AQUÍ ESTÁ EL FILTRO EXACTO!
            .filter(f => {
                const quality = `${f.audioBitrate}kbps`;
                return !seenAudioQualities.has(quality) && seenAudioQualities.add(quality);
            })
            .map(f => ({ itag: f.itag, quality: `${f.audioBitrate}kbps` }))
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


// Endpoint de descarga (sin cambios)
app.get('/download', async (req, res) => {
    const { url, title = 'video', format, videoItag, audioItag } = req.query;

    if (!ytdl.validateURL(url) || !videoItag) {
        return res.status(400).send({ error: 'Parámetros inválidos.' });
    }

    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-_.]/g, "_");
    res.setHeader('Content-Disposition', contentDisposition(`${sanitizedTitle}.${format}`));
    
    const randomId = Math.random().toString(36).substring(7);
    const outputPath = path.join(tempDir, `output_${randomId}.${format}`);
    
    const cleanupFiles = (files) => {
        files.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlink(file, (err) => {
                    if (err) console.error(`Error al borrar temporal: ${file}`, err);
                });
            }
        });
    };

    try {
        if (format === 'mp3') {
            res.setHeader('Content-Type', 'audio/mpeg');
            const audioStream = ytdl(url, { quality: videoItag });
            await new Promise((resolve, reject) => {
                ffmpeg(audioStream).audioBitrate(128).format('mp3').on('error', reject).on('end', resolve).save(outputPath);
            });
        } else if (format === 'mp4' && audioItag) {
            const videoPath = path.join(tempDir, `video_${randomId}.mp4`);
            const audioPath = path.join(tempDir, `audio_${randomId}.mp4`);
            await Promise.all([
                new Promise((resolve, reject) => ytdl(url, { quality: videoItag }).pipe(fs.createWriteStream(videoPath)).on('finish', resolve).on('error', reject)),
                new Promise((resolve, reject) => ytdl(url, { quality: audioItag }).pipe(fs.createWriteStream(audioPath)).on('finish', resolve).on('error', reject))
            ]);
            await new Promise((resolve, reject) => {
                ffmpeg().input(videoPath).videoCodec('copy').input(audioPath).audioCodec('copy').format('mp4').on('error', reject).on('end', resolve).save(outputPath);
            });
            cleanupFiles([videoPath, audioPath]);
        } else if (format === 'mp4' && !audioItag) {
            res.setHeader('Content-Type', 'video/mp4');
            const stream = ytdl(url, { quality: videoItag });
            stream.pipe(fs.createWriteStream(outputPath));
            await new Promise((resolve, reject) => stream.on('finish', resolve).on('error', reject));
        }

        res.sendFile(outputPath, (err) => {
            if (err) {
                console.error('Error al enviar archivo al cliente:', err.message);
                if (!res.headersSent) res.status(500).send({ error: 'Error al enviar el archivo final.' });
            }
            cleanupFiles([outputPath]);
        });

    } catch (error) {
        console.error('[ERROR FATAL] Proceso de descarga/conversión/fusión falló:', error.message);
        cleanupFiles([outputPath]);
        if (!res.headersSent) {
            res.status(500).send({ error: 'La operación falló en el servidor.' });
        }
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
}
module.exports = app;