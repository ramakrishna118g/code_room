import Home from './homepage.jsx';
import Ohome from './ohome.jsx';
import Login from './login.jsx';
import Conference from './conference.jsx';
import { Routes, Route } from 'react-router-dom';
import ConferenceRoom from './conferenceRoom.jsx';
function App() {
  return (
    <Routes>
      <Route path='/room' element={<Home />} />
      <Route path='/home' element={<Ohome />} />
      <Route path='/' element={<Login/>}/>
      <Route path="/conference" element={<Conference/>}/>
      <Route path="/conference/:roomId" element={<ConferenceRoom />} />
    </Routes>
  );
}

export default App;
