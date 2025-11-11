import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, MessageSquare, Plus, Settings } from "lucide-react";
import type { Conversation } from "@shared/schema";

interface SidebarProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  currentConversationId: number | null;
  onConversationSelect: (id: number) => void;
  onNewChat: () => void;
  onToggle: () => void;
}

export default function Sidebar({
  selectedModel,
  onModelChange,
  currentConversationId,
  onConversationSelect,
  onNewChat,
  onToggle,
}: SidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Mock user ID - in a real app this would come from authentication
  const userId = 1;

  // Query conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations', userId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
  });

  // Delete conversation mutation
  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      if (currentConversationId === deletedId) {
        onNewChat();
      }
      setDeleteConfirm(null);
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      deleteConversation.mutate(id);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000); // Auto-cancel after 3 seconds
    }
  };

  return (
    <div className="bg-[hsl(var(--office-sidebar))] border-r border-[hsl(var(--office-border))] h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[hsl(var(--office-border))]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[hsl(var(--office-text))]">OfficeGPT</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-[hsl(var(--office-text-secondary))] hover:text-[hsl(var(--office-text))] lg:hidden"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <Button
          onClick={onNewChat}
          className="w-full bg-[hsl(var(--office-accent))] hover:bg-[hsl(var(--office-accent))]/90 text-white rounded-lg px-4 py-2.5 font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Model Selector */}
      <div className="p-4 border-b border-[hsl(var(--office-border))]">
        <label className="block text-sm font-medium text-[hsl(var(--office-text-secondary))] mb-2">AI Model</label>
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger className="w-full bg-[hsl(var(--office-dark))] border-[hsl(var(--office-border))] text-[hsl(var(--office-text))]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--office-sidebar))] border-[hsl(var(--office-border))]">
            <SelectItem value="gpt-4" className="text-[hsl(var(--office-text))] focus:bg-[hsl(var(--office-dark))]">GPT-4 (Most Capable)</SelectItem>
            <SelectItem value="gpt-3.5-turbo" className="text-[hsl(var(--office-text))] focus:bg-[hsl(var(--office-dark))]">GPT-3.5 Turbo (Faster)</SelectItem>
            <SelectItem value="gemini-pro" className="text-[hsl(var(--office-text))] focus:bg-[hsl(var(--office-dark))]">Gemini Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2">
            <h3 className="text-sm font-medium text-[hsl(var(--office-text-secondary))] px-2 py-2">Recent Conversations</h3>
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                    currentConversationId === conversation.id
                      ? 'bg-[hsl(var(--office-accent))] text-white'
                      : 'hover:bg-[hsl(var(--office-dark))] text-[hsl(var(--office-text))]'
                  }`}
                  onClick={() => onConversationSelect(conversation.id)}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conversation.title || "New Chat"}
                      </p>
                      <p className="text-xs opacity-70 truncate">
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteClick(conversation.id, e)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto ${
                      deleteConfirm === conversation.id
                        ? 'text-red-400 hover:text-red-300'
                        : 'text-[hsl(var(--office-text-secondary))] hover:text-[hsl(var(--office-text))]'
                    }`}
                  >
                    {deleteConfirm === conversation.id ? (
                      <span className="text-xs px-2">Click to confirm</span>
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              ))}

              {conversations.length === 0 && (
                <div className="text-center py-8 text-[hsl(var(--office-text-secondary))]">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs opacity-70">Start a new chat to begin</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[hsl(var(--office-border))]">
        <div className="text-xs text-[hsl(var(--office-text-secondary))]">
          <p>OfficeGPT Assistant</p>
          <p className="opacity-70">AI-powered business consultation</p>
        </div>
      </div>
    </div>
  );
}