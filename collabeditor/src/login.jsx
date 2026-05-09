import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './login.css'
function Login(){
  const [enusername,setenusername]=useState("");
  const [enpassword,setenpassword]=useState("");
  const [credstatus,setcredstatus]=useState("");
  const [islogin,setislogin]=useState(true);
  const [issignup,setissignup]=useState(false);
  const [isverify,setisverify]=useState(false);
  const [suusername,setsuusername]=useState("");
  const [suoriginalname,setsuoriginalname]=useState("");
  const [suemail,setsuemail]=useState("");
  const [susetpassword,setsusetpassword]=useState("");
  const [suconfirmpassword,setsuconfirmpassword]=useState("");
  const [otp,setotp]=useState("");
  const [otpstatus,setotpstatus]=useState("");
  const[signupstatus,setsignupstatus]=useState("");
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
    if(!enusername || !enpassword){
      setcredstatus("Enter Complete Credentials");
      return;
    }
    setcredstatus("");
    const data={
      username:enusername.trim(),
      password:enpassword
    }
    try{
      let login=await fetch(`${import.meta.env.VITE_BACKEND_URL}/login`,{
        method:"POST",
        headers: { "Content-Type": "application/json" },
        body:JSON.stringify(data),
      })
      login=await login.json();
      if(!login.success){
        setcredstatus(login.message)
        return;
      }
      else{
        localStorage.setItem("code-roomtoken",login.token);
        const expiryTime = Date.now() + (60 * 60 * 1000);
        localStorage.setItem("code-roomtokenExpiry", expiryTime);
      }
      navigate("/home");
  }
  catch(err){
    setcredstatus("Server Error");
  }
  }

  function isloginpage(){
    setissignup(false);
    setisverify(false);
    setislogin(true);
  }
  function issignuppage(){
    setislogin(false);
    setisverify(false);
    setissignup(true);
  }
  function isverifypage(){
    setislogin(false);
    setissignup(false);
    setisverify(true);
  }

  
  async function signupsub(){
    if(!suusername || !suoriginalname || !suemail || !susetpassword || !suconfirmpassword){
      setsignupstatus("Enter complete credentials");
      return;
    }
    if(susetpassword!==suconfirmpassword){
      setsignupstatus("Passwords did not match");
      return;
    }
    setsignupstatus("This may take few seconds...");
    let data={
      username:suusername.trim(),
      password:susetpassword.trim(),
      originalname:suoriginalname.trim(),
      email:suemail.trim()
    }
    try{
      let signup=await fetch(`${import.meta.env.VITE_BACKEND_URL}/signup`,{
        method:"POST",
        headers: { "Content-Type": "application/json" },
        body:JSON.stringify(data),
      })
      signup = await signup.json();
      if(!signup.success){
        setsignupstatus(signup.message);
        return;
      }
      isverifypage();
    }
    catch(err){
      setsignupstatus("ServerError");
    }
  }
  async function verifysub(){
    if(!otp){
      setotpstatus("Enter Valid OTP");
      return;
    }
    let data={
      email:suemail.trim(),
      otp:otp.trim()
    }
    try{
      let verify=await fetch(`${import.meta.env.VITE_BACKEND_URL}/verify-otp`,{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:JSON.stringify(data),
      })
      verify=await verify.json();
      if(!verify.success){
        setotpstatus(verify.message);
        return;
      }
      isloginpage();
    }
    catch(err){
      setotpstatus("Server Error");
    }
  }
  return(
    <div className="auth-page">
      {islogin &&(
      <div className="auth-box">
        <h1>Login to CodeRoom</h1>
        <label>Enter UserName</label>
        <input placeholder="Enter UserName" onChange={(e)=>setenusername(e.target.value)}></input>
        <label>Enter Password</label>
        <input placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" type="password" onChange={(e)=>setenpassword(e.target.value)}></input>
        <p>{credstatus}</p>
        <button onClick={loginsub}>Login</button>
        <p>Or</p>
        <button onClick={issignuppage}>SignUp</button>
      </div>
      )}
      {issignup&&(
        <div className="auth-box">
          <h1>Sign up for your Account</h1>
          <label>Enter UserName</label>
          <input placeholder="Set your Username" onChange={(e)=> setsuusername(e.target.value)}></input>
          <label>Enter Your Name</label>
          <input placeholder="Enter Your name" onChange={(e)=> setsuoriginalname(e.target.value)}></input>
          <label>Enter email</label>
          <input type="email" placeholder="youremail@gmail.com" onChange={(e) => setsuemail(e.target.value)}></input>
          <label>Set Password</label>
          <input placeholder="Set password" type="password" onChange={(e)=>setsusetpassword(e.target.value)}></input>
          <label>Confirm password</label>
          <input placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" type="password" onChange={(e)=> setsuconfirmpassword(e.target.value)}></input>
          <p>{signupstatus}</p>
          <button onClick={signupsub}>Signup</button>
          <p>or</p>
          <button onClick={isloginpage}>Login</button>
        </div>
      )}

      {isverify && (
         <div className="auth-box">
          <h1>Verify OTP</h1>
          <p>Please enter the OTP sent to your mail for verification</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={otp}
            onChange={(e)=> setotp(e.target.value)}
            placeholder="Enter 6-digit OTP"
            maxLength={6}
          />
          <p>{otpstatus}</p>
          <button onClick={verifysub}>Verify</button>
    </div>
      )}
    </div>
  );
}
export default Login;