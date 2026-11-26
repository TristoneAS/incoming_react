import "./globals.css";
import MuiAppThemeProvider from "./ui/MuiAppThemeProvider";

export const metadata = {
  title: "Incoming",
  description: "Sistema para control de material Incoming - Tristone",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <MuiAppThemeProvider>{children}</MuiAppThemeProvider>
      </body>
    </html>
  );
}
