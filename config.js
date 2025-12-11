// MindMate Configuration
const CONFIG = {
    // Supabase Configuration
    supabase: {
        url: 'https://adogryrmvkntafwfojdl.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkb2dyeXJtdmtudGFmd2ZvamRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTI1MzUsImV4cCI6MjA4MDk2ODUzNX0.iVK_OD-tjHGdllf69u1nywraEM7rlZ8J1rwMu-E4imc'
    },

    // Perplexity API Configuration
    perplexity: {
        apiKey: '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',
        endpoint: 'https://api.perplexity.ai/chat/completions',
        model: 'sonar-small-online'
    },

    // Application Settings
    app: {
        name: 'MindMate',
        crisisThreshold: 0.7
    }
};