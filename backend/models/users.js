import mongoose from "mongoose"
import bcrypt from "bcrypt"

const userschema = new mongoose.Schema({
  username:{
    type:String,
    required:true,
    unique:true
  },
  password:{
    type:String,
    required:true
  },
  originalname:{
    type:String,
    required:true
  },
  email:{
    type:String,
    required:true
  }
})

userschema.pre("save", async function(){   // ← no next param
  if(!this.isModified("password")){
    return                                  // ← just return
  }
  this.password = await bcrypt.hash(this.password, 10)
})

export default mongoose.model("User",userschema)