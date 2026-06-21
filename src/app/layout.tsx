import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import NavLinks from './components/NavLinks';

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NourishVault - Recipe Parser & Manager',
  description: 'Instantly scrape recipes from any URL, edit ingredients and instructions, and store them locally in clean Markdown.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfairDisplay.variable} ${plusJakartaSans.variable}`}>
      <body>
        <div className="app-container">
          <header className="header">
            <div className="header-content">
              <Link href="/" className="logo">
                Nourish<span>Vault</span>
              </Link>
              <NavLinks />
            </div>
          </header>
          <main className="main-content">
            {children}
          </main>
          <footer className="footer">
            <p>&copy; {new Date().getFullYear()} NourishVault. Elevating your cooking experience.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
