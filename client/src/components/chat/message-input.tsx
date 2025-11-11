import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { chatApi } from "@/lib/chat-api";
import { Loader2, Send } from "lucide-react";

interface MessageInputProps {
  conversationId: number | null;
  selectedModel: string;
  onConversationCreated: (id: number) => void;
}

export default function MessageInput({ conversationId, selectedModel, onConversationCreated }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock user ID - in a real app this would come from authentication
  const userId = 1;

  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      return await chatApi.createConversation({
        userId,
        title,
      });
    },
    onSuccess: (data) => {
      onConversationCreated(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content, model }: { conversationId: number; content: string; model: string }) => {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/analyze-query", {
        conversationId,
        content,
        model,
      });
      return await response.json();
    },
    onSuccess: () => {
      setMessage("");
      setIsLoading(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      // Invalidate conversations and current conversation
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/conversations/detail', conversationId] });
      }
    },
    onError: (error: any) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    try {
      let currentConversationId = conversationId;

      // Create new conversation if none exists
      if (!currentConversationId) {
        const title = message.length > 50 ? message.substring(0, 50) + "..." : message;
        const newConversation = await createConversation.mutateAsync(title);
        currentConversationId = newConversation.id;
      }

      // Send message
      await sendMessage.mutateAsync({
        conversationId: currentConversationId,
        content: message,
        model: selectedModel,
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  return (
    <div className="bg-[hsl(var(--office-sidebar))] border-t border-[hsl(var(--office-border))] p-6">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyPress}
              placeholder="Type your message here..."
              className="min-h-[60px] max-h-[200px] resize-none bg-[hsl(var(--office-dark))] border-[hsl(var(--office-border))] text-[hsl(var(--office-text))] placeholder:text-[hsl(var(--office-text-secondary))] focus:border-[hsl(var(--office-accent))] pr-12"
              disabled={isLoading}
            />
            <div className="absolute bottom-3 right-3">
              <Button
                type="submit"
                size="sm"
                disabled={!message.trim() || isLoading}
                className="bg-[hsl(var(--office-accent))] hover:bg-[hsl(var(--office-accent))]/90 text-white rounded-lg px-3 py-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[hsl(var(--office-text-secondary))]">
            <div className="flex items-center space-x-4">
              <span>Press <kbd className="px-1 py-0.5 bg-[hsl(var(--office-sidebar))] border border-[hsl(var(--office-border))] rounded">⏎</kbd> to send, <kbd className="px-1 py-0.5 bg-[hsl(var(--office-sidebar))] border border-[hsl(var(--office-border))] rounded">Shift ⏎</kbd> for new line</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>{message.length}</span>
              <span>/</span>
              <span>4000</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}