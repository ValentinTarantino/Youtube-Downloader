import { useState } from 'react';
import UrlForm from './components/UrlForm';
import VideoCard from './components/VideoCard';
import './App.css'; 

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
      // Expresión regular para extraer el ID del video de varios formatos de URL de YouTube
      const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
      const match = rawUrl.trim().match(regExp);

      if (match && match[1]) {
        const videoId = match[1];
        const finalYoutubeUrl = `http://googleusercontent.com/youtube.com/5${videoId}`;
        
        // La URL que se pasará a la API
        const response = await fetch(`/api/video-info?url=${encodeURIComponent(finalYoutubeUrl)}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error en la API: ${response.status}`);
        }

        const data = await response.json();
        setVideoInfo(data);
        setCleanYoutubeUrl(finalYoutubeUrl); // Guardamos la URL limpia para la descarga
      } else {
        throw new Error('URL de YouTube no válida. No se pudo encontrar un ID de video.');
      }

    } catch (err) {
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

    const downloadUrl = `${API_BASE_URL}/api/download?${params.toString()}`; 
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