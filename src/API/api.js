// Http API for GUI
// http://localhost/hash
// parse all requests
// check the hash in request against the files we are serving
// send a response back with the file

// Libraries
import "dotenv/config.js";                  // Imports .env file
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import url from 'url';
import http from 'http';

// Route imports
import home from './Routes/home_page.js';
import market from "./Routes/market_page.js";
import peer from "./Routes/peer_page.js";
import settings from "./Routes/settings_page.js";
import mining from "./Routes/Manta/mining_page.js";
import stats from "./Routes/Manta/stats_page.js";
import wallet from "./Routes/Manta/wallet_page.js";

import { registerFile, getProducers } from './Wrappers/producer_consumer.js';
import { MAX_CHUNK_SIZE, fileRequests, getPublicMultiaddr } from '../Libp2p/utils.js';
import { sendRequestFile, sendRequestTransaction } from '../Producer_Consumer/http_client.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const destinationDirectory = path.join(__dirname, '..', 'testProducerFiles')

export function createAPI(node, discoveredPeers) {
    
    const app = express();

    // Middleware to parse JSON bodies
    app.use(express.json());

    // Custom middleware to attach 'node' variable to the request object
    app.use((req, res, next) => {
        req.node = node;
        req.discoveredPeers = discoveredPeers;
        next();
    });

    // Routers
    app.use(home);
    app.use(market);
    app.use(peer);
    app.use(settings);
    app.use(mining);
    app.use(stats);
    app.use(wallet);

    app.post('/requestFileFromProducer/', async (req, res) => {
        let statusCode = 200; 
        let { prodIp, prodPort, fileHash } = req.body;
        prodIp = String(prodIp);
        prodPort = String(prodPort);
        fileHash = String(fileHash);

        sendRequestFile(node.peerId.toString(), prodIp, prodPort, fileHash);
        res.status(statusCode).send('Download in progress');
    });

    app.get('/viewFileRequests/', async (req, res) => {
        let statusCode = 200; 
        
        res.status(statusCode).send(fileRequests);
    });

    app.post('/payChunk', async (req, res) => {
        let statusCode = 200;
        const { prodIp, prodPort, fileHash, amount } = req.body;
        sendRequestTransaction(node.peerId.toString(), prodIp, prodPort, fileHash, amount)
        res.status(statusCode).send('Payment in progress');
    });

    app.post('/registerFile', async (req, res) => {
        let statusCode = 200;
        const {fileName, username, price} = req.body;
        const peerId = node.peerId.toString();
        const publicMulti = await getPublicMultiaddr(node);
        const parts = publicMulti.split('/')
        const publicIP = parts[1]
        const port = parts[3]

        try {
            await registerFile(fileName, peerId, username, publicIP, port, price);
        } catch (error) {
            console.error("Error registering file:", error);
            statusCode = 500;
        }
        res.status(statusCode).send();
    });

    app.get('/getProducersWithFile', async (req, res) => {
        let statusCode = 200;
        let message = '';
        const { fileHash } = req.body;
        try {
           message = await getProducers(fileHash);
        } catch (error) {
            statusCode = 500;
            message = "Error getting producers with the filehash " + fileHash + ": " + error;
        }

        res.status(statusCode).send(message);
    });

    app.get('/hashFile', async (req, res) =>{
        let statusCode = 200; 
        let message = '';
        let { filePath } = req.query;

        if (!fs.existsSync(filePath)) {
            statusCode = 400;
            message = 'File not found';
        } else {
            const fileContent = fs.readFileSync(filePath);
            const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
            message = {fileHash};
        }
        
        res.status(statusCode).send(message);
    });
    
    app.post('/uploadFile', async (req, res) => {
        let statusCode = 200; 
        let message = 'Success';
        let { filePath } = req.body;

        if (!fs.existsSync(filePath)) {
            statusCode = 400;
            message = 'File not found';
        }
        const fileName = path.basename(filePath);
        const destinationPath = path.join(destinationDirectory, fileName);
        fs.copyFile(filePath, destinationPath, (error) => {
            if (error) {
                statusCode = 400;
                message = 'File copy unsuccessful';
            }
        });
        res.status(statusCode).send(message);
    });

    app.post('/deleteFile', async (req, res) => {
        let statusCode = 200; 
        let message = 'Success';
        let { filePath } = req.body;

        if (!fs.existsSync(filePath)) {
            statusCode = 400;
            message = 'File not found';
        }
        // Asynchronously delete the file
        fs.unlink(filePath, (error) => {
            if (error) {
                statusCode = 400;
                message = 'Error deleting file';
            }
        });
        res.status(statusCode).send(message);
    });
    
    app.get('/getFileInfo', async (req, res) => {
        let statusCode = 200; 
        let message = '';
        let { filePath } = req.query;

        if (!fs.existsSync(filePath)) {
            statusCode = 400;
            message = 'File not found';
        } else {
            const fileName = path.basename(filePath);
            const fileStats = fs.statSync(filePath);
            const fileSize = fileStats.size;
            const numberChunks =  Math.ceil(fileSize / MAX_CHUNK_SIZE);
            const fileDate = fileStats.birthtime;
            const fileContent = fs.readFileSync(filePath);
            const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    
            message = {
                fileName,
                filePath,
                fileDate,
                fileSize,
                numberChunks,
                fileHash
            };
        }
        
        res.status(statusCode).send(message);
    });

    app.get('/getProducerFilesInfo', async (req, res) => {
        let statusCode = 200; 
        let message = [];

        const files = fs.readdirSync(destinationDirectory);
        files.forEach(file => {
            const filePath = path.join(destinationDirectory, file);
            const fileName = path.basename(filePath);
            const fileStats = fs.statSync(filePath);
            const fileSize = fileStats.size;
            const numberChunks =  Math.ceil(fileSize / MAX_CHUNK_SIZE);
            const fileDate = fileStats.birthtime;
            const fileContent = fs.readFileSync(filePath);
            const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    
            message.push({
                fileName,
                filePath,
                fileDate,
                fileSize,
                numberChunks,
                fileHash
            })
        })
        res.status(statusCode).send(message);
    })

    const server = http.createServer(app);
    server.listen(process.env.API_PORT);
    server.on('error', (error) => {server.listen(0);});
    server.on('listening', () => console.log(`\nAPI is running on port ${server.address().port}`))
    return server;
}