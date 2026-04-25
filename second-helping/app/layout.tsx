import "./globals.css";

export const metadata = {
  title: "Second Helping — Programmatic CSR on Swiggy",
  description: "Automate your 2% CSR meal-sponsorship spend. Slack in, 80G receipt out.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
