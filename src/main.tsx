import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

window.addEventListener('error', (e) => {
  if (e.message === 'Script error.') return;
  e.preventDefault();
  e.stopPropagation();
  const div = document.createElement('div');
  div.style.cssText = 'color:white; background:red; position:absolute; top:0; left:0; z-index:99999; padding:10px; font-family:monospace; white-space:pre-wrap; font-size:12px;';
  let msg = 'CAUGHT ERROR: ' + (e.error ? e.error.stack : e.message);
  div.textContent = msg;
  document.body.appendChild(div);
  console.log('CAUGHT ERROR', e);
});

window.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const div = document.createElement('div');
  div.style.cssText = 'color:white; background:purple; position:absolute; top:0; left:0; z-index:99999; padding:10px; font-family:monospace; white-space:pre-wrap; font-size:12px;';
  let msg = 'PROMISE ERROR: ' + (e.reason ? (e.reason.stack || e.reason.message || e.reason) : 'Unknown reason');
  div.textContent = msg;
  document.body.appendChild(div);
  console.log('PROMISE ERROR', e);
});

import('./App.tsx').then((module) => {
  const App = module.default;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}).catch(err => {
  const div = document.createElement('div');
  div.style.cssText = 'color:white; background:blue; position:absolute; top:0; left:0; z-index:99999; padding:10px; font-family:monospace; white-space:pre-wrap; font-size:12px;';
  let msg = 'IMPORT ERROR: ' + (err.stack || err.message || err);
  div.textContent = msg;
  document.body.appendChild(div);
  // console.error('IMPORT ERROR', err);
});





