import React from 'react';
// FIX: Rename imported type to avoid conflict with component name.
import type { ChatMessage as ChatMessageType } from '../types';
import { UserIcon, JaxIcon } from './Icons';

// A simple markdown-like parser to format the response
const formatContent = (content: string) => {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
        .replace(/(\r\n|\n|\r)/g, '<br />'); // Newlines
};


// FIX: Use aliased type for the message prop.
export const ChatMessage: React.FC<{ message: ChatMessageType }> = ({ message }) => {
  const isModel = message.role === 'model';
  const formattedContent = formatContent(message.content);

  if (isModel) {
    return (
      <div className="flex items-start space-x-3 max-w-full">
        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 font-bold text-lg">
          <JaxIcon />
        </div>
        <div className="bg-gray-700 p-4 rounded-lg rounded-tl-none max-w-[85%]">
          <p className="text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedContent }}></p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-end space-x-3 max-w-full">
      <div className="bg-blue-600 p-4 rounded-lg rounded-br-none max-w-[85%]">
        <p className="text-white leading-relaxed">{message.content}</p>
      </div>
       <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
          <UserIcon />
        </div>
    </div>
  );
};