import express from 'express';
import { Consumer } from '../../Producer_Consumer/consumer.js';
import { sendRequestFile } from '../../Producer_Consumer/http_client.js';
import { jobs } from '../../Libp2p/utils.js';

const market = express.Router();

let producerPeers = [];     // { peerId : [Peer]}

market.delete('/remove-from-history', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { jobID } = req.query;
    try {
        delete jobs[jobID];
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.delete('/clear-history', async (req, res) => {
    let statusCode = 200;
    let message = '';
    try {
       jobs = {}
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.get('/find-peer', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { fileHash } = req.query;

    try {
        const producers = await Consumer.viewProducers(fileHash);
        message = producers
        for (const peer of producers) {
            peer['accumulatedMemory'] = 0
            peer['status'] = 0
            peer['fileHash'] = fileHash
            peer['price'] = parseInt(peer['price'])
            if (!producerPeers.hasOwnProperty(peer['id'])) {producerPeers[peer['id']] = []}
            producerPeers[peer['id']].push(peer)
        }
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }
    res.status(statusCode).send(message);
});

market.put('/add-job', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { fileHash, peerId } = req.body;
    const node = req.node;

    try {
        for (const fileInfo of producerPeers[peerId]) {
            if (fileInfo['fileHash'] == fileHash) {
                const jobId = peerId + fileHash;
                message = {jobId}
                jobs[jobId] = {
                    fileHash, 
                    peerId,
                    timeQueued: Date.now(),
                    status: 'active',
                    eta: 0,
                    accumulatedCost: 0,
                    accumulatedMemory: 0,
                    projectedCost: 0,
                    price: fileInfo['price'],
                    fileName: '',
                    fileSize: 0,
                }

                console.log(jobs, node.peerId.toString())
                
                const prodIp = fileInfo['ip']
                const prodPort = fileInfo['port']
                await sendRequestFile(node.peerId.toString(), prodIp, prodPort, fileHash, jobId);
                break;
            }
        }

    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.get('/job-list', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';

    try {
       message = {jobs}
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.get('/job-info', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { jobID } = req.query;

    try {
        message = jobs[jobID]
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.get('/job-peer', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { jobID, peerID } = req.query;
    try {
        const fileHash = jobID.slice(peerID.length);
        for (const peerInfo of producerPeers[peerID]) {
            if (peerInfo['fileHash'] == fileHash) {
                message = peerInfo
                break
            }
        }
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.put('/start-jobs', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { jobs : jobIDS } = req.body;
    try {
       for (const jobID of jobIDS) {
            jobs[jobID]['status'] = 'active'
       }
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.put('/pause-jobs', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { jobs : jobIDS } = req.body;
    try {
        for (const jobID of jobIDS) {
            jobs[jobID]['status'] = 'paused'
       }
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});

market.put('/terminate-jobs', async (req, res) => {
    let statusCode = 200;
    let message = 'Success';
    const { jobs : jobIDS } = req.body;
    try {
        for (const jobID of jobIDS) {
            jobs[jobID]['status'] = 'error'
       }
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});


export default market;