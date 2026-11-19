import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@fontsource-variable/geist'
import '@fontsource-variable/manrope'
import '@fontsource/space-mono/latin-400.css'
import './style.css'

createRoot(document.getElementById('root')!).render(<App/>)
