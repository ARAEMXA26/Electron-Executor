import '../src/input.css';

export const metadata = {
  title: 'Electron Executor',
  description: 'Premium Roblox script executor',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#070a0f] text-[#f8fafc] select-none h-screen w-screen overflow-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
