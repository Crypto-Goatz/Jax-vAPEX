
import React from 'react';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <ChatInterface />
      </main>
      <footer className="text-center p-4 text-xs text-gray-500">
        <p>JaxSpot AI Agent. Educational use only. This is not financial advice.</p>
        <p>Futures trading involves substantial risk of loss and is not suitable for all investors.</p>
      </footer>
    </div>
  );
};

export default App;
