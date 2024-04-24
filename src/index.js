// Libraries
import "dotenv/config.js";                  // Imports .env file
import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { kadDHT } from '@libp2p/kad-dht';
import { yamux } from '@chainsafe/libp2p-yamux';
import { ping } from '@libp2p/ping'; // remove this after done testing
import { bootstrap } from '@libp2p/bootstrap';
import { mdns } from '@libp2p/mdns';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import geoip from 'geoip-lite';
import { generateKeyPairFromSeed } from "@libp2p/crypto/keys";
import { createFromPrivKey } from "@libp2p/peer-id-factory";

// Our functions
import displayMenu from "./Libp2p/cli.js";
import { createPeerInfo, getKeyByValue } from './Libp2p/peer-node-info.js';
import { generateRandomWord, getPublicMultiaddr, bufferedFiles, recievedPayment } from './Libp2p/utils.js';
import { createAPI } from "./API/api.js";
import { server } from "./Producer_Consumer/http_server.js";
import { getNode } from "./Market/market.js";

const options = {
    emitSelf: true, // Example: Emit to self on publish
    gossipIncoming: true, // Example: Automatically gossip incoming messages
    fallbackToFloodsub: true, // Example: Fallback to floodsub if gossipsub is not supported
    floodPublish: false, // Example: Send self-published messages to all peers
    doPX: false, // Example: Enable PX
    // msgIdFn: (message) => message.from + message.seqno.toString('hex'), // Example: Custom message ID function
    signMessages: true // Example: Sign outgoing messages
}


