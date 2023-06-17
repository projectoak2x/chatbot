const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Message Subdocument Schema
const messageSchema = new Schema({
    role: {
        type: String,
        enum: ['user', 'system', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    }
}, { _id : false });

// Main Schema
const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    points: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    messages: [messageSchema]
});

const User = mongoose.model('User', UserSchema);

module.exports = User;