#!/bin/bash
# Start the full Bralirwa SCM stack and deploy the current chaincode source.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="$ROOT_DIR/beer-network"

CHANNEL_NAME=${CHANNEL_NAME:-beerchannel}
CHAINCODE_NAME=${CHAINCODE_NAME:-beer}
CHAINCODE_VERSION=${CHAINCODE_VERSION:-1.0}
CHAINCODE_SEQUENCE=${CHAINCODE_SEQUENCE:-1}
CHAINCODE_LABEL=${CHAINCODE_LABEL:-beer_${CHAINCODE_VERSION}}
CHAINCODE_PACKAGE=${CHAINCODE_PACKAGE:-beer${CHAINCODE_VERSION//./}.tar.gz}
PEER_IMAGE=${PEER_IMAGE:-hyperledger/fabric-peer:2.5}
NODEENV_IMAGE=${NODEENV_IMAGE:-hyperledger/fabric-nodeenv:2.5}

cd "$NETWORK_DIR"

echo "Starting Bralirwa SCM..."
docker image inspect "$NODEENV_IMAGE" >/dev/null 2>&1 || docker pull "$NODEENV_IMAGE"

echo "Building application containers..."
docker compose build beer-backend beer-frontend

echo "Starting Docker Compose services..."
docker compose up -d
sleep 5

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

echo "Creating channel if needed..."
run_manufacturer channel create \
  -o localhost:7050 \
  -c "$CHANNEL_NAME" \
  -f "/work/channel-artifacts/$CHANNEL_NAME.tx" \
  --outputBlock "/work/$CHANNEL_NAME.block" || echo "Channel already exists"

echo "Joining peers to channel..."
run_peer ManufacturerMSP manufacturer.example.com 8051 channel join -b "/work/$CHANNEL_NAME.block" || true
run_peer SupplierMSP supplier.example.com 7051 channel join -b "/work/$CHANNEL_NAME.block" || true
run_peer DistributorMSP distributor.example.com 9051 channel join -b "/work/$CHANNEL_NAME.block" || true
run_peer RetailerMSP retailer.example.com 10051 channel join -b "/work/$CHANNEL_NAME.block" || true

if run_manufacturer lifecycle chaincode querycommitted -C "$CHANNEL_NAME" -n "$CHAINCODE_NAME" >/tmp/beer-chaincode-query.out 2>/dev/null; then
  echo "Chaincode already committed:"
  cat /tmp/beer-chaincode-query.out
else
  echo "Packaging current chaincode source..."
  docker run --rm \
    -v "$PWD:/work" \
    -w /work \
    "$PEER_IMAGE" peer lifecycle chaincode package "/work/$CHAINCODE_PACKAGE" \
      --path /work/chaincode/beer-supply-chain \
      --lang node \
      --label "$CHAINCODE_LABEL"

  PACKAGE_ID=$(docker run --rm -v "$PWD:/work" -w /work "$PEER_IMAGE" \
    peer lifecycle chaincode calculatepackageid "/work/$CHAINCODE_PACKAGE")

  echo "Installing chaincode package $PACKAGE_ID..."
  run_peer ManufacturerMSP manufacturer.example.com 8051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
  run_peer SupplierMSP supplier.example.com 7051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
  run_peer DistributorMSP distributor.example.com 9051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true
  run_peer RetailerMSP retailer.example.com 10051 lifecycle chaincode install "/work/$CHAINCODE_PACKAGE" || true

  echo "Approving chaincode for all orgs..."
  run_peer SupplierMSP supplier.example.com 7051 lifecycle chaincode approveformyorg \
    -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
    --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE"
  run_peer ManufacturerMSP manufacturer.example.com 8051 lifecycle chaincode approveformyorg \
    -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
    --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE"
  run_peer DistributorMSP distributor.example.com 9051 lifecycle chaincode approveformyorg \
    -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
    --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE"
  run_peer RetailerMSP retailer.example.com 10051 lifecycle chaincode approveformyorg \
    -o localhost:7050 --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" \
    --version "$CHAINCODE_VERSION" --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE"

  echo "Committing chaincode..."
  run_manufacturer lifecycle chaincode commit \
    -o localhost:7050 \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" \
    --version "$CHAINCODE_VERSION" \
    --sequence "$CHAINCODE_SEQUENCE" \
    --peerAddresses localhost:7051 \
    --peerAddresses localhost:8051 \
    --peerAddresses localhost:9051 \
    --peerAddresses localhost:10051
fi

echo ""
echo "Bralirwa SCM is ready"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001/health"
echo ""
echo "Logs: cd beer-network && docker compose logs -f beer-backend beer-frontend"
