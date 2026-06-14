import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Hydra Baseball Co. — Built for Competition',
  description:
    'Hydra Baseball Co. crafts competition-grade baseballs — full grain leather, cork and rubber cores, built for every pitch, every inning, every game.',
  icons: {
    icon:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='18' fill='%2315151a'/><text x='50' y='74' font-family='Arial' font-size='72' font-weight='800' font-style='italic' fill='white' text-anchor='middle'>H</text></svg>",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Saira+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,600;1,700;1,800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
