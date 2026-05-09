import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './login.css'

function Login(){
  const [enusername, setenusername] = useState("");
  const [enpassword, setenpassword] = useState("");
  const [credstatus, setcredstatus] = useState("");
  const [islogin, setislogin] = useState(true);
  const [issignup, setissignup] = useState(false);
  const [suusername, setsuusername] = useState("");
  const [suoriginalname, setsuoriginalname] = useState("");
  const [suemail, setsuemail] = useState("");
  const [susetpassword, setsusetpassword] = useState("");
  const [suconfirmpassword, setsuconfirmpassword] = useState("");
  const [signupstatus, setsignupstatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("code-roomtoken");
    const expiry = localStorage.getItem("code-roomtokenExpiry");

    if (token && expiry) {
      const timeout = Number(expiry) - Date.now();
      if (timeout > 0) {
        navigate('/home');
        const timer = setTimeout(() => {
          localStorage.removeItem("code-roomtoken");
          localStorage.removeItem("code-roomtokenExpiry");
        }, timeout);
        return () => clearTimeout(timer);
      } else {
        localStorage.removeItem("code-roomtoken");
        localStorage.removeItem("code-roomtokenExpiry");
        navigate('/login');
      }
    }
  }, []);

  async function loginsub() {
    if (!enusername || !enpassword) {
      setcredstatus("Enter Complete Credentials");
      return;
    }
    setcredstatus("");
    const data = {
      username: enusername.trim(),
      password: enpassword
    };
    try {
      let login = await fetch(`${import.meta.env.VITE_BACKEND_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      login = await login.json();
      if (!login.success) {
        setcredstatus(login.message);
        return;
      }
      localStorage.setItem("code-roomtoken", login.token);
      const expiryTime = Date.now() + (60 * 60 * 1000);
      localStorage.setItem("code-roomtokenExpiry", expiryTime);
      navigate("/home");
    } catch (err) {
      setcredstatus("Server Error");
    }
  }

  function isloginpage() {
    setissignup(false);
    setislogin(true);
  }

  function issignuppage() {
    setislogin(false);
    setissignup(true);
  }

  async function signupsub() {
    if (!suusername || !suoriginalname || !suemail || !susetpassword || !suconfirmpassword) {
      setsignupstatus("Enter complete credentials");
      return;
    }
    if (susetpassword !== suconfirmpassword) {
      setsignupstatus("Passwords did not match");
      return;
    }
    setsignupstatus("Creating account...");
    const data = {
      username: suusername.trim(),
      password: susetpassword.trim(),
      originalname: suoriginalname.trim(),
      email: suemail.trim()
    };
    try {
      let signup = await fetch(`${import.meta.env.VITE_BACKEND_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      signup = await signup.json();
      if (!signup.success) {
        setsignupstatus(signup.message);
        return;
      }
      setsignupstatus("Account created! Please login.");
      setTimeout(() => isloginpage(), 1500);
    } catch (err) {
      setsignupstatus("Server Error");
    }
  }

  return (
    <div className="auth-page">
      {islogin && (
        <div className="auth-box">
          <h1>Login to CodeRoom</h1>
          <label>Enter UserName</label>
          <input placeholder="Enter UserName" onChange={(e) => setenusername(e.target.value)} />
          <label>Enter Password</label>
          <input placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" type="password" onChange={(e) => setenpassword(e.target.value)} />
          <p>{credstatus}</p>
          <button onClick={loginsub}>Login</button>
          <p>Or</p>
          <button onClick={issignuppage}>SignUp</button>
        </div>
      )}

      {issignup && (
        <div className="auth-box">
          <h1>Sign up for your Account</h1>
          <label>Enter UserName</label>
          <input placeholder="Set your Username" onChange={(e) => setsuusername(e.target.value)} />
          <label>Enter Your Name</label>
          <input placeholder="Enter Your name" onChange={(e) => setsuoriginalname(e.target.value)} />
          <label>Enter email</label>
          <input type="email" placeholder="youremail@gmail.com" onChange={(e) => setsuemail(e.target.value)} />
          <label>Set Password</label>
          <input placeholder="Set password" type="password" onChange={(e) => setsusetpassword(e.target.value)} />
          <label>Confirm password</label>
          <input placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" type="password" onChange={(e) => setsuconfirmpassword(e.target.value)} />
          <p>{signupstatus}</p>
          <button onClick={signupsub}>Signup</button>
          <p>or</p>
          <button onClick={isloginpage}>Login</button>
        </div>
      )}
    </div>
  );
}

export default Login;
