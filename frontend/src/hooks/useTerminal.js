import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export default function useTerminal({ onCommand, onResize }) {
  const termRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const readyRef = useRef(false)
  const onCommandRef = useRef(onCommand)
  const onResizeRef = useRef(onResize)
  const inputRef = useRef('')
  const cursorRef = useRef(0)
  const promptLineRef = useRef('\x1b[32m$ \x1b[0m')
  const promptRef = useRef(`\r\n${promptLineRef.current}`)

  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    if (!termRef.current) return
    readyRef.current = false

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      scrollback: 2000,
    })

    const fitAddon = new FitAddon()

    const safeFit = () => {
      if (!readyRef.current) return
      try {
        fitAddon.fit()
        onResizeRef.current?.(term.cols, term.rows)
      } catch {
        // Ignore fit races while the terminal DOM is mounting/unmounting.
      }
    }

    const safeWrite = (text) => {
      if (!readyRef.current || !xtermRef.current) return
      try {
        xtermRef.current.write(text)
      } catch {
        // Ignore writes after dispose to avoid runtime crashes.
      }
    }

    term.loadAddon(fitAddon)
    term.open(termRef.current)

    xtermRef.current = term
    fitAddonRef.current = fitAddon
    readyRef.current = true
    requestAnimationFrame(safeFit)

    const renderInput = () => {
      const termInstance = xtermRef.current
      if (!termInstance || !readyRef.current) return

      const input = inputRef.current
      const cursor = cursorRef.current
      safeWrite(`\r\x1b[2K${promptLineRef.current}${input}`)

      const moveLeft = input.length - cursor
      if (moveLeft > 0) {
        safeWrite(`\x1b[${moveLeft}D`)
      }
    }

    term.onKey(({ key, domEvent }) => {
      if (!readyRef.current) return
      const printable = key.length === 1 && !domEvent.ctrlKey && !domEvent.metaKey && !domEvent.altKey

      if ((domEvent.ctrlKey || domEvent.metaKey) && domEvent.key.toLowerCase() === 'a') {
        domEvent.preventDefault()
        cursorRef.current = 0
        renderInput()
        return
      }

      if ((domEvent.ctrlKey || domEvent.metaKey) && domEvent.key.toLowerCase() === 'e') {
        domEvent.preventDefault()
        cursorRef.current = inputRef.current.length
        renderInput()
        return
      }

      if (domEvent.key === 'Home') {
        domEvent.preventDefault()
        cursorRef.current = 0
        renderInput()
        return
      }

      if (domEvent.key === 'End') {
        domEvent.preventDefault()
        cursorRef.current = inputRef.current.length
        renderInput()
        return
      }

      if (domEvent.key === 'ArrowLeft') {
        domEvent.preventDefault()
        cursorRef.current = Math.max(0, cursorRef.current - 1)
        renderInput()
        return
      }

      if (domEvent.key === 'ArrowRight') {
        domEvent.preventDefault()
        cursorRef.current = Math.min(inputRef.current.length, cursorRef.current + 1)
        renderInput()
        return
      }

      if (domEvent.key === 'Enter') {
        domEvent.preventDefault()
        // Enter
        const cmd = inputRef.current.trim()
        safeWrite('\r\n')
        if (cmd) {
          onCommandRef.current?.(cmd)
        } else {
          safeWrite(promptRef.current)
        }
        inputRef.current = ''
        cursorRef.current = 0
      } else if (domEvent.key === 'Backspace') {
        domEvent.preventDefault()
        // Backspace
        if (cursorRef.current > 0) {
          inputRef.current = (
            inputRef.current.slice(0, cursorRef.current - 1) +
            inputRef.current.slice(cursorRef.current)
          )
          cursorRef.current -= 1
          renderInput()
        }
      } else if (domEvent.key === 'Delete') {
        domEvent.preventDefault()
        if (cursorRef.current < inputRef.current.length) {
          inputRef.current = (
            inputRef.current.slice(0, cursorRef.current) +
            inputRef.current.slice(cursorRef.current + 1)
          )
          renderInput()
        }
      } else if (domEvent.key.toLowerCase() === 'c' && domEvent.ctrlKey) {
        domEvent.preventDefault()
        // Ctrl+C
        inputRef.current = ''
        cursorRef.current = 0
        safeWrite('^C' + promptRef.current)
      } else if (printable) {
        domEvent.preventDefault()
        inputRef.current = (
          inputRef.current.slice(0, cursorRef.current) +
          key +
          inputRef.current.slice(cursorRef.current)
        )
        cursorRef.current += 1
        renderInput()
      }
    })

    const ro = new ResizeObserver(() => safeFit())
    ro.observe(termRef.current)

    return () => {
      readyRef.current = false
      ro.disconnect()
      term.dispose()
      fitAddonRef.current = null
      xtermRef.current = null
    }
  }, [])

  const write = useCallback((text) => {
    if (!readyRef.current || !xtermRef.current) return
    try {
      xtermRef.current.write(text)
    } catch {
      // Ignore writes after terminal disposal.
    }
  }, [])

  const writeln = useCallback((text) => {
    if (!readyRef.current || !xtermRef.current) return
    try {
      xtermRef.current.writeln(text)
    } catch {
      // Ignore writes after terminal disposal.
    }
  }, [])

  const showPrompt = useCallback(() => {
    cursorRef.current = 0
    inputRef.current = ''
    if (!readyRef.current || !xtermRef.current) return
    try {
      xtermRef.current.write(promptRef.current)
    } catch {
      // Ignore writes after terminal disposal.
    }
  }, [])

  const clear = useCallback(() => {
    if (!readyRef.current || !xtermRef.current) return
    try {
      xtermRef.current.clear()
    } catch {
      // Ignore calls during teardown.
    }
  }, [])

  return { termRef, write, writeln, showPrompt, clear }
}
