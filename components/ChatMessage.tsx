import React from 'react';
import type { ChatMessage as ChatMessageType, Idea, Signal, Health } from '../types';
import { UserIcon, JaxIcon } from './Icons';
import { IdeaCard } from './IdeaCard';
import { SignalCard } from './SignalCard';
import { HealthCard } from './HealthCard';

// A simple markdown-like parser to format the response
const formatContent = (content: string) => {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
        .replace(/(\r\n|\n|\r)/g, '<br />'); // Newlines
};

interface ChatMessageProps {
    message: ChatMessageType;
    onViewChartForIdea?: (idea: Idea) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onViewChartForIdea }) => {
  const isModel = message.role === 'model';

  if (isModel) {
    let contentToRender;

    if (typeof message.content === 'string') {
        const formattedContent = formatContent(message.content);
        contentToRender = <p className="text-gray-200 leading-relaxed p-4" dangerouslySetInnerHTML={{ __html: formattedContent }}></p>;
    } else if (message.content.type === 'idea') {
        contentToRender = <IdeaCard idea={message.content as Idea} onViewChart={onViewChartForIdea} />;
    } else if (message.content.type === 'signal') {
        contentToRender = <SignalCard signal={message.content as Signal} />;
    } else if (message.content.type === 'health') {
        contentToRender = <HealthCard health={message.content as Health} />;
    } else {
        const formattedContent = formatContent("Unsupported content type.");
        contentToRender = <p className="text-gray-200 leading-relaxed p-4" dangerouslySetInnerHTML={{ __html: formattedContent }}></p>;
    }

    return (
      <div className="flex items-start space-x-3 max-w-full">
        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 font-bold text-lg">
          <JaxIcon />
        </div>
        <div className="bg-gray-700 rounded-lg rounded-tl-none max-w-[85%] w-full">
          {contentToRender}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-end space-x-3 max-w-full">
      <div className="bg-blue-600 p-4 rounded-lg rounded-br-none max-w-[85%]">
        <p className="text-white leading-relaxed">{message.content as string}</p>
      </div>
       <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
          <UserIcon />
        </div>
    </div>
  );
};