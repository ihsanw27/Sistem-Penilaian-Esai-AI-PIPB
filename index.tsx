
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Find the root element in the HTML.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Create a React root and render the main App component.
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
