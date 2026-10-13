import './globals.css';
import { Providers } from '../store/Providers';
import { AppLayout } from '../components/AppLayout';
export const metadata = { title: 'Turia Agent Center', description: 'Agent configuration and execution center' };
export default function RootLayout({ children }) {
  return <html lang="en"><body><Providers><AppLayout>{children}</AppLayout></Providers></body></html>;
}
