import './globals.css';
import { Providers } from '../store/Providers';
export const metadata = { title: 'Turia Agent Center', description: 'Agent configuration and execution center' };
export default function RootLayout({ children }) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
