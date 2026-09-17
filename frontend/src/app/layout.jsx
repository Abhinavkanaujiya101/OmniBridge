import './globals.css';

export const metadata = {
  title: 'OmniBridge — Intelligent AI Orchestration & API Gateway',
  description: 'Multi-provider AI API Gateway and real-time streaming platform for Google Gemini, OpenAI, Together AI, and Luma Dream Machine.',
  keywords: ['AI Gateway', 'LLM Orchestration', 'Gemini', 'OpenAI', 'Together AI', 'Luma AI', 'Dream Machine', 'WebSockets'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' }
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
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
