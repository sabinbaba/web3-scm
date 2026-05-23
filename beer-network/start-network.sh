#!/bin/bash
# Bralirwa SCM - Network Startup Script
set -euo pipefail

cd ~/web3-scm/beer-network

CHANNEL_NAME=beerchannel
CHAINCODE_NAME=beer
CHAINCODE_VERSION=9.0
CHAINCODE_SEQUENCE=1
CHAINCODE_PACKAGE=beer9.tar.gz
PEER_IMAGE=hyperledger/fabric-peer:2.5
NODEENV_IMAGE=hyperledger/fabric-nodeenv:2.5

echo "Starting Bralirwa SCM Network..."

docker image inspect "$NODEENV_IMAGE" >/dev/null 2>&1 || docker pull "$NODEENV_IMAGE"
docker compose up -d
sleep 5
echo "Containers started"

run_peer() {
  local msp_id=$1
  local domain=$2
  local address=$3
  shift 3

  docker run --rm --network host \
    -v "$PWD:/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    -e CORE_PEER_LOCALMSPID="$msp_id" \
    -e CORE_PEER_MSPCONFIGPATH="/work/organizations/peerOrganizations/$domain/users/Admin@$domain/msp" \
    -e CORE_PEER_ADDRESS="localhost:$address" \
    "$PEER_IMAGE" peer "$@"
}

run_manufacturer() {
  run_peer ManufacturerMSP manufacturer.example.com 8051 "$@"
}

PACKAGE_ID=$(docker run --rm -v "$PWD:/work" -w /work "$PEER_IMAGE" \
  peer lifecycle chaincode calculatepackageid "/work/$CHAINCODE_PACKAGE")

run_manufacturer channel create \
  -o localhost:7050 \
  -c "$CHANNEL_NAME" \
  -f "/work/channel-artifacts/$CHANNEL_NAME.tx" \
  --outputBlock "/work/$CHANNEL_NAME.block" || echo "Channel already exists"
echo "Channel ready"

run_peer ManufacturerMSP manufacturer.example.com 8051 channel join -b "/work/$CHANNEL_NAME.block" || true
run_peer SupplierMSP supplier.example.com 7051 channel join -b "/work/$CHANNEL_NAME.block" || true
run_peer DistributorMSP distributor.example.com 9051 channel join -b "/work/$CHANNEL_NAME.block" || true
run_peer RetailerMSP retailer.example.com 10051 channel join -b "/work/$CHANNEL_NAME.block" || true
echo "Peers joined"

run_peer ManufacturerMSP manufacturer.example.com 8051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
run_peer SupplierMSP supplier.example.com 7051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
run_peer DistributorMSP distributor.example.com 9051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
run_peer RetailerMSP retailer.example.com 10051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
echo "Chaincode installed"

run_peer SupplierMSP supplier.example.com 7051 lifecycle chaincode approveformyorg \
  -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE" || true
run_peer ManufacturerMSP manufacturer.example.com 8051 lifecycle chaincode approveformyorg \
  -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE" || true
run_peer DistributorMSP distributor.example.com 9051 lifecycle chaincode approveformyorg \
  -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE" || true
run_peer RetailerMSP retailer.example.com 10051 lifecycle chaincode approveformyorg \
  -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE" || true
echo "Chaincode approved"

run_manufacturer lifecycle chaincode commit \
  -o localhost:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --sequence "$CHAINCODE_SEQUENCE" \
  --peerAddresses localhost:7051 \
  --peerAddresses localhost:8051 \
  --peerAddresses localhost:9051 \
  --peerAddresses localhost:10051 || true
echo "Chaincode committed"

echo ""
echo "Network is ready"
echo "Start backend: cd ~/web3-scm/beer-backend && npm run dev"
echo "Start frontend: cd ~/web3-scm/beer-frontend && npm run dev"
