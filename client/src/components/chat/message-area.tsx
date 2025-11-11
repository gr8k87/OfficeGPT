import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import WelcomeScreen from "./welcome-screen";
import type { ConversationWithMessages } from "@shared/schema";

interface MessageAreaProps {
  conversation?: ConversationWithMessages;
  isLoading: boolean;
  onSuggestedPrompt: (prompt: string) => void;
}

export default function MessageArea({ conversation, isLoading, onSuggestedPrompt }: MessageAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages?.length]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      setShowScrollButton(!isAtBottom);
      console.log('Scroll detected:', { scrollTop, scrollHeight, clientHeight, isAtBottom });
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  if (!conversation || conversation.messages.length === 0) {
    return <WelcomeScreen onSuggestedPrompt={onSuggestedPrompt} />;
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto office-scrollbar"
      >
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          {conversation.messages.map((message, index) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} message-animation`}>
              <div className="max-w-3xl">
                {message.role === 'user' ? (
                  // User Message
                  <>
                    <div className="bg-[hsl(var(--office-accent))] text-white rounded-2xl rounded-br-md px-6 py-4">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                    <div className="flex items-center justify-end space-x-2 mt-2 text-xs text-[hsl(var(--office-text-secondary))]">
                      <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <svg className="w-3 h-3 text-[hsl(var(--office-accent))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </>
                ) : (
                  // AI Response
                  <>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-[hsl(var(--office-accent))] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="bg-[hsl(var(--office-sidebar))] border border-[hsl(var(--office-border))] rounded-2xl rounded-bl-md px-6 py-4 flex-1">
                        <div className="prose-office">
                          {message.content.split('\n').map((paragraph, pIndex) => {
                            if (paragraph.trim() === '') return <br key={pIndex} />;
                            
                            // Handle headers
                            if (paragraph.startsWith('### ')) {
                              return <h3 key={pIndex} className="text-lg font-semibold mt-4 mb-2">{paragraph.replace('### ', '')}</h3>;
                            }
                            if (paragraph.startsWith('## ')) {
                              return <h2 key={pIndex} className="text-xl font-semibold mt-4 mb-2">{paragraph.replace('## ', '')}</h2>;
                            }
                            if (paragraph.startsWith('# ')) {
                              return <h1 key={pIndex} className="text-2xl font-bold mt-4 mb-2">{paragraph.replace('# ', '')}</h1>;
                            }
                            
                            // Handle lists
                            if (paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ')) {
                              return <li key={pIndex} className="ml-4">{paragraph.replace(/^[-*]\s/, '')}</li>;
                            }
                            
                            // Regular paragraphs
                            return <p key={pIndex} className="mb-2 leading-relaxed">{paragraph}</p>;
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-start space-x-2 mt-2 ml-11 text-xs text-[hsl(var(--office-text-secondary))]">
                      <span>{message.model}</span>
                      <span className="w-1 h-1 bg-[hsl(var(--office-text-secondary))] rounded-full"></span>
                      <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(message.content)}
                        className="hover:text-[hsl(var(--office-text))] transition-colors ml-2"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Floating scroll to bottom button */}
      {showScrollButton && (
        <Button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 w-12 h-12 rounded-full bg-[hsl(var(--office-accent))] hover:bg-[hsl(var(--office-accent))]/90 text-white shadow-lg z-10 p-0"
        >
          <ArrowDown className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
