import express from 'express';

const peer = express.Router();

const getKeyByValue = (map, value) => {
    const peerIdToRemove = value;
    for (let [key, val] of map.entries()) {
        let peerId = val.peerId;
        let peerIdString = peerId.toString();
        // console.log(peerIdString);
        // console.log(peerIdToRemove);
        if (peerIdString === peerIdToRemove) {
            return key;
        }
    }
    //console.log("cannot find peerID");
    return null; 
}

function findPeerInfoByPeerId(peerMap, peerId) {
    for (const [randomWord, info] of peerMap.entries()) {
        // console.log(info.peerId)
        // console.log(peerId)
        if (info.peerId.toString() === peerId) {
            // console.log("check this: ")
            // console.log(info)
            // console.log(randomWord)
            return info;
        }
    }
    return null;
}

peer.get('/get-peer', async (req, res) => {
    let statusCode = 200;
    let message = "";
    //console.log(req.discoveredPeers);
    const { 'peer-id': peerID } = req.query;
    //console.log(peerID);
    try {
        message = findPeerInfoByPeerId(req.discoveredPeers, peerID);
        //console.log(message);
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }
    
    res.status(statusCode).send(message);
});

//return all peer-info in discoveredPeers
peer.get('/get-peers', async (req, res) => {
    let statusCode = 200;
    let message = [];
    const peerMap = req.discoveredPeers;
    try {
        for (const [randomWord, info] of peerMap.entries()) {
            message.push(info);
        }
        //console.log(message);
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }

    res.status(statusCode).send(message);
});


//not entirely sure what it does
//implementation as of now only removes specified peer from discoveredPeers
peer.post('/remove-peer', async (req, res) => {
    let statusCode = 200;
    let message = '';
    const { 'peer-id': peerID } = req.body;
    //console.log(peerID);
    //console.log("before:", req.discoveredPeers);
    //console.log("key: ", getKeyByValue(req.discoveredPeers, peerID));
    try {

        const keyToRemove = getKeyByValue(req.discoveredPeers, peerID);
        //console.log(keyToRemove == null);
        if (keyToRemove !== null) {
            req.discoveredPeers.delete(keyToRemove);
            message = 'removed peer succesfully'
        } else {
            statusCode = 500;
            message = "cannot find peer "
        }
    } catch (error) {
        statusCode = 500;
        message = "Error";
    }
    //console.log("after:", req.discoveredPeers);
    res.status(statusCode).send(message);
});




export default peer;


