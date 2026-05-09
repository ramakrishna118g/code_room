import { useState } from "react";
import Sidebar from "./homenavbar.jsx";
import "./ohome.css";
import { useNavigate } from "react-router-dom";
import { getSocket } from './socket.js';

function Ohome() {
  const socket=getSocket();
  const [isVisible, setIsVisible] = useState(true);
  const [iscreate,setiscreate]=useState(false);
  const [isjoin,setisjoin]=useState(false);
  const [languagetype,setlanguagetype]=useState("javascript");
  const [conferencetype,setconferencetype]=useState("editor");
  const [pass,setpass]=useState("12345678");
  const [enpass,setenpass]=useState("12345678@")
  const [enroomid,setenroomid]= useState("");

  const navigate = useNavigate();


  function createroom(){
    setIsVisible(false);
    setisjoin(false);
    setiscreate(true);
  }
  

  function joinroom(){
    setiscreate(false);
    setIsVisible(false);
    setisjoin(true);
  }


  function tomain(){
    setisjoin(false);
    setiscreate(false);
    setIsVisible(true);
  }



  function createroomapifunc(){

    socket.emit("create-room",{
      password:pass,
      type:conferencetype
    });

    // listen for room id
    socket.once("room-created",(roomId)=>{

      console.log("room created:",roomId);

      navigate("/room",{
        state:{
          roomId:roomId,
          language:languagetype,
          conference:conferencetype
        }
      });

    });

  }
  function tojoin(){

  socket.emit("join-room",{
    roomId: enroomid,   // fixed name
    pass: enpass
  });

  socket.once("joined-success",(roomId)=>{

    navigate("/room",{
      state:{
        roomId: roomId,
        language: languagetype,
        conference: conferencetype
      }
    });

  });

  socket.once("error",(msg)=>{
    alert(msg);
  });

}


  return (
    <div id="layout">

      <Sidebar />

      {isVisible && (

        <main id="content">

          <h1>Welcome to Collabin</h1>

          <button onClick={createroom}>
            + Create a Collab Room
          </button>

          <p>or</p>

          <button onClick={joinroom}>
            Join a Room
          </button>

        </main>

      )}



      {iscreate && (

        <div id="createeditordiv">

          <h1>Create Editor Room</h1>

          <h3>Select language:</h3>

          <select
            value={languagetype}
            onChange={(e)=>setlanguagetype(e.target.value)}
          >
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>


          <h3>Conference type:</h3>

          <select
            value={conferencetype}
            onChange={(e)=>setconferencetype(e.target.value)}
          >
            <option value="editor">Only Editor</option>
            <option value="audio">Editor + Audio</option>
            <option value="video">Editor + Video</option>
          </select>
          <label>Set Password:</label>
          <input placeholder="Set Password for Room" onChange={(e)=>setpass(e.target.value)}></input>
          <button onClick={createroomapifunc}>
            Create Room
          </button>

          <button onClick={tomain}>
            Back
          </button>

        </div>

      )}



      {isjoin && (

        <div id="joineditorroom">

          <div className="popup-box">

            <h1>Join Room</h1>
            <label>Enter RoomID</label>
            <input placeholder="Enter Room Id" onChange={(e)=> setenroomid(e.target.value)}/>
            <label>Enter Room Password</label>
            <input type="password" placeholder="Room password"  onChange={(e)=>setenpass(e.target.value)}/>
            <button onClick={tojoin}>Join</button>
            <button onClick={tomain}>
              Back
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default Ohome;