import { useState, useEffect } from "react";
import { useParams } from "wouter";
import Sidebar from "@/components/chat/sidebar";
import MessageArea from "@/components/chat/message-area";
import MessageInput from "@/components/chat/message-input";
import { useQuery } from "@tanstack/react-query";
import type { ConversationWithMessages } from "@shared/schema";

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(
    conversationId ? parseInt(conversationId) : null
  );
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Query for current conversation
  const { data: conversation, isLoading } = useQuery<ConversationWithMessages>({
    queryKey: ['/api/conversations/detail', currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return null;
      const response = await fetch(`/api/conversations/detail/${currentConversationId}`);
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    },
    enabled: !!currentConversationId,
  });

  // Update URL when conversation changes
  useEffect(() => {
    if (currentConversationId && conversationId !== currentConversationId.toString()) {
      window.history.replaceState(null, '', `/chat/${currentConversationId}`);
    }
  }, [currentConversationId, conversationId]);

  return (
    <div className="flex h-screen bg-[hsl(var(--office-dark))] text-[hsl(var(--office-text))]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden lg:w-80`}>
        <Sidebar
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          currentConversationId={currentConversationId}
          onConversationSelect={setCurrentConversationId}
          onNewChat={() => setCurrentConversationId(null)}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-[hsl(var(--office-sidebar))] border-b border-[hsl(var(--office-border))] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-[hsl(var(--office-text-secondary))] hover:text-[hsl(var(--office-text))] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-semibold text-[hsl(var(--office-text))]">
                {conversation?.title || "New Chat"}
              </h2>
              <div className="flex items-center space-x-2 text-sm text-[hsl(var(--office-text-secondary))]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{selectedModel === "gpt-4" ? "GPT-4" : selectedModel === "gpt-3.5-turbo" ? "GPT-3.5" : "Gemini Pro"}</span>
                <span className="w-1 h-1 bg-[hsl(var(--office-text-secondary))] rounded-full"></span>
                <span>{conversation?.messages?.length || 0} messages</span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <MessageArea 
          conversation={conversation} 
          isLoading={isLoading}
          onSuggestedPrompt={(prompt) => {
            const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
            if (textarea) {
              textarea.value = prompt;
              const event = new Event('input', { bubbles: true });
              textarea.dispatchEvent(event);
              textarea.focus();
            }
          }}
        />

        {/* Message Input */}
        <MessageInput
          conversationId={currentConversationId}
          selectedModel={selectedModel}
          onConversationCreated={setCurrentConversationId}
        />
      </div>
    </div>
  );
}
