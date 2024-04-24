import "dotenv/config.js";                  // Imports .env file
import express from 'express';
import fs from 'fs';
import { setTimeout } from 'timers/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { MAX_CHUNK_SIZE, activities, upload_speeds } from '../Libp2p/utils.js';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const producerFilesPath = path.join(__dirname, '..', 'testProducerFiles');

const app = express();
const PORT = 3000;

let payments = 0;
let consumerPayment = {};

// Endpoint to handle file download
app.get('/requestFile', async (req, res) => {
  // Parse file hash from the query parameter
  const fileHash = req.query.fileHash;
  const consumerID = req.query.peerID;

  if (!fileHash || !consumerID) {
    // If file hash is not provided
    console.log('missing field', fileHash, consumerID)
    return res.status(400).send('File hash is required');
  }

  if (!consumerPayment.hasOwnProperty(consumerID)) {
    consumerPayment[consumerID] = {}
  }
  if (!consumerPayment[consumerID].hasOwnProperty(fileHash)) {
    consumerPayment[consumerID][fileHash] = true;
  }


  let actualPath = path.join(producerFilesPath, fileHash);
  fs.readdir(producerFilesPath, async (err, files) => {
    let foundFile = false;
    for (const file of files) {
      const filePath = path.join(producerFilesPath, file);
      const fileContent = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex');

      if (fileHash.trim() == hash.trim()) {
        actualPath = filePath;
        foundFile = true;
      }
    }

    if (!foundFile) {return res.status(400)}

    const filePath = actualPath;
    // Open the file for reading synchronously
    const fileHandle = fs.openSync(filePath, 'r');

    // Get file stats to know its size
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    // Set response headers
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=${path.basename(actualPath)}`,
      'Content-Length': fileSize
    });

    // Buffer size for each chunk (you can adjust this value as needed)
    const bufferSize = MAX_CHUNK_SIZE;
    // Buffer to store chunk data
    const buffer = Buffer.alloc(bufferSize);

    // Function to read chunks from the file and write them to the response stream
    while (true) {
      while (!consumerPayment[consumerID][fileHash]) {
        await setTimeout(100);
        console.log('waiting for pay')
      }

      let bytesRead;
      let bytesProcessed = 0; // Track the total bytes processed
      let endOfFile = false; // Flag to indicate end of file
      let remainingBytes = bufferSize;
      while (remainingBytes > 0) {
        bytesRead = fs.readSync(fileHandle, buffer, bytesProcessed, remainingBytes, null);
        if (bytesRead === 0) {
          endOfFile = true; // Set endOfFile flag to true
          break; // Exit inner loop if end of file
        }
        remainingBytes -= bytesRead;
        bytesProcessed += bytesRead;

        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        if (Object.keys(upload_speeds).length > 10000) {upload_speeds = {}}
        if (!upload_speeds.hasOwnProperty[currentTimeInSeconds]) {upload_speeds[currentTimeInSeconds] = 0}
        upload_speeds[currentTimeInSeconds] += bytesRead;
      }

      console.log('sent chunk')
      res.write(buffer.slice(0, bytesProcessed)); // Write the chunk data to the response stream
      consumerPayment[consumerID][fileHash] = false;

      // If bytesRead is 0, it means we've reached the end of the file
      if (endOfFile) {
        // Close the file handle
        fs.closeSync(fileHandle);
        // End the response
        res.end();
        
        activities['uploads'].push({
          date: new Date().toISOString().split("T")[0],   // Output: 2024-04-24
          fileType: filePath.split('.').pop()
        })
        break
      }

    };
  })
});

app.get('/sendTransaction', (req, res) => {
  const fileHash = req.query.fileHash;
  const consumerID = req.query.peerID;
  const amount = parseFloat(req.query.amount);

  payments += 1;
  if (!consumerPayment.hasOwnProperty(consumerID)) {
    consumerPayment[consumerID] = {}
  }
  consumerPayment[consumerID][fileHash] = true;
  console.log('Recieved:', amount, 'from', consumerID)
  res.setHeader('Connection', 'close');
  res.end();
});

const server = http.createServer(app);
server.listen(process.env.HTTP_PORT);
server.on('error', (error) => {server.listen(0);});
server.on('listening', () => console.log(`HTTP Server is running on port ${server.address().port}`))

export { server }
