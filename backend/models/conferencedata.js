import mongoose from "mongoose";

const confschema=new mongoose.Schema({
  conftype:{
    type:String,
    required:true
  },
  confid:{
    type:String,
    required:true
  },
  hostid:{
    type:String,
    required:true
  },
  password:{
    type:String,
    required:true
  }
})
 const confData=mongoose.model("confData",confschema);
 export default confData;