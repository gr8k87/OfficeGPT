import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface AnalysisRequest {
  query: string;
  model: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  context?: string;
}

export interface AnalysisResult {
  response: string;
  model: string;
  tokensUsed?: number;
}

export const aiService = {
  async analyzeQuery(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      const { query, model, conversationHistory = [], context } = request;
      
      // Build messages array with conversation history
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
          role: "system",
          content: "You are a helpful AI assistant. Give direct, natural responses without formal business language, headers, or structured analysis. Keep your answers conversational and friendly, like you're chatting with someone. Don't use business document formatting."
        }
      ];

      // Add conversation history if provided
      if (conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role as "user" | "assistant",
            content: msg.content
          });
        });
      }

      // Add current user query directly
      messages.push({
        role: "user",
        content: query
      });

      if (model.toLowerCase().includes('gemini')) {
        // Gemini API integration using fetch (TaxBuddy pattern)
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
        
        if (!GEMINI_API_KEY) {
          throw new Error("Gemini API key not configured");
        }

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: query }],
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
          }),
        });

        if (!geminiResponse.ok) {
          throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
        }

        const geminiData = await geminiResponse.json();
        const response = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";

        return {
          response,
          model: model,
          tokensUsed: undefined // Gemini doesn't provide token usage in the same format
        };
      } else {
        // OpenAI models
        const response = await openai.chat.completions.create({
          model: model === "gpt-4" ? "gpt-4o" : model,
          messages: messages,
          max_tokens: 2000,
          temperature: 0.7
        });

        return {
          response: response.choices[0].message.content || "No response generated",
          model: model,
          tokensUsed: response.usage?.total_tokens
        };
      }
    } catch (error) {
      console.error("AI Service error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("API key")) {
          throw new Error("Invalid API key. Please check your OpenAI API key configuration.");
        } else if (error.message.includes("rate limit")) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        } else if (error.message.includes("model")) {
          throw new Error("Invalid model specified. Please select a valid model.");
        } else {
          throw new Error(`AI service error: ${error.message}`);
        }
      } else {
        throw new Error("An unexpected error occurred during analysis.");
      }
    }
  }
};