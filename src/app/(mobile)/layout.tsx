export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {children}
    </main>
  );
}
