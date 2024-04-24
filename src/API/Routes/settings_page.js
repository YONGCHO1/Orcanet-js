import express from 'express';

const settings = express.Router();

settings.get('/set-transfer-settings', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { theme, saveLocation } = req.body;
    try {
       message = 'Message'
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

settings.get('/get-transfer-settings', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { theme, saveLocation } = req.body;
    try {
       message = 'Message'
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

export default settings;