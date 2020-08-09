import React from 'react';
import logo from './logo.svg';
import './App.css';
import {sampleFunction1} from 'co-doc-editor-core';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          {sampleFunction1()}
        </a>
      </header>
    </div>
  );
}

export default App;
