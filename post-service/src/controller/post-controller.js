const logger=require('../utils/logger');
const {Post}=require('../models/post');


const createPost=async (req,res)=>{
    try {

        const {mediaIds,content}=req.body;
        const post=await Post({
            mediaIds:mediaIds||[],
            content,
            user:req.user._id
        });

        await post.save();
        logger.info(`Post created successfully: ${post._id}`);
        res.status(201).json({ success: true, message: "Post created successfully", post });
        
    } catch (error) {
        logger.error(`Create post error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
    
}

const getAllPosts=async (req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const skip = (page - 1) * limit;
        
        const [posts, total] = await Promise.all([
            Post.find({})
                .populate('user', 'username profilePicture')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments({})
        ]);
        
        logger.info(`Posts retrieved: page ${page}, limit ${limit}`);
        res.status(200).json({ 
            success: true, 
            message: "Posts retrieved successfully", 
            posts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        logger.error(`getAll posts error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

const getPost=async (req,res)=>{
    try {
        const {id}=req.params;
        const post=await Post.findById(id)
            .populate('user', 'username profilePicture')
            .lean();
        if(!post){
            logger.warn(`Post not found: ${id}`);
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        logger.info(`Post retrieved successfully: ${id}`);
        res.status(200).json({ success: true, message: "Post retrieved successfully", post });
        
    } catch (error) {
        logger.error(`get post error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

const deletePost=async (req,res)=>{
    try {
        const {id}=req.params;
        const post=await Post.findByIdAndDelete(id);
        if(!post){
            logger.warn(`Post not found: ${id}`);
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        logger.info(`Post deleted successfully: ${id}`);
        res.status(200).json({ success: true, message: "Post deleted successfully" });
        
    } catch (error) {
        logger.error(`delete post error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
    
}

const updatePost=async (req,res)=>{
    try {
        const {id}=req.params;
        const {content}=req.body;
        
        const post=await Post.findOneAndUpdate(
            {_id: id, user: req.user._id},
            {content, updatedAt: new Date()},
            {new: true}
        ).populate('user', 'username profilePicture');
        
        if(!post){
            logger.warn(`Post not found or unauthorized: ${id}`);
            return res.status(404).json({ success: false, message: "Post not found or unauthorized" });
        }
        
        logger.info(`Post updated successfully: ${id}`);
        res.status(200).json({ success: true, message: "Post updated successfully", post });
        
    } catch (error) {
        logger.error(`update post error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

const likePost=async (req,res)=>{
    try {
        const {id}=req.params;
        const userId=req.user._id;
        
        const post=await Post.findById(id);
        if(!post){
            logger.warn(`Post not found: ${id}`);
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        
        const isLiked = post.likes.includes(userId);
        const update = isLiked 
            ? { $pull: { likes: userId } }
            : { $addToSet: { likes: userId } };
            
        const updatedPost = await Post.findByIdAndUpdate(id, update, {new: true})
            .populate('user', 'username profilePicture');
            
        logger.info(`Post ${isLiked ? 'unliked' : 'liked'}: ${id}`);
        res.status(200).json({ 
            success: true, 
            message: `Post ${isLiked ? 'unliked' : 'liked'} successfully`, 
            post: updatedPost,
            isLiked: !isLiked
        });
        
    } catch (error) {
        logger.error(`like post error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

module.exports={createPost,getAllPosts,getPost,deletePost,updatePost,likePost};