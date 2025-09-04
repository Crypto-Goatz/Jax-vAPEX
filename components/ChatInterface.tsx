
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { runChat } from '../services/geminiService';
import { ChatMessage } from './ChatMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { SendIcon } from './Icons';

const EXAMPLE_PROMPTS = [
  "Give me the best intraday idea right now",
  "Show signals for SOL 60m",
  "How is the system health?"
];

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { id: 'initial', role: 'model', content: "I am JaxSpot, your AI market agent. How can I help you analyze the crypto markets today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (prompt?: string) => {
    const userMessageContent = prompt || input;
    if (!userMessageContent.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const modelResponse = await runChat(userMessageContent);
      const newModelMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: modelResponse,
      };
      setMessages(prev => [...prev, newModelMessage]);
    } catch (error) {
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExamplePrompt = (prompt: string) => {
    setInput(prompt);
    handleSend(prompt);
  };

  return (
    <div className="w-full max-w-4xl h-[75vh] flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700">
      <div className="flex-grow p-4 overflow-y-auto space-y-6">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
            <div className="flex justify-start items-center space-x-3">
                 <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 font-bold">J</div>
                 <div className="bg-gray-700 p-3 rounded-lg"><LoadingSpinner /></div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 border-t border-gray-700">
        <div className="flex space-x-2 mb-3">
          {EXAMPLE_PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => handleExamplePrompt(prompt)}
              disabled={isLoading}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 rounded-full transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask JaxSpot for an idea..."
            disabled={isLoading}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-colors"
          >
            {isLoading ? <LoadingSpinner /> : <SendIcon />}
          </button>
        </form>
      </div>
    </div>
  );
};
