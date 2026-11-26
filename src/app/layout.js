import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";
import MuiAppThemeProvider from "./ui/MuiAppThemeProvider";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Incoming",
  description: "Sistema para control de material Incoming - Tristone",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body
        className={`${roboto.variable} ${geistMono.variable} ${roboto.className}`}
      >
        <MuiAppThemeProvider>{children}</MuiAppThemeProvider>
      </body>
    </html>
  );
}
