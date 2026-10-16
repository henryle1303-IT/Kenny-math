import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import { DemoApp } from './DemoApp';

createRoot(document.getElementById('root')!).render(<DemoApp />);
