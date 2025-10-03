import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { UserIcon, JaxIcon } from './Icons';

// A simple markdown-like parser to format the response
const formatContent = (content: string) => {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
        .replace(/(\r\n|\n|\r)/g, '<br />'); // Newlines
};

interface ChatMessageProps {
    message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === 'model';

  if (isModel) {
    const formattedContent = formatContent(message.content);
    return (
      <div className="flex items-start space-x-3 max-w-full">
        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 font-bold text-lg">
          <JaxIcon />
        </div>
        <div className="bg-gray-200 rounded-lg rounded-tl-none max-w-[85%] w-full">
          <div className="text-gray-800 leading-relaxed p-4" dangerouslySetInnerHTML={{ __html: formattedContent }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-end space-x-3 max-w-full">
      <div className="bg-blue-600 p-4 rounded-lg rounded-br-none max-w-[85%]">
        <p className="text-white leading-relaxed">{message.content}</p>
      </div>
       <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          <UserIcon />
        </div>
    </div>
  );
};