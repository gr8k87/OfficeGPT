import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { aiService } from "./ai-service";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create new conversation
  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get all conversations for a user
  app.get("/api/conversations/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get specific conversation with messages
  app.get("/api/conversations/detail/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update conversation title
  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title } = req.body;
      await storage.updateConversationTitle(id, title);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Business analysis endpoint (TaxBuddy-style pattern)
  app.post("/api/analyze-query", async (req, res) => {
    try {
      const { conversationId, content, model } = req.body;

      if (!conversationId || !content || !model) {
        return res.status(400).json({ message: "Missing required fields: conversationId, content, model" });
      }

      const convId = parseInt(conversationId);

      // Save user message
      const userMessage = await storage.createMessage({
        conversationId: convId,
        role: "user",
        content,
      });

      // Get conversation context
      const conversation = await storage.getConversation(convId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Prepare conversation history for AI analysis (last 10 messages for context)
      const conversationHistory = conversation.messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use AI service for structured business analysis
      const analysisResult = await aiService.analyzeQuery({
        query: content,
        model,
        conversationHistory,
        context: "Professional business consultation"
      });

      // Save AI response
      const assistantMessage = await storage.createMessage({
        conversationId: convId,
        role: "assistant",
        content: analysisResult.response,
      });

      // Update conversation title if it's the first exchange
      if (conversation.messages.length === 1) {
        const title = content.length > 50 ? content.substring(0, 50) + "..." : content;
        await storage.updateConversationTitle(convId, title);
      }

      res.json({
        userMessage,
        assistantMessage,
        tokensUsed: analysisResult.tokensUsed
      });

    } catch (error: any) {
      console.error("Query analysis error:", error);
      
      if (error.message.includes("API key")) {
        res.status(500).json({ message: "AI service configuration error. Please check API keys." });
      } else if (error.message.includes("rate limit")) {
        res.status(429).json({ message: "Service rate limit exceeded. Please try again in a moment." });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
