import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  onSuggestedPrompt: (prompt: string) => void;
}

export default function WelcomeScreen({ onSuggestedPrompt }: WelcomeScreenProps) {
  // Get the message input element and trigger it with the suggested prompt
  const handleSuggestedPrompt = (prompt: string) => {
    // Find the textarea and set its value
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = prompt;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
      
      // Trigger change event
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);
      
      // Focus the textarea
      textarea.focus();
    }
  };
  const suggestedPrompts = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      title: "Code Review",
      description: "Help me review this code for best practices",
      prompt: "Help me review this code for best practices and potential improvements"
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      ),
      title: "Database Help",
      description: "Optimize my SQL queries and schema",
      prompt: "How can I optimize my database performance and improve my SQL queries?"
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      title: "Problem Solving",
      description: "Help me brainstorm solutions",
      prompt: "I need help brainstorming creative solutions for a technical problem"
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Documentation",
      description: "Create technical documentation",
      prompt: "Help me create clear and comprehensive technical documentation"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <div className="text-center max-w-2xl">
        <div className="w-16 h-16 bg-[hsl(var(--office-accent))] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-[hsl(var(--office-text))] mb-4">Welcome to OfficeGPT</h1>
        <p className="text-[hsl(var(--office-text-secondary))] text-lg mb-8">
          Your workplace-friendly AI assistant. Ask me anything about coding, productivity, or general questions.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
          {suggestedPrompts.map((prompt, index) => (
            <Button
              key={index}
              onClick={() => handleSuggestedPrompt(prompt.prompt)}
              variant="outline"
              className="p-4 h-auto bg-[hsl(var(--office-sidebar))] border-[hsl(var(--office-border))] hover:border-[hsl(var(--office-accent))] transition-colors text-left justify-start"
            >
              <div className="flex items-start space-x-3">
                <div className="text-[hsl(var(--office-accent))] mt-1">
                  {prompt.icon}
                </div>
                <div className="text-left">
                  <div className="font-medium text-[hsl(var(--office-text))] mb-1">{prompt.title}</div>
                  <div className="text-sm text-[hsl(var(--office-text-secondary))]">{prompt.description}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