// export { test_node2, test_node }
async function main() {
    // displayMenu(null, test_node)

    // libp2p node logic
    const test_node = await createLibp2p({
        // peerId: customPeerId,
        addresses: {
            // add a listen address (localhost) to accept TCP connections on a random port
            listen: ['/ip4/0.0.0.0/tcp/0']
        },
        transports: [
            tcp()
        ],
        streamMuxers: [
            yamux()
        ],
        connectionEncryption: [
            noise()
        ],
        peerDiscovery: [
            mdns(),
            bootstrap({
                list: [
                    // bootstrap node here is generated from dig command
                    '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
                ]
            })
        ],
        services: {
            pubsub: gossipsub(options),
            dht: kadDHT({
                kBucketSize: 20,
            }),
            ping: ping({
                protocolPrefix: 'ipfs',
            }),
        }
    });

    const test_node_2_options = {
        addresses: {
            // add a listen address (localhost) to accept TCP connections on a random port
            listen: ['/ip4/0.0.0.0/tcp/0']
        },
        transports: [
            tcp()
        ],
        streamMuxers: [
            yamux()
        ],
        connectionEncryption: [
            noise()
        ],
        peerDiscovery: [
            mdns(),
            // Bootstrap nodes are initialized as entrypoints into the peer node network
            // bootstrap({
            //     list: [
            //         // bootstrap node here is generated from dig command
            //         '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
            //         // '/ip4/172.174.239.70/tcp/62525/p2p/12D3KooWLpSX6gvBHcDs1qyBckj5bvV3dNR5Jdbm9NtDCap85GiV'
            //     ]
            // })
        ],
        services: {
            pubsub: gossipsub(options),
            dht: kadDHT({
                kBucketSize: 20,
            })
        }
    }

    // Configuring based on .env file
    if (process.env.NODE_PORT) {
        test_node_2_options.addresses['listen'] = [`/ip4/0.0.0.0/tcp/${process.env.NODE_PORT}`]
    }
    if (process.env.BOOTSTRAP_MULTI) {
        test_node_2_options.peerDiscovery.push(bootstrap({ list: [process.env.BOOTSTRAP_MULTI] }))
    }
    if (process.env.SEED) {
        const seedBytes = Uint8Array.from({ length: 32, 0: process.env.SEED });
        const secret = await generateKeyPairFromSeed("ed25519", seedBytes);
        const peerId = await createFromPrivKey(secret);
        test_node_2_options.peerId = peerId;
    }

    const test_node2 = await createLibp2p(test_node_2_options);
    
    await test_node.start();
    await test_node2.start();

    

    console.log('Test Node 2 has started:', test_node2.peerId);
    console.log("Actively searching for peers on the local network...");
    // console.log("Multiaddr of Test Node 2:", getMultiaddrs(test_node2))
    test_node2.services.pubsub.start()
    test_node.services.pubsub.start()
    test_node.services.pubsub.subscribe('transaction')
    
    // Gossip Sub implementation 
    test_node.services.pubsub.addEventListener('message', (message) => {
        console.log(`first node, ${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
    })
    test_node2.services.pubsub.addEventListener('message', (message) => {
        console.log(`second node, ${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
    })  

    const discoveredPeers = new Map()
    const ipAddresses = [];
    let local_peer_node_info = {};
    createAPI(test_node2, discoveredPeers);
    test_node2.addEventListener('peer:discovery', (evt) => {
        try {
            const peerId = evt.detail.id;
            console.log(`Peer ${peerId} has disconnected`)
            const multiaddrs = evt.detail.multiaddrs;

            ipAddresses.length = 0;

            multiaddrs.forEach(ma => {
                const multiaddrString = ma.toString();
                const ipRegex = /\/ip4\/([^\s/]+)/;
                const match = multiaddrString.match(ipRegex);
                const ipAddress = match && match[1];

                if(ipAddress) {
                    ipAddresses.push(ipAddress);
                }
            });

            let peerInfo = new Object();

            ipAddresses.forEach(ip => {
                const location = geoip.lookup(ip);
                peerInfo = createPeerInfo(location, peerId, multiaddrs[1], peerId.publicKey);
            });

            // console.log(evt.detail);
            // Get non 127... multiaddr and convert the object into a string for parsing
            const nonlocalMultaddr = evt.detail.multiaddrs.filter(addr => !addr.toString().startsWith('/ip4/127.0.0.')).toString();
            // console.log(nonlocalMultaddr);
            // Extract IP address
            const ipAddress = nonlocalMultaddr.split('/')[2];
            // Extract port number
            const portNumber = nonlocalMultaddr.split('/')[4];
            // console.log('IP address:', ipAddress);
            // console.log('Port number:', portNumber);

            local_peer_node_info = {ip_address: ipAddress, port : portNumber}

            const randomWord = generateRandomWord();
            discoveredPeers.set(randomWord, peerInfo);
            // console.log("Discovered Peers: ", discoveredPeers);
            console.log('\nDiscovered Peer with PeerId: ', peerId);
            // console.log("IP addresses for this event:", ipAddresses);
        } catch (error) {
            console.error("Error occured when connecting to node", error)
        }
    });


    test_node2.addEventListener('peer:disconnect', (evt) => {
        try {
            const peerId = evt.detail;
            console.log(`Peer ${peerId} has disconnected`)
            console.log(`\nPeer with ${peerId} disconnected`)
            const keyToRemove = getKeyByValue(discoveredPeers, peerId);
            if (keyToRemove !== null) {
                discoveredPeers.delete(keyToRemove);
            } else {
                console.log("PeerId not found in the map.");
            }
        } catch (error) {
            console.log("Error occured when disconnecting", error)
        }
    });

    const publicMulti = await getPublicMultiaddr(test_node2)
    console.log(publicMulti);
    test_node2.getMultiaddrs().forEach((addr) => {
        console.log(addr.toString())
    })

    getNode(test_node2);
    
    const stop = async (node) => {
        // stop libp2p
        await node.stop()
        console.log('\nNode has stopped: ', node.peerId)
        process.exit(0)
    }
    process.on('SIGTERM', () => stop(test_node2))
    process.on('SIGINT', () => stop(test_node2))
    displayMenu(discoveredPeers, test_node2, test_node);
    
}

main()