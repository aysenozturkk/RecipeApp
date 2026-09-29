import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Tarif Defterim · RecipeAgent', description: 'Tariflerini, notlarını ve fotoğraflarını bir arada sakla.',
  manifest: '/manifest.webmanifest', icons: { icon: '/icon.svg' }, appleWebApp: { capable: true, title: 'Tarif Defterim', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#243c32' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="tr"><body>{children}</body></html>; }
