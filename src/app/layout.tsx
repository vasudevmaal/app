import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {currentUser} from '@/lib/auth';
import {getSettings} from '@/lib/data';
import {Providers} from '@/components/providers';
import {SiteChrome} from '@/components/site-chrome';
import './globals.css';
import './refinements.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:{default:'EXCPIX - Creative Text & Design',template:'%s | EXCPIX'},description:'Explore 3D text, expressive AI design and creative design. Customize your favorite styles.',metadataBase:new URL(process.env.APP_URL||'http://localhost:3000'),icons:{icon:'/icon.svg'},manifest:'/manifest.webmanifest'};
export default async function RootLayout({children}:{children:ReactNode}) {
  const [user, settings] = await Promise.all([currentUser(), getSettings()]);

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('excpix-theme')||'system';var d=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d;}catch(e){}",
          }}
        />
        <link rel="stylesheet" href="/editor/fonts.css" />
      </head>
      <body>
        <Providers user={user} settings={settings}>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteChrome position="header" />
          <div id="main">
            {settings.maintenance && user?.role !== 'owner' ? (
              <main className="empty">
                <h1>We will be back soon.</h1>
                <p>EXCPIX is undergoing scheduled maintenance.</p>
              </main>
            ) : (
              children
            )}
          </div>
          <SiteChrome position="footer" />
        </Providers>
      </body>
    </html>
  );
}
