import { useState } from 'react';
import UrlForm from './components/UrlForm';
import VideoCard from './components/VideoCard';
import './App.css'; 

// ¡CAMBIO CLAVE! La URL base ahora es relativa, apuntando a la API de Vercel
const API_BASE_URL = '';

function App() {
  const [rawUrl, setRawUrl] = useState('');
  const [cleanYoutubeUrl, setCleanYoutubeUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetVideoInfo = async () => {
    if (!rawUrl) {
      setError('Por favor, introduce una URL de YouTube.');
      return;
    }
    setIsLoading(true);
    setError('');
    setVideoInfo(null);
    setCleanYoutubeUrl('');

    try {
      let urlToProcess = rawUrl.trim();
      if (!urlToProcess.startsWith('http')) {
        urlToProcess = `https://${urlToProcess}`;
      }
      const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
      const match = urlToProcess.match(regExp);
      let finalYoutubeUrl = urlToProcess;

      if (match && match[1]) {
        finalYoutubeUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      } else {
        throw new Error('URL de YouTube no válida. Por favor, verifica el formato del enlace.');
      }

      // ¡CAMBIO CLAVE! La petición ahora va a /api/video-info
      const requestUrl = `${API_BASE_URL}/api/video-info?url=${encodeURIComponent(finalYoutubeUrl)}`;
      console.log('Fetching video info from:', requestUrl);

      const response = await fetch(requestUrl);
      
      if (!response.ok) {
        throw new Error('Error al obtener la información del video.');
      }
      
      const data = await response.json();
      setVideoInfo(data);
      setCleanYoutubeUrl(finalYoutubeUrl);
    } catch (err) {
      console.error('Frontend Error:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (format, videoItag, audioItag) => { 
    if (!cleanYoutubeUrl) {
        setError('No se pudo iniciar la descarga: URL no validada.');
        return;
    }

    const params = new URLSearchParams({
      url: cleanYoutubeUrl,
      format: format,
      title: videoInfo.title,
      videoItag: videoItag, 
    });
    
    if (format === 'mp4' && audioItag) {
      params.append('audioItag', audioItag);
    }

    // ¡CAMBIO CLAVE! La descarga ahora va a /api/download
    const downloadUrl = `${API_BASE_URL}/api/download?${params.toString()}`; 
    console.log('Attempting to download from:', downloadUrl);
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="container app-container">
      <div className="row">
        <div className="col-lg-10 offset-lg-1 col-xl-8 offset-xl-2">
          <header className="app-header">
            <h1>Youtube Downloader</h1>
          </header>
          <main className="app-main">
            <UrlForm url={rawUrl} onUrlChange={(e) => setRawUrl(e.target.value)} onSubmit={handleGetVideoInfo} isLoading={isLoading}/>
            {error && <p className="error-message">{error}</p>}
            <VideoCard videoInfo={videoInfo} onDownload={handleDownload} />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;