
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, Idea, Signal, Health } from '../types';
import { runChat } from '../services/geminiService';
import { googleDriveService, DriveFile } from '../services/googleDriveService';
import { ChatMessage } from './ChatMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { SendIcon, PaperclipIcon, CloseIcon } from './Icons';

const EXAMPLE_PROMPTS = [
  "Give me the best intraday idea right now",
  "Show signals for SOL 60m",
  "How is the system health?",
  "What are the current trends?",
  "Show me long signals for ETH",
];

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { id: 'initial', role: 'model', content: "I am JaxSpot, your AI market agent. How can I help you analyze the crypto markets today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<DriveFile | null>(null);
  const [isDriveAuthenticated, setIsDriveAuthenticated] = useState(googleDriveService.isAuthenticated());
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const handleAuthChange = () => {
      setIsDriveAuthenticated(googleDriveService.isAuthenticated());
    };
    googleDriveService.subscribe(handleAuthChange);
    return () => googleDriveService.unsubscribe(handleAuthChange);
  }, []);

  const handleSend = async (prompt?: string) => {
    const userMessageContent = prompt || input;
    if (!userMessageContent.trim() || isLoading) return;
  
    setIsLoading(true);
    setInput('');
  
    let fullPrompt = userMessageContent;
    let fileContent = '';
  
    if (attachedFile) {
      try {
        fileContent = await googleDriveService.getFileContent(attachedFile.id);
        fullPrompt = `CONTEXT FROM FILE: ${attachedFile.name}\n\n---\n${fileContent}\n---\n\nUSER PROMPT: ${userMessageContent}`;
      } catch (error) {
        console.error("Error fetching file content:", error);
        const errorMessage: ChatMessageType = {
          id: Date.now().toString(),
          role: 'model',
          content: `Sorry, I couldn't read the file "${attachedFile.name}". Please check permissions and try again.`,
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        setAttachedFile(null);
        return;
      }
    }
  
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };
  
    setMessages(prev => [...prev, userMessage]);
    setAttachedFile(null); 
  
    try {
        const modelResponseString = await runChat(fullPrompt);
        let newModelMessage: ChatMessageType;

        try {
            const parsedResponse = JSON.parse(modelResponseString);
            const { type, payload } = parsedResponse;
            
            let content: string | Idea | Signal | Health;

            if (type === 'text') {
                content = payload.text || "Sorry, I received an empty response.";
            } else {
                // Add the type to the payload object itself for the renderer's type guard.
                content = { ...payload, type: type };
            }
            
            newModelMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: content,
            };

        } catch (e) {
            console.error("Failed to parse JSON response from AI:", modelResponseString, e);
            // Fallback for non-JSON or malformed JSON responses.
            newModelMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: modelResponseString.trim() || "Sorry, I encountered an issue with the response format.",
            };
        }
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

  const handleAttachFile = async () => {
    try {
      const file = await googleDriveService.showPicker();
      if (file) {
        setAttachedFile(file);
      }
    } catch (error) {
      console.error("Error showing picker:", error);
      // Optionally show an error message to the user
    }
  };

  const handleExamplePrompt = (prompt: string) => {
    setInput(prompt);
    handleSend(prompt);
  };

  return (
    <div className="w-full max-w-4xl h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700">
      <div ref={messagesContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
            <div className="flex justify-start items-center space-x-3">
                 <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 font-bold">J</div>
                 <div className="bg-gray-700 p-3 rounded-lg"><LoadingSpinner /></div>
            </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-700">
        <div className="flex flex-wrap gap-2 mb-3">
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
        {attachedFile && (
          <div className="mb-2 flex items-center justify-between bg-gray-700 p-2 rounded-md text-sm">
            <span className="text-gray-300 truncate">
              Attached: <span className="font-medium text-white">{attachedFile.name}</span>
            </span>
            <button onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-white">
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          {isDriveAuthenticated && (
            <button
              onClick={handleAttachFile}
              disabled={isLoading}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 transition-colors"
              aria-label="Attach file from Google Drive"
            >
              <PaperclipIcon />
            </button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex-grow flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask JaxSpot for an idea..."
              disabled={isLoading}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow"
              aria-label="Chat input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-colors"
              aria-label="Send message"
            >
              {isLoading ? <LoadingSpinner /> : <SendIcon />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
