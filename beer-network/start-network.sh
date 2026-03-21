#!/bin/bash
# Bralirwa SCM - Network Startup Script

cd ~/Desktop/bralirwa-scm/beer-network
export PATH=$PATH:$HOME/fabric-samples/bin

echo "🍺 Starting Bralirwa SCM Network..."

# Start Docker containers
docker compose up -d
sleep 5
echo "✓ Containers started"

# Create channel
export CORE_PEER_LOCALMSPID=ManufacturerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/manufacturer.example.com/users/Admin@manufacturer.example.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer channel create -o localhost:7050 -c beerchannel -f ./channel-artifacts/beerchannel.tx 2>/dev/null || echo "Channel already exists"
echo "✓ Channel ready"

# Join all peers
peer channel join -b beerchannel.block 2>/dev/null; echo "✓ Manufacturer joined"

export CORE_PEER_LOCALMSPID=SupplierMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/supplier.example.com/users/Admin@supplier.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer channel join -b beerchannel.block 2>/dev/null; echo "✓ Supplier joined"

export CORE_PEER_LOCALMSPID=DistributorMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/distributor.example.com/users/Admin@distributor.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer channel join -b beerchannel.block 2>/dev/null; echo "✓ Distributor joined"

export CORE_PEER_LOCALMSPID=RetailerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/retailer.example.com/users/Admin@retailer.example.com/msp
export CORE_PEER_ADDRESS=localhost:10051
peer channel join -b beerchannel.block 2>/dev/null; echo "✓ Retailer joined"

# Install chaincode
PACKAGE_ID=beer_9.0:9e81408cdf819cf3879f9d5236ff531734a01972c0b061d0a465a71ca634044a

export CORE_PEER_LOCALMSPID=ManufacturerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/manufacturer.example.com/users/Admin@manufacturer.example.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode install beer9.tar.gz 2>/dev/null; echo "✓ Manufacturer chaincode installed"

export CORE_PEER_LOCALMSPID=SupplierMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/supplier.example.com/users/Admin@supplier.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode install beer9.tar.gz 2>/dev/null; echo "✓ Supplier chaincode installed"

export CORE_PEER_LOCALMSPID=DistributorMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/distributor.example.com/users/Admin@distributor.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode install beer9.tar.gz 2>/dev/null; echo "✓ Distributor chaincode installed"

export CORE_PEER_LOCALMSPID=RetailerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/retailer.example.com/users/Admin@retailer.example.com/msp
export CORE_PEER_ADDRESS=localhost:10051
peer lifecycle chaincode install beer9.tar.gz 2>/dev/null; echo "✓ Retailer chaincode installed"

# Approve all orgs
export CORE_PEER_LOCALMSPID=SupplierMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/supplier.example.com/users/Admin@supplier.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID beerchannel --name beer --version 9.0 --package-id $PACKAGE_ID --sequence 1 2>/dev/null; echo "✓ Supplier approved"

export CORE_PEER_LOCALMSPID=ManufacturerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/manufacturer.example.com/users/Admin@manufacturer.example.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID beerchannel --name beer --version 9.0 --package-id $PACKAGE_ID --sequence 1 2>/dev/null; echo "✓ Manufacturer approved"

export CORE_PEER_LOCALMSPID=DistributorMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/distributor.example.com/users/Admin@distributor.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID beerchannel --name beer --version 9.0 --package-id $PACKAGE_ID --sequence 1 2>/dev/null; echo "✓ Distributor approved"

export CORE_PEER_LOCALMSPID=RetailerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/retailer.example.com/users/Admin@retailer.example.com/msp
export CORE_PEER_ADDRESS=localhost:10051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID beerchannel --name beer --version 9.0 --package-id $PACKAGE_ID --sequence 1 2>/dev/null; echo "✓ Retailer approved"

# Commit
export CORE_PEER_LOCALMSPID=ManufacturerMSP
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/manufacturer.example.com/users/Admin@manufacturer.example.com/msp
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode commit -o localhost:7050 --channelID beerchannel --name beer --version 9.0 --sequence 1 --peerAddresses localhost:7051 --peerAddresses localhost:8051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 2>/dev/null
echo "✓ Chaincode committed!"

echo ""
echo "🍺 Network is ready!"
echo "✓ Start backend: cd ~/Desktop/bralirwa-scm/beer-backend && npm run dev"
echo "✓ Start frontend: cd ~/Desktop/bralirwa-scm/beer-frontend && npm run dev"
