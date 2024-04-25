import displayMenu from "./Libp2p/cli.js"
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { yamux } from '@chainsafe/libp2p-yamux'
import { ping } from '@libp2p/ping' // remove this after done testing
import { bootstrap } from '@libp2p/bootstrap'
import { mdns } from '@libp2p/mdns';
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { createPeerInfo, getKeyByValue } from './Libp2p/peer-node-info.js'
import { generateRandomWord, getPublicMultiaddr, bufferedFiles, recievedPayment } from './Libp2p/utils.js'
import geoip from 'geoip-lite';
import { handleRequestFile, handleDownloadFile, payForChunk, handlePayForChunk } from "./Libp2p/protocol.js"
import {EventEmitter} from 'node:events';
import { createHTTPGUI } from "./Libp2p/gui-connection.js"
import { identify } from '@libp2p/identify'


class Emitter extends EventEmitter {}

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

    const test_node2 = await createLibp2p({
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
            bootstrap({
                list: [
                    // bootstrap node here is generated from dig command
                    // '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
                    '/ip4/172.174.239.70/tcp/54166/p2p/12D3KooWNbUzkzHsYAA6aq4jnsrkfj99hKogPmqPGChPMWmkcxTx',
                    '/dnsaddr/ny5.bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
                ]
            })
        ],
        services: {
            identify: identify(),
            pubsub: gossipsub(options),
            dht: kadDHT({
                kBucketSize: 20,
                clientMode: true,
                selectors: {
                    pk: () => {
                        return 0;
                    }
                },
                validators: {
                    pk: () => {
                        return true;
                    }
                },
            })
        },
        config: {
            dht: {
                enabled: true,
                randomWalk: {
                    enabled: true,
                }
            
            }
            
        }
    });

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

    test_node2.addEventListener('peer:connect', async (event) => {
        const peerInfo = event.detail;
        console.log('A Peer ID ' + peerInfo + ' Connected with us!');
        // event.detail.
        // console.log(event.detail.multihash);
        // const peer = await nodes.peerRouting.findPeer(peerInfo);
        let conn = await test_node2.dial(peerInfo);
        console.log("peer who is dialed is "+conn.remotePeer);
        test_node2.peerStore.save(conn.remotePeer, conn.remoteAddr);
        // test_node2.services.dht.getMode()
        // test_node2.peerStore.all
        // test_node2.
        // for (const peer of await test_node2.peerStore.all()) {
        //     console.log(peer.addresses);
        //     console.log(peer.id);
        //     console.log(peer.metadata);
        //     console.log(peer.peerRecordEnvelope);
        //     console.log(peer.protocols);
        //     console.log(peer.tags);

        //     peer.
        //     p
        // }
        // await test_node2.peerStore.save(peerInfo, );

        // discoveredPeers.forEach(async x => {
        //     console.log("value of x is ",x);
            
            
        // })
        // nodes.services.dht.getClosestPeers()
        // nodes.services.dht.get
        // console.log(nodes.services.identify.)
        // // console.log(peer);
        // await nodes.dial(peer.multiaddrs);
        
        // // console.log(peer);
        // nodes.peerStore.patch(peerInfo, peer.multiaddrs);
        // nodes.peerStore.save(peerInfo, peer.multiaddrs);
    });

    test_node2.addEventListener('peer:discovery', (evt) => {
        try {
            const peerId = evt.detail.id;
            console.log(`Peer ${peerId} has discovered`)
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
    

    // Set up protocols
    const emitter = new Emitter();
    emitter.on('receivedChunk', async (price, producerMA) => {
        try {
            const stream = await test_node2.dialProtocol(producerMA, '/fileExchange/1.0.2');
            await payForChunk(stream, price);
        } catch (err) {console.log(err)}
    }) 
    test_node2.handle('/fileExchange/1.0.0', handleRequestFile);
    test_node2.handle('/fileExchange/1.0.1', ({ connection, stream }) => handleDownloadFile(stream, connection, bufferedFiles, emitter))
    test_node2.handle('/fileExchange/1.0.2',({ connection, stream }) => handlePayForChunk(connection, stream, recievedPayment))
    
    const stop = async (node) => {
        // stop libp2p
        await node.stop()
        console.log('\nNode has stopped: ', node.peerId)
        process.exit(0)
    }
    process.on('SIGTERM', () => stop(test_node2))
    process.on('SIGINT', () => stop(test_node2))
    createHTTPGUI(test_node2);

    displayMenu(discoveredPeers, test_node2, test_node);
}

main()