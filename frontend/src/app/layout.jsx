import './globals.css';

export const metadata = {
  title: 'OmniBridge — Intelligent AI Orchestration & API Gateway',
  description: 'Multi-provider AI API Gateway and real-time streaming platform for Google Gemini, OpenAI, Together AI, and Luma Dream Machine.',
  keywords: ['AI Gateway', 'LLM Orchestration', 'Gemini', 'OpenAI', 'Together AI', 'Luma AI', 'Dream Machine', 'WebSockets'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080B11] text-gray-100 antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
