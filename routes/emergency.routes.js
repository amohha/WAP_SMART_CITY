const express = require('express');
const router = express.Router();
const EmergencyReport = require('../models/EmergencyReport');

// POST - Create a new emergency report
router.post('/report', async (req, res) => {
    try {
        const newReport = new EmergencyReport(req.body);
        const savedReport = await newReport.save();
        
        // In a real application, you might want to:
        // 1. Send notifications to emergency services
        // 2. Update real-time status boards
        // 3. Trigger alerts to nearby users

        res.status(201).json({
            success: true,
            message: 'Emergency report submitted successfully',
            data: savedReport,
            reportId: savedReport._id
        });
    } catch (error) {
        console.error('Error saving emergency report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit emergency report',
            error: error.message
        });
    }
});

// GET - Get all emergency reports (possibly for admin dashboard)
router.get('/reports', async (req, res) => {
    try {
        const reports = await EmergencyReport.find().sort({ timestamp: -1 });
        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });
    } catch (error) {
        console.error('Error fetching emergency reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch emergency reports',
            error: error.message
        });
    }
});

// GET - Get a specific emergency report by ID
router.get('/report/:id', async (req, res) => {
    try {
        const report = await EmergencyReport.findById(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Emergency report not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Error fetching emergency report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch emergency report',
            error: error.message
        });
    }
});

// PUT - Update emergency report status (for emergency services)
router.put('/report/:id', async (req, res) => {
    try {
        const updatedReport = await EmergencyReport.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!updatedReport) {
            return res.status(404).json({
                success: false,
                message: 'Emergency report not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Emergency report updated successfully',
            data: updatedReport
        });
    } catch (error) {
        console.error('Error updating emergency report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update emergency report',
            error: error.message
        });
    }
});

module.exports = router; 