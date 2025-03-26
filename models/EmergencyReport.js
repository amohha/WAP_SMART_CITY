const mongoose = require('mongoose');

const EmergencyReportSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['medical', 'fire', 'traffic', 'police', 'infrastructure', 'other']
    },
    location: {
        type: String,
        required: true
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    description: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high']
    },
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'responding', 'resolved']
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('EmergencyReport', EmergencyReportSchema); 