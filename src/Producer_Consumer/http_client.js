import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { MAX_CHUNK_SIZE, activities, download_speeds, jobs } from '../Libp2p/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const consumerFilesPath = path.join(__dirname, '..', 'testConsumerFiles');

let pay = 0

export async function sendRequestFile(peerId, prodIp, prodPort, fileHash, jobId) {
    if (!fs.existsSync(consumerFilesPath)) {fs.mkdirSync(consumerFilesPath);}
    const requestURL = `http://${prodIp}:${prodPort}/requestFile?fileHash=${fileHash}&peerID=${peerId}`;

    try {
        http.get(requestURL, async (response) => {
            // Listen for error events
            response.on('error', (error) => {
                console.error('Error:', error);
                // Handle the error as needed
            });
            if (response.statusCode !== 200) {
                console.error(`Failed to download file. Server responded with status code ${response.statusCode}`);
                return;
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers['content-disposition'];
            const filenameMatch = contentDisposition.match(/filename=(.+)/);
            const filename = filenameMatch ? filenameMatch[1] : 'downloaded_file';
            const filePath = path.join(consumerFilesPath, `${filename}`);

            let accumulatedChunks = Buffer.alloc(0); // Buffer to accumulate partial chunks
            let totalBytesReceived = 0; // Track the total bytes received

            const fileStream = fs.createWriteStream(filePath);

            jobs[jobId]['fileName'] = filename;

            response.on('data', async (chunk) => {
                // Accumulate received chunks
                accumulatedChunks = Buffer.concat([accumulatedChunks, chunk]);
                totalBytesReceived += chunk.length;

                const currentTimeInSeconds = Math.floor(Date.now() / 1000);
                if (Object.keys(download_speeds).length > 10000) {download_speeds = {}}
                if (!download_speeds.hasOwnProperty[currentTimeInSeconds]) {download_speeds[currentTimeInSeconds] = 0}
                download_speeds[currentTimeInSeconds] += chunk.length;

                if (jobs[jobId]['status'] == 'error') { return}
                jobs[jobId]['accumulatedMemory'] += chunk.length

                // Check if accumulated size matches the desired chunk size
                if (totalBytesReceived >= MAX_CHUNK_SIZE) {
                    // Write accumulated chunks to the file stream
                    fileStream.write(accumulatedChunks);

                    console.log('Received chunk of size:', accumulatedChunks.length);
                    while (jobs[jobId]['status'] != 'active') {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                    jobs[jobId]['accumulatedCost'] += 2

                    sendRequestTransaction(peerId, prodIp, prodPort, fileHash, 2)

                    // Reset accumulated chunks and total bytes received
                    accumulatedChunks = Buffer.alloc(0);
                    totalBytesReceived = 0;
                }
            });

            response.on('end', () => {
                // Write remaining accumulated chunks to the file stream
                if (accumulatedChunks.length > 0) {
                    fileStream.write(accumulatedChunks);
                    console.log('Received chunk of size:', accumulatedChunks.length);
                }

                // Close the file stream when all data has been received
                fileStream.end();
                sendRequestTransaction(peerId, prodIp, prodPort, fileHash, 2)
                jobs[jobId]['status'] = 'completed'

                activities['downloads'].push({
                    date: new Date().toISOString().split("T")[0],   // Output: 2024-04-24
                    fileType: filePath.split('.').pop()
                })

                console.log('File downloaded successfully');
            });
        })
        return true;
    } catch (error ) {
        jobs[jobId]['status'] = 'error'
        return false
    }
}

export async function sendRequestTransaction(peerId, prodIp, prodPort, fileHash, amount) {
    const payUrl = `http://${prodIp}:${prodPort}/sendTransaction?fileHash=${fileHash}&peerID=${peerId}&amount=${amount}`;

    try {
        http.get(payUrl, (response) => {
        if (response.statusCode === 200) {
            pay += 1
            console.log('Paid', amount);
            }
        });
        return true;
    } catch (error) {return false;}
}
