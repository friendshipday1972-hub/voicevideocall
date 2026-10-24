import type { Metadata } from 'next';
import { Inter, Noto_Sans_Telugu, Space_Grotesk } from 'next/font/google';

import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const grotesk = Space_Grotesk({ variable: '--font-grotesk', subsets: ['latin'], weight: ['500', '600', '700'] });
// Telugu glyphs aren't in Inter/Space Grotesk; the browser falls back to this for them.
const telugu = Noto_Sans_Telugu({ variable: '--font-telugu', subsets: ['telugu'], weight: ['400', '500', '600', '700'], preload: false });

export const metadata: Metadata = {
  title: { default: 'Baatein Admin', template: '%s · Baatein Admin' },
  description: 'Operations, safety and analytics for the Baatein calling app.',
  robots: { index: false, follow: false },
};

/** Applies the saved theme and language before paint so there's no light/dark flash and the right script loads. */
const themeScript = `try{var t=localStorage.getItem('admin-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;var l=JSON.parse(localStorage.getItem('admin-lang')||'{}').state;if(l&&l.lang)document.documentElement.lang=l.lang}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${telugu.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
