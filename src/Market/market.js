import { fileURLToPath } from 'url';
import { dirname } from 'path';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = __dirname + '/market.proto';
const packageDefinition = protoLoader.loadSync(
    PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    }
);

let node;
const getNode = (n) => {
    node = n;
    console.log(node.peerId);
}

var market_proto = grpc.loadPackageDefinition(packageDefinition).market;


let target = "127.0.0.1:5000";

const server = new grpc.Server();
server.addService(market_proto.Market.service, { RegisterFile: registerFile, CheckHolders: checkHolders });
server.bindAsync(target, grpc.ServerCredentials.createInsecure(), (error) => {
    console.log('Market server running on', target)
    // server.start();
});


// ######## Registerfile Function #########
async function registerFile(call, callback) {
    let newUser = call.request.user;
    let cid = call.request.fileHash;
    console.log("------------------register file---------------------");

    const keyEncoded = new TextEncoder('utf8').encode(cid);
    const userInfo = `${newUser.id}/${newUser.name}/${newUser.ip}/${newUser.port}/${newUser.price}`;
    const valueEncoded = new TextEncoder('utf8').encode(userInfo);

    try {
        // console.log(`node Id checking: ${node.peerId}`);
        console.log(`node Id checking: ${newUser.id}`);

        let existingUserStr;
        const exist = node.services.dht.get(keyEncoded);
        for await (const queryEvent of exist) {
            existingUserStr = new TextDecoder('utf8').decode(queryEvent.value);
        }
        console.log("exist value is "+ existingUserStr);
        const curValue = existingUserStr.split('\n');
        
        for (let i = 0; i < curValue.length; i++) {
            const values = curValue[i].split('/'); // [newUser.id, newUser.name, newUser.ip, newUser.port, newUser.price]

             // First time to register file
            if (values[0] == '' || values[0] == undefined) {
                const putv = node.services.dht.put(keyEncoded, valueEncoded);
                for await (const queryEvent of putv) {
                    // Handle each query event
                    // console.log('Query event from put(): ', queryEvent);
                    const message = new TextDecoder('utf8').decode(queryEvent.value);
                    console.log("value of each qeury is ", message);
                }
            }

            // The file is already registered
            else {
                console.log("The File already exist");
                console.log(`value: ${values[0]}`);
                // console.log(`node Id: ${node.peerId}`);
                console.log(`node Id: ${newUser.id}`);

                // Same User
                // if (values[0] == node.peerId)
                if (values[0] == newUser.id) 
                {
                    console.log("Same User try to upload existing file");
                    if (values[4] == newUser.price) {
                        console.log("You already uploaded same file with the same price");
                        return;
                    }
                    else {
                        // change the price in new User. Need to Update User value.
                        console.log("Price is changed");
                        values[4] = newUser.price;
                        curValue[i] = values.toString().replaceAll(',', '/');
                        existingUserStr = curValue.toString().replaceAll(',', '\n');
                        const newValueEncoded = new TextEncoder('utf8').encode(existingUserStr);


                        const putv = node.services.dht.put(keyEncoded, newValueEncoded);
                        for await (const queryEvent of putv) {
                            const message = new TextDecoder('utf8').decode(queryEvent.value);
                            console.log("value of each qeury is ", message);
                        }
                        break;
                    }
                }
                // Different User
                else {
                    const newValue = existingUserStr+"\n"+userInfo;
                    const newValueEncoded = new TextEncoder('utf8').encode(newValue);
                    const putv = node.services.dht.put(keyEncoded, newValueEncoded);
                    for await (const queryEvent of putv) {
                        const message = new TextDecoder('utf8').decode(queryEvent.value);
                        console.log("value of each qeury is ", message);
                    }
                }
            }
        }

       
        
    }
    catch (error) {
        console.log("First time to upload the file from err");
        const putv = node.services.dht.put(keyEncoded, valueEncoded);
        for await (const queryEvent of putv) {
            const message = new TextDecoder('utf8').decode(queryEvent.value);
            console.log("value of each qeury is ", message);
        }
    }
    node.services.dht.refreshRoutingTable();

    const value = node.services.dht.get(keyEncoded);
    for await (const queryEvent of value) {
        const message = new TextDecoder('utf8').decode(queryEvent.value);
        console.log("value of each qeury is ", message);
    }
    
    console.log("----------------end register file-------------------");
    callback(null, {});
}


// ######## CheckHolders Function #########
async function checkHolders(call, callback) {
    const cid = call.request.fileHash;
    console.log("------------------check holders---------------------");
    
    try {
        console.log("key in the checkholders is "+cid);
        
        const keyEncoded = new TextEncoder('utf8').encode(cid);

        let message;

        node.services.dht.refreshRoutingTable();
        const value = node.services.dht.get(keyEncoded);
        for await (const queryEvent of value) {
            message = new TextDecoder('utf8').decode(queryEvent.value);
        }
       
        const values = message.split('\n');

        const holders = [];

        values.forEach(user => {
            const userInfo = user.split('/')

            const foundUser = {
                id: userInfo[0],
                name: userInfo[1],
                ip: userInfo[2],
                port: userInfo[3],
                price: userInfo[4],
            };

            holders.push(foundUser);
        })

        await callback(null, { holders: holders });

    } catch (error) {
        console.log("Wrong filehash or there is no file you may want");
    }
    console.log("----------------end check holders-------------------");
}

/**
 *  Creates a Grpc client with the given target("ip:port")
 *  Params: target("ip:port")
 *  Return: grpc client
 */
function createGrpcClient(){
    return new market_proto.Market(target, grpc.credentials.createInsecure());
}

export { getNode, createGrpcClient }