import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const grotesk = Space_Grotesk({ variable: '--font-grotesk', subsets: ['latin'], weight: ['500', '600', '700'] });

export const metadata: Metadata = {
  title: { default: 'Baatein Admin', template: '%s · Baatein Admin' },
  description: 'Operations, safety and analytics for the Baatein calling app.',
  robots: { index: false, follow: false },
};

/** Applies the saved theme before paint so there's no light/dark flash. */
const themeScript = `try{var t=localStorage.getItem('admin-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
