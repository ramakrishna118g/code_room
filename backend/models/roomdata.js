import mongoose from 'mongoose';
const roomdata=new mongoose.Schema({
  roomid:{
    type:String,
    required: true
  },
  password:{
    type:String,
    required:true
  },
  hostid:{
    type:String,
    required:true
  },
  roomtype:{
    type:String,
    required:true
  }
})

const Roomdata=mongoose.model("Roomdata",roomdata);
export default Roomdata;