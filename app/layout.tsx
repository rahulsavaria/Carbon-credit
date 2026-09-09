import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carbon Credit · Claude Code energy",
  description:
    "Estimated electricity and carbon of local Claude Code usage, per day and per week. Every figure is a band, not a measurement.",
};

/**
 * Runs before first paint so an explicit theme choice does not flash the
 * wrong palette. Wrapped in try/catch because localStorage throws outright in
 * some contexts rather than returning null.
 */
const THEME_BOOTSTRAP = `(function(){try{
var p=new URL(window.location.href).searchParams.get("theme");
var s=window.localStorage.getItem("cc-theme");
var m=p||s;if(m==="light"||m==="dark"){document.documentElement.setAttribute("data-theme",m);}
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
