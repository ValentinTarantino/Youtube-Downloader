import { useState } from 'react';
import UrlForm from './components/UrlForm';
import VideoCard from './components/VideoCard';
import './App.css'; 

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || 'http://localhost:4000';

function App() {
  const [rawUrl, setRawUrl] = useState(''); // Estado para lo que el usuario escribe en el input
  const [cleanYoutubeUrl, setCleanYoutubeUrl] = useState(''); // Estado para la URL de YouTube limpia y validada
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
    setCleanYoutubeUrl(''); // Limpiamos la URL limpia antes de una nueva búsqueda

    try {
      let urlToProcess = rawUrl.trim(); // Eliminar espacios en blanco al inicio/final

      // Añadir protocolo si no está presente, para que ytdl.validateURL lo reconozca
      if (!urlToProcess.startsWith('http://') && !urlToProcess.startsWith('https://')) {
        urlToProcess = `https://${urlToProcess}`;
      }

      // Expresión regular robusta para extraer el ID de video de YouTube
      const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
      const match = urlToProcess.match(regExp);

      let finalYoutubeUrl = urlToProcess;

      if (match && match[1]) {
        // Reconstruye la URL en su formato canónico (https://www.youtube.com/watch?v=VIDEO_ID)
        finalYoutubeUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      } else {
        // Si la URL no coincide con el patrón de YouTube, la consideramos inválida desde el frontend.
        throw new Error('URL de YouTube no válida. Por favor, verifica el formato del enlace.');
      }

      const requestUrl = `${API_BASE_URL}/video-info?url=${encodeURIComponent(finalYoutubeUrl)}`;
      console.log('Fetching video info from:', requestUrl);

      const response = await fetch(requestUrl);
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error desconocido al obtener información del video.');
        } catch (jsonError) {
          if (response.status === 404) {
            throw new Error('La API del backend no encontró la ruta. Asegúrate de que el backend esté funcionando.');
          } else {
            throw new Error(`Error en la API: ${response.status} ${response.statusText}. Respuesta inesperada.`);
          }
        }
      }
      
      const data = await response.json();
      setVideoInfo(data);
      setCleanYoutubeUrl(finalYoutubeUrl);
    } catch (err) {
      console.error('Frontend Error during handleGetVideoInfo:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (format, videoItag, audioItag) => { 
    if (!cleanYoutubeUrl) {
        setError('No se pudo iniciar la descarga: URL de video no validada previamente.');
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

    const downloadUrl = `${API_BASE_URL}/download?${params.toString()}`; 
    console.log('Attempting to download from:', downloadUrl);
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="container app-container">
      <div className="row">
        <div className="col-lg-10 offset-lg-1 col-xl-8 offset-xl-2">
          <header className="app-header">
            <h1>Youtube Downloader</h1>
            <h1 className="youtube-title"></h1>
          </header>

          <main className="app-main">
            <UrlForm
              url={rawUrl}
              onUrlChange={(e) => setRawUrl(e.target.value)}
              onSubmit={handleGetVideoInfo}
              isLoading={isLoading}
            />

            {error && <p className="error-message">{error}</p>}
            
            <VideoCard
              videoInfo={videoInfo}
              onDownload={handleDownload} 
            />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;