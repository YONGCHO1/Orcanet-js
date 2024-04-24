import express from 'express';

const home = express.Router();

home.get('/file/:hash', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { hash } = req.params;
    const { filename, producer } = req.body;
    try {
       message = 'Message'
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

home.get('/get:hash/info', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { hash } = req.params;
    try {
       message = 'Message'
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

home.get('/upload', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { file } = req.body;
    try {
       message = 'Message'
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

home.delete('/file/:hash', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { hash } = req.params;
    const { param1, param2 } = req.body;
    try {
       message = 'Message'
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

export default home;