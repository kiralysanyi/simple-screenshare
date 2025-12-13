import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router'
import App from './App'
import Stream from './Stream'
import View from './View'

document.title = "Simple Screenshare"

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path='/' element={<App />} />
      <Route path='/stream/:id' element={<Stream />} />
      <Route path='/view/:id' element={<View />} />
    </Routes>
  </BrowserRouter>
)
