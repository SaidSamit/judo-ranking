import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Judo Tournament Platform | Mesa de Control & Ranking',
  description: 'Plataforma B2B Serverless para gestión de torneos de Judo y ranking federado',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
