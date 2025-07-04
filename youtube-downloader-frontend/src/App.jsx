import { useState } from 'react';
import UrlForm from './components/UrlForm';
import VideoCard from './components/VideoCard';
import './App.css'; 


const API_BASE_URL = '';

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetVideoInfo = async () => {
    if (!url) {
      setError('Por favor, introduce una URL de YouTube.');
      return;
    }
    setIsLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      const apiPath = import.meta.env.PROD ? '/api/video-info' : '/video-info';
      const requestUrl = `${API_BASE_URL}${apiPath}?url=${encodeURIComponent(url)}`; 
      
      const response = await fetch(requestUrl); 
      
      if (!response.ok) {
        throw new Error('No se pudo obtener la información. ¿La URL es correcta?');
      }
      const data = await response.json();
      setVideoInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (format, videoItag, audioItag) => { 
    const params = new URLSearchParams({
      url: url,
      format: format,
      title: videoInfo.title,
      videoItag: videoItag, 
    });
    
    if (format === 'mp4' && audioItag) {
      params.append('audioItag', audioItag);
    }

    const apiPath = import.meta.env.PROD ? '/api/download' : '/download';
    const downloadUrl = `${API_BASE_URL}${apiPath}?${params.toString()}`; 
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
              url={url}
              onUrlChange={(e) => setUrl(e.target.value)}
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



