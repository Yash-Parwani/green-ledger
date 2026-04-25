import "./globals.css";

export const metadata = {
  title: "The Group Concierge — Swiggy Builders Club",
  description: "One brief. One agent. Your entire event planned across Swiggy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
