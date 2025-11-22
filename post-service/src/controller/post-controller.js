const logger=require('../utils/logger');
const {Post}=require('../models/post');


const invalidatePostCache = async (req, postId) => {
    if (req.redisClient) {
        try {
            const keys = await req.redisClient.keys(`post:${postId}*`);
            if (keys.length > 0) {
                await req.redisClient.del(keys);
            }
            // Also invalidate general post lists
            const listKeys = await req.redisClient.keys('posts:*');
            if (listKeys.length > 0) {
                await req.redisClient.del(listKeys);
            }
        } catch (error) {
            logger.error(`Cache invalidation error: ${error.message}`);
        }
    }
};
const createPost=async (req,res)=>{
    try {
        const {mediaIds,content,title}=req.body;
        const postData = {
            mediaIds:mediaIds||[],
            content,
            user:req.user._id
        };
        
        // Only add title if provided
        if (title) {
            postData.title = title;
        }
        
        const post = new Post(postData);
        await post.save();
        await invalidatePostCache(req, post._id);
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
        const cacheKey = `posts:page:${page}:limit:${limit}`;
        
        // Check cache first
        if (req.redisClient) {
            try {
                const cached = await req.redisClient.get(cacheKey);
                if (cached) {
                    logger.info(`Posts retrieved from cache: page ${page}, limit ${limit}`);
                    return res.status(200).json(JSON.parse(cached));
                }
            } catch (cacheError) {
                logger.error(`Cache read error: ${cacheError.message}`);
            }
        }
        
        const skip = (page - 1) * limit;
        const [posts, total] = await Promise.all([
            Post.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments({})
        ]);
        
        const response = { 
            success: true, 
            message: "Posts retrieved successfully", 
            posts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
        
        // Cache the result
        if (req.redisClient) {
            try {
                await req.redisClient.setex(cacheKey, 300, JSON.stringify(response)); // 5 minutes
            } catch (cacheError) {
                logger.error(`Cache write error: ${cacheError.message}`);
            }
        }
        
        logger.info(`Posts retrieved from DB: page ${page}, limit ${limit}`);
        res.status(200).json(response);
        
    } catch (error) {
        logger.error(`getAll posts error: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

const getPost=async (req,res)=>{
    try {
        const {id}=req.params;
        const cacheKey = `post:${id}`;
        
        // Check cache first
        if (req.redisClient) {
            try {
                const cached = await req.redisClient.get(cacheKey);
                if (cached) {
                    logger.info(`Post retrieved from cache: ${id}`);
                    return res.status(200).json(JSON.parse(cached));
                }
            } catch (cacheError) {
                logger.error(`Cache read error: ${cacheError.message}`);
            }
        }
        
        const post=await Post.findById(id)
            .lean();
        if(!post){
            logger.warn(`Post not found: ${id}`);
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        
        const response = { success: true, message: "Post retrieved successfully", post };
        
        // Cache the result
        if (req.redisClient) {
            try {
                await req.redisClient.setex(cacheKey, 600, JSON.stringify(response)); // 10 minutes
            } catch (cacheError) {
                logger.error(`Cache write error: ${cacheError.message}`);
            }
        }
        
        logger.info(`Post retrieved from DB: ${id}`);
        res.status(200).json(response);
        
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
        await invalidatePostCache(req, id);
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
        );
        
        if(!post){
            logger.warn(`Post not found or unauthorized: ${id}`);
            return res.status(404).json({ success: false, message: "Post not found or unauthorized" });
        }
        
        await invalidatePostCache(req, id);
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
            
        const updatedPost = await Post.findByIdAndUpdate(id, update, {new: true});
            
        await invalidatePostCache(req, id);
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