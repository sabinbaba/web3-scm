'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const os = require('os');

function resolveNetworkPath(networkPath) {
  const configuredPath = networkPath || path.resolve(__dirname, '../../../beer-network');

  if (configuredPath === '~') {
    return os.homedir();
  }

  if (configuredPath.startsWith('~/')) {
    return path.join(os.homedir(), configuredPath.slice(2));
  }

  return path.resolve(configuredPath);
}

const NETWORK_PATH = resolveNetworkPath(process.env.FABRIC_NETWORK_PATH);
const CHANNEL = process.env.FABRIC_CHANNEL || 'beerchannel';
const CHAINCODE = process.env.FABRIC_CHAINCODE || 'beer';
const FABRIC_CONNECTION_MODE = process.env.FABRIC_CONNECTION_MODE || 'local';

function fabricAddress(hostname, localPort) {
  if (FABRIC_CONNECTION_MODE === 'docker') {
    return `${hostname}:${localPort}`;
  }

  return `localhost:${localPort}`;
}

function ordererAddress() {
  if (FABRIC_CONNECTION_MODE === 'docker') {
    return 'orderer.example.com:7050';
  }

  return 'localhost:7050';
}

const ORGS = {
  SupplierMSP: {
    mspId: 'SupplierMSP',
    peer: 'peer0.supplier.example.com',
    peerAddress: fabricAddress('peer0.supplier.example.com', 7051),
    domain: 'supplier.example.com',
  },
  ManufacturerMSP: {
    mspId: 'ManufacturerMSP',
    peer: 'peer0.manufacturer.example.com',
    peerAddress: fabricAddress('peer0.manufacturer.example.com', 8051),
    domain: 'manufacturer.example.com',
  },
  DistributorMSP: {
    mspId: 'DistributorMSP',
    peer: 'peer0.distributor.example.com',
    peerAddress: fabricAddress('peer0.distributor.example.com', 9051),
    domain: 'distributor.example.com',
  },
  RetailerMSP: {
    mspId: 'RetailerMSP',
    peer: 'peer0.retailer.example.com',
    peerAddress: fabricAddress('peer0.retailer.example.com', 10051),
    domain: 'retailer.example.com',
  },
};

function loadIdentity(mspId) {
  const org = ORGS[mspId];
  if (!org) throw new Error(`Unknown MSP: ${mspId}`);

  const adminPath = path.join(
    NETWORK_PATH,
    'organizations/peerOrganizations',
    org.domain,
    `users/Admin@${org.domain}/msp`
  );

  const certDir = path.join(adminPath, 'signcerts');
  const certFiles = fs.readdirSync(certDir);
  if (certFiles.length === 0) throw new Error(`No cert found for ${mspId}`);
  const certificate = fs.readFileSync(path.join(certDir, certFiles[0])).toString();

  const keyDir = path.join(adminPath, 'keystore');
  const keyFiles = fs.readdirSync(keyDir);
  if (keyFiles.length === 0) throw new Error(`No key found for ${mspId}`);
  const privateKey = fs.readFileSync(path.join(keyDir, keyFiles[0])).toString();

  console.log(`✓ Loaded admin identity for ${mspId}`);
  return { certificate, privateKey };
}

function buildConnectionProfile(mspId) {
  const org = ORGS[mspId];

  // Build all peers for endorsement
  const allPeers = {};
  const channelPeers = {};

  Object.values(ORGS).forEach(o => {
    allPeers[o.peer] = {
      url: `grpc://${o.peerAddress}`,
      grpcOptions: {
        'ssl-target-name-override': o.peer,
        hostnameOverride: o.peer,
      },
    };
    channelPeers[o.peer] = {
      endorsingPeer: true,
      chaincodeQuery: true,
      ledgerQuery: true,
      eventSource: true,
    };
  });

  return {
    name: 'beer-network',
    version: '1.0.0',
    client: {
      organization: mspId,
      connection: { timeout: { peer: { endorser: '300' } } },
    },
    organizations: {
      [mspId]: {
        mspid: mspId,
        peers: [org.peer],
      },
    },
    peers: allPeers,
    orderers: {
      'orderer.example.com': {
        url: `grpc://${ordererAddress()}`,
      },
    },
    channels: {
      [CHANNEL]: {
        orderers: ['orderer.example.com'],
        peers: channelPeers,
      },
    },
  };
}

async function getContract(mspId) {
  const { certificate, privateKey } = loadIdentity(mspId);

  const wallet = await Wallets.newInMemoryWallet();
  await wallet.put('admin', {
    credentials: { certificate, privateKey },
    mspId,
    type: 'X.509',
  });

  const connectionProfile = buildConnectionProfile(mspId);

  const gateway = new Gateway();
  await gateway.connect(connectionProfile, {
    wallet,
    identity: 'admin',
    discovery: { enabled: false, asLocalhost: FABRIC_CONNECTION_MODE !== 'docker' },
  });

  const network = await gateway.getNetwork(CHANNEL);
  const contract = network.getContract(CHAINCODE);

  return { gateway, contract };
}

async function queryChaincode(mspId, fcn, args = []) {
  let gateway;
  try {
    console.log(`→ Query [${mspId}] ${fcn}(${args.join(', ')})`);
    const result = await getContract(mspId);
    gateway = result.gateway;
    const contract = result.contract;

    const response = await contract.evaluateTransaction(fcn, ...args);
    const data = response.toString();
    console.log(`← Query success`);
    return JSON.parse(data);
  } catch (error) {
    console.error(`✗ Query failed [${fcn}]:`, error.message);
    throw error;
  } finally {
    if (gateway) gateway.disconnect();
  }
}

async function invokeChaincode(mspId, fcn, args = []) {
  let gateway;
  try {
    console.log(`→ Invoke [${mspId}] ${fcn}(${args.join(', ')})`);
    const result = await getContract(mspId);
    gateway = result.gateway;
    const contract = result.contract;

    const response = await contract.submitTransaction(fcn, ...args);
    const data = response.toString();
    console.log(`← Invoke success`);
    return JSON.parse(data);
  } catch (error) {
    console.error(`✗ Invoke failed [${fcn}]:`, error.message);
    throw error;
  } finally {
    if (gateway) gateway.disconnect();
  }
}

module.exports = { queryChaincode, invokeChaincode, ORGS };
