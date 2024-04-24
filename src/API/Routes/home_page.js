import express from 'express';
import fs from 'fs';
import path from 'path';
import { getPublicMultiaddr, hashFile } from '../../Libp2p/utils.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Producer } from '../../Producer_Consumer/producer.js';
import { Consumer } from '../../Producer_Consumer/consumer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const producerFilesPath = path.join(__dirname, '../..', 'testProducerFiles');

const home = express.Router();

// incomplete
home.get('/file/:hash/info', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const hash = req.params.hash;
    try {
        message = await Consumer.viewProducers(hash)
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

home.post('/upload', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { filePath, price } = req.body;
    const node = req.node;
    try {
        const fileName = path.basename(filePath);
        const destinationPath = path.join(producerFilesPath, fileName);
        fs.copyFileSync(filePath, destinationPath)

        const fileHash = hashFile(fileName);
        message = { fileHash };

        const peerId = node.peerId.toString();
        const publicMulti = await getPublicMultiaddr(node);
        const parts = publicMulti.split('/')
        const publicIP = parts[2]
        const port = parseInt(parts[4]);
        Producer.registerFile(fileHash, peerId, "username", publicIP, port, price);
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }
    res.status(statusCode).send(message);
});

home.delete('/file/:hash', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const hash = req.params.hash;
    try {
        let filePath = hash;
        const files = fs.readdirSync(producerFilesPath)

        for (const file of files) {
            const currentFilePath = path.join(producerFilesPath, file);
            const currentFileHash = hashFile(path.basename(currentFilePath));

            if (currentFileHash.trim() == hash.trim()) {
                filePath = currentFilePath;
            }
        }
        fs.unlinkSync(filePath)
    } catch (error) {
        console.log(error)
        statusCode = 500;
        message = "Error";
    }
    res.status(statusCode).send(message);
});

export default home;