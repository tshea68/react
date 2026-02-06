import "./globals.css";

export const metadata = {
  title: "Appliance Part Geeks (web-next)",
  description: "Next.js routes for parts/refurb pages",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
