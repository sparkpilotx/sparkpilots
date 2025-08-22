import React from 'react'
import type { ThemeSource } from '@shared/appearance'
import { cn } from '@/lib/cn'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface WindowChromeProps {
  title: string
  subTitle?: string
  shortDescription?: string
  className?: string
}

export const WindowChrome = ({
  title,
  subTitle,
  shortDescription,
  className,
}: WindowChromeProps): React.JSX.Element => {
  const [themeSource, setThemeSource] = React.useState<ThemeSource>(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const fromUrl = (urlParams.get('themeSource') as ThemeSource | null) ?? 'system'
    return fromUrl
  })

  const onChangeThemeSource = async (next: ThemeSource): Promise<void> => {
    setThemeSource(next)
    try {
      await window.xAPI.appearance.setThemeSource(next)
    } catch {}
  }

  React.useEffect(() => {
    // Listen to broadcasted changes from main (all windows should sync instantly)
    const unsubscribe = window.xAPI.appearance.onChanged((snap) => {
      setThemeSource(snap.themeSource as ThemeSource)
      try {
        document.documentElement.classList.toggle('dark', snap.isDarkMode)
        document.documentElement.style.colorScheme = snap.isDarkMode ? 'dark' : 'light'
      } catch {}
    })
    return () => unsubscribe()
  }, [])

  return (
    <div
      className={cn(
        'app-region-drag flex items-center justify-between gap-2 border-b bg-background/70 pl-20 pr-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      {/* Left: Title */}
      <div className="text-sm font-medium text-foreground">{title}</div>

      {/* Center: SubTitle */}
      {subTitle && (
        <div className="flex-1 flex justify-center">
          <div className="text-xs text-muted-foreground">{subTitle}</div>
        </div>
      )}

      {/* Right: Controls */}
      <div className="app-region-no-drag flex items-center gap-2">
        {shortDescription && <div className="text-xs text-muted-foreground">{shortDescription}</div>}
        <Select value={themeSource} onValueChange={(v) => onChangeThemeSource(v as ThemeSource)}>
          <SelectTrigger aria-label="Theme" className="h-7 w-[120px]">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
