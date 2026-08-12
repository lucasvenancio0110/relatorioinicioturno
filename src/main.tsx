import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/app.css';
import './styles/report-editor.css';
import './styles/block-editor-conflicts.css';
import './styles/attention-decisions.css';
import './styles/interaction.css';

const preventGestureZoom = (event: Event) => event.preventDefault();
document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
document.addEventListener('gestureend', preventGestureZoom, { passive: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
