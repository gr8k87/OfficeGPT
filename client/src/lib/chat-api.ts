import { apiRequest } from "./queryClient";
import type { InsertConversation, InsertMessage } from "@shared/schema";

export const chatApi = {
  // Conversations
  createConversation: async (conversation: InsertConversation) => {
    const response = await apiRequest("POST", "/api/conversations", conversation);
    return await response.json();
  },

  getConversations: async (userId: number) => {
    const response = await apiRequest("GET", `/api/conversations/${userId}`);
    return await response.json();
  },

  getConversation: async (id: number) => {
    const response = await apiRequest("GET", `/api/conversations/detail/${id}`);
    return await response.json();
  },

  deleteConversation: async (id: number) => {
    const response = await apiRequest("DELETE", `/api/conversations/${id}`);
    return await response.json();
  },

  updateConversationTitle: async (id: number, title: string) => {
    const response = await apiRequest("PATCH", `/api/conversations/${id}`, { title });
    return await response.json();
  },

  // Messages
  sendMessage: async (conversationId: number, content: string, model: string) => {
    const response = await apiRequest("POST", "/api/analyze-query", {
      conversationId,
      content,
      model,
    });
    return await response.json();
  },
};
