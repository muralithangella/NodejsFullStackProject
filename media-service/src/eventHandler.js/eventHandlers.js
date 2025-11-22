const { deleteImageFromCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');
const handlePostDeleted=async (event)=>{
  const {postId,mediaIds}=event;
  try{
   const mediaToDelete= await Media.find({_id:{$in:mediaIds}});
    for(const media of mediaToDelete){
      await deleteImageFromCloudinary(media.publicId)
      await Media.findByIdAndDelete(media._id);
      const mediaId=media._id;
      logger.info(`Media deleted: ${mediaId}`);

    }
    logger.info(`Post deleted: ${postId}`);
    return {success:true};
  }catch(err){
    logger.error(`Error deleting post: ${err.message}`);
    throw err;
  }
}

module.exports={handlePostDeleted};