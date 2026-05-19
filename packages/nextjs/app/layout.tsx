import "@scaffold-hbar-ui/components/styles.css";
import "~~/styles/globals.css";
import { ReactNode } from "react";
import { ScaffoldHbarAppWithProviders } from "~~/components/ScaffoldHbarAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";

export const metadata = {
  title: "Template Hedera LZ App",
  description: "UI for Chapter 1 and Chapter 3 flows",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ScaffoldHbarAppWithProviders>{children}</ScaffoldHbarAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
