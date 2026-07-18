import jwt from "jsonwebtoken";

export function sign(user){
  return jwt.sign(
    { uid: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "10h" }
  );
}

export function auth(req,res,next){
  try{
    const token = (req.headers.authorization||"").replace("Bearer ","");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; next();
  }catch(e){ return res.status(401).json({error:"Unauthorized"}); }
}

export function allow(...roles){
  return (req,res,next)=>{
    if(!roles.includes(req.user.role)) return res.status(403).json({error:"Forbidden"});
    next();
  };
}
