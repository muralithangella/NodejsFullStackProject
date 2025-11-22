const mongoose = require('mongoose');

const postSchema = mongoose.Schema({
    title: {
        type: String,
        trim: true,
        minlength: [3, 'Title must be at least 3 characters'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        trim: true,
        minlength: [10, 'Content must be at least 10 characters'],
        maxlength: [5000, 'Content cannot exceed 5000 characters']
    },
    media: {
        type: String,
        validate: {
            validator: function(v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Media must be a valid URL'
        }
    },
    category: {
        type: String,
        trim: true,
        maxlength: [50, 'Category cannot exceed 50 characters'],
        index: true
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: [500, 'Comment cannot exceed 500 characters']
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    viewCount: {
        type: Number,
        default: 0,
        min: [0, 'View count cannot be negative']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound indexes for better query performance
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });
postSchema.index({ isActive: 1, createdAt: -1 });

// Text index for search functionality
postSchema.index({ title: 'text', content: 'text' });

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
    return this.comments.length;
});

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
    return this.likes.length;
});

// Drop the problematic index if it exists
postSchema.post('init', async function() {
    try {
        await this.collection.dropIndex('title_1');
        console.log('Dropped title_1 index');
    } catch (error) {
        // Index doesn't exist, ignore
    }
});

const Post = mongoose.model('Post', postSchema);
module.exports = { Post };