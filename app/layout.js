import './globals.css';

export const metadata = {
  title: 'HH Goa 2026 — Frame & Builder ID',
  description:
    'Upload a photo, get your Hacker House Goa 2026 frame or builder ID card. Instant, no login. #FrameInGoa',
};

export const viewport = { themeColor: '#074C18' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Grotesk:wght@400;500;700&family=Yatra+One&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
