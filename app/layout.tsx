import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CV Studio | Your next chapter', icons: { icon: '/favicon.svg' }, description: 'Create tailored English and German tabular CVs, with your photo and downloadable PDFs.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
