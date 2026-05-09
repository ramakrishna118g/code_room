import './homenavbar.css'
import { useNavigate } from 'react-router-dom';
function Sidebar(){
  const navigate= useNavigate();
  function goFiles(){
    console.log("Open Files");
  }

  function goHistory(){
    
  }

  function logout(){
    localStorage.clear();
    navigate("/login");
  }

  return(

    <nav id="sidebar">

      <h2 className="logo">Collabin</h2>

      <div className="nav-links">

        <button onClick={()=> navigate("/home")}>
          Collab Editor
        </button>

        <button onClick={()=> navigate("/conference")}>
          Conference
        </button>

        <button onClick={goFiles}>
          Files
        </button>

        <button onClick={goHistory}>
          History
        </button>

      </div>

      <button className="logout" onClick={logout}>
        Logout
      </button>

    </nav>

  );
}

export default Sidebar;