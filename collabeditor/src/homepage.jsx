import { useState, useRef, useEffect } from "react"
import Editor from "@monaco-editor/react"
import Navbar from "./navbar.jsx"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { MonacoBinding } from "y-monaco"
import "./navandhome.css"
import { useLocation } from "react-router-dom"

function randomColor() {
  const colors = ["#22d3ee", "#f472b6", "#34d399", "#fb923c", "#a78bfa", "#facc15"]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Map Monaco language names → Piston language names + versions
const PISTON_LANG_MAP = {
  javascript: { language: "javascript", version: "18.15.0" },
  python:     { language: "python",     version: "3.10.0"  },
  java:       { language: "java",       version: "15.0.2"  },
  cpp:        { language: "c++",        version: "10.2.0"  },
  typescript: { language: "typescript", version: "5.0.3"   },
}

const JUDGE0_LANG_MAP = {
  javascript: 63,
  python:     71,
  java:       62,
  cpp:        54,
  typescript: 74,
}

function Home() {
  const location = useLocation()
  const roomId = location.state?.roomId || "default-room"
  const languageFromRoute = location.state?.language || "javascript"

  const [lan, setlan]           = useState(languageFromRoute)
  const [output, setOutput]     = useState("")         // output panel text
  const [isRunning, setIsRunning] = useState(false)   // loading state
  const [showOutput, setShowOutput] = useState(false) // toggle output panel

  const ydocRef     = useRef(null)
  const providerRef = useRef(null)
  const ytextRef    = useRef(null)
  const editorRef   = useRef(null)
  const bindingRef  = useRef(null)

  useEffect(() => {
    const ydoc     = new Y.Doc()
    const ytext    = ydoc.getText("monaco")
    const provider = new WebsocketProvider(
      `${import.meta.env.VITE_WS_URL || "ws://localhost:1234"}/yjs`,
      roomId,
      ydoc
    )

    ydocRef.current     = ydoc
    ytextRef.current    = ytext
    providerRef.current = provider

    if (editorRef.current) {
      rebind(editorRef.current, ytext, provider)
    }

    return () => {
      bindingRef.current?.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [roomId])

  function rebind(editor, ytext, provider) {
    bindingRef.current?.destroy()
    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    )
    bindingRef.current = binding
    provider.awareness.setLocalStateField("user", {
      name: "User",
      color: randomColor(),
    })
  }

  const handleMount = (editor) => {
    editorRef.current = editor
    if (!ytextRef.current || !providerRef.current) return
    rebind(editor, ytextRef.current, providerRef.current)
  }

  // ── Run Code via Piston API ──────────────────────────────────────────────
  async function runCode() {
  if (!editorRef.current) return

  const code = editorRef.current.getValue()
  const languageId = JUDGE0_LANG_MAP[lan]

  if (!languageId) {
    setOutput(`Language "${lan}" is not supported yet.`)
    setShowOutput(true)
    return
  }

  setIsRunning(true)
  setShowOutput(true)
  setOutput("Running...")

  try {
    // Step 1: Submit
    const submitRes = await fetch(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=false",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
        }),
      }
    )

    const { token } = await submitRes.json()

    if (!token) {
      setOutput("Failed to get submission token. Judge0 may be rate limiting you.")
      return
    }

    // Step 2: Poll until done
    let result
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000)) // wait 1s each try

      const pollRes = await fetch(
        `https://ce.judge0.com/submissions/${token}?base64_encoded=false`
      )
      result = await pollRes.json()

      console.log("Judge0 poll:", result)

      if (result.status?.id >= 3) break // 3+ means finished
    }

    if (!result) {
      setOutput("Timed out waiting for result.")
      return
    }

    if (result.compile_output) setOutput("Compile Error:\n" + result.compile_output)
    else if (result.stdout)    setOutput(result.stdout)
    else if (result.stderr)    setOutput("Error:\n" + result.stderr)
    else                       setOutput("No output.")

  } catch (err) {
    setOutput("Network error:\n" + err.message)
  } finally {
    setIsRunning(false)
  }
}

  // ── Save File ────────────────────────────────────────────────────────────
  function saveFile(code, language) {
    const extMap = {
      javascript: 'js', python: 'py', java: 'java',
      cpp: 'cpp', typescript: 'ts',
    }
    const ext  = extMap[language] || 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `code.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={styles.appContainer}>
      <Navbar
        lan={lan}
        setlan={setlan}
        roomId={roomId}
        onSave={() => editorRef.current && saveFile(editorRef.current.getValue(), lan)}
        onRun={runCode}
        isRunning={isRunning}
      />

      {/* Editor + Output split */}
      <div style={styles.mainArea}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Editor
            key={lan}
            height="100%"
            language={lan}
            theme="vs-dark"
            onMount={handleMount}
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: "on",
              cursorBlinking: "phase",
              padding: { top: 20, bottom: 20 },
              lineHeight: 1.7,
              scrollBeyondLastLine: false,
              renderLineHighlight: "gutter",
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true },
              tabSize: 2,
            }}
          />
        </div>

        {/* Output Panel — slides in when showOutput is true */}
        {showOutput && (
          <div style={styles.outputPanel}>
            <div style={styles.outputHeader}>
              <span>Output</span>
              <button
                onClick={() => setShowOutput(false)}
                style={styles.closeBtn}
              >✕</button>
            </div>
            <pre style={styles.outputText}>
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  appContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    overflow: "hidden",
  },
  mainArea: {
    flex: 1,
    display: "flex",
    flexDirection: "row",       // editor left, output right
    overflow: "hidden",
    borderTop: "1px solid #21262d",
  },
  outputPanel: {
    width: "35%",
    backgroundColor: "#161b22",
    borderLeft: "1px solid #21262d",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  outputHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    borderBottom: "1px solid #21262d",
    fontSize: "13px",
    fontWeight: 600,
    color: "#8b949e",
    backgroundColor: "#0d1117",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: "14px",
  },
  outputText: {
    flex: 1,
    padding: "16px",
    margin: 0,
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
    color: "#e6edf3",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
}

export default Home