import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, RouterProvider } from 'react-router'
import App from './App'
import Stream from './Stream'
import View from './View'
import redirectMiddleware from './middlewares/redirectMiddleware'
import StreamSelector from './StreamSelector'

document.title = "Simple Screenshare"

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />
  },
  {
    path: "/stream/:id",
    element: <Stream />
  },
  {
    path: "/view/:id",
    element: <View />
  },
  {
    path: "/selector",
    element: <StreamSelector />
  },
  {
    path: "*",
    middleware: [redirectMiddleware]
  }
])


createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
)
