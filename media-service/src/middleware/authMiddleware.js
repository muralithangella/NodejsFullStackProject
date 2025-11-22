
const authenticateRequest=(req,res,next)=>{
    const userid=req.headers['x-user-id'];

    if(!userid){
        return res.status(401).json({success:false, message:'Unauthorized'});
    }
    req.userId = userid;
    next();

}

module.exports=authenticateRequest;