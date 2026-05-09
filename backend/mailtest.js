import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function sendOTP() {

  // generate random 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  // transporter config
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // email options
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "ramakrishna118g@gmail.com",   // change this to your email
    subject: "OTP Verification",
    text: `Your OTP is ${otp}`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP sent:", otp);
    console.log("Message ID:", info.messageId);
  } 
  catch (error) {
    console.log("Error sending mail:", error);
  }
}

sendOTP();