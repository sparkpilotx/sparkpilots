import React, { useMemo } from 'react'

const App = (): React.JSX.Element => {
  const currentWindow = useMemo(() => new URLSearchParams(window.location.search).get('win'), [])

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      Unknown window.
    </div>
  )
}

export default App
