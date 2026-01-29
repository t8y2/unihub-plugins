import React, { useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './App.css'

const App: React.FC = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)

  return (
    <div className="excalidraw-container">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={{
          elements: [],
          appState: {
            viewBackgroundColor: '#ffffff'
          }
        }}
        langCode="zh-CN"
      />
    </div>
  )
}

export default App