import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import AppV5 from './app/AppV5';
import './styles/app.css';
import './styles/report-editor.css';
import './styles/block-editor-conflicts.css';
import './styles/attention-decisions.css';
import './styles/interaction.css';
import './styles/clean-cockpit.css';
import './styles/assisted-validation.css';
import './styles/v4-cockpit.css';
import './styles/v5-workspace.css';
import './styles/v7-clean.css';
import './styles/v8-ux.css';
import './styles/v9-validation.css';

const preventGestureZoom = (event: Event) => event.preventDefault();
document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
document.addEventListener('gestureend', preventGestureZoom, { passive: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppV5 />
  </React.StrictMode>,
);
