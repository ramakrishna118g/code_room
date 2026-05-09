import logo from "./assets/logo.png";
import './navandhome.css'

function Navbar({ lan, setlan, roomId, onSave, onRun, isRunning }) {
  return (
    <div className="navbar">

      {/* LEFT */}
      <div className="nav-left">
        <img src={logo} className="logo" />
        <h2 className="brand">CodeRoom</h2>

        <select
          className="language-select"
          value={lan}
          onChange={(e) => setlan(e.target.value)}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="typescript">TypeScript</option>
        </select>
      </div>

      {/* CENTER */}
      <div className="nav-center">
        <span className="room-id">Room: {roomId}</span>
      </div>

      {/* RIGHT */}
      <div className="nav-right">
        <button className="btn people">People&#128100;</button>
        <button className="btn ai">AI Review</button>
        <button className="btn run" onClick={onRun} disabled={isRunning}>
          {isRunning ? "Running..." : "Run ▶"}
        </button>
        <button className="btn store" onClick={onSave}>Save</button>
      </div>

    </div>
  );
}

export default Navbar;