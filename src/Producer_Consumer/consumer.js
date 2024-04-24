
import fs from 'fs';
import * as path from 'path';

import { createGrpcClient } from '../Market/market.js'
const market = createGrpcClient();

export class Consumer {
    /*
        Description:
            Asks the market server to send all the producers currently serving the file.
        Parameters: 
            [String] hash -> the hash of the file you want
        Returns:
            [false] on query error
            [empty List] if no one is serving the file
            [List of producer IPs with their corresponding bid] otherwise

    */
    static viewProducers(hash) {
        return new Promise((resolve, reject) => {
            const args = {
                fileHash: hash
            };
    
            market.checkHolders(args, (error, response) => {
                if (error) {
                    console.error('Error: ', error);
                    reject(error);
                } else {
                    console.log('Producers for file', hash, ": ", response);
                    var users = response.holders; // holders is a list of Users
                    resolve(users);
                }
            });
        });
    }
}
