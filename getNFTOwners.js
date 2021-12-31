// Original version of this script was created by 0xLarry for TypeScript
// Early code included help from 0xWolfgang, mr_rogers, Arthur, Mike LaRocca, BHIKTOR, Eliseo, PFC, Jimmy Le, astromartian 
// Ported from TypeScript to JavaScript by Midas
// Added Bottleneck to avoid getting shut down by Mantle

// This script will use Mantle to query the blockchain 
// It will get the owner of each token_id in the given contract
// It will then save it to a CSV file

// Libraries required
const fs = require("fs");
const axios = require("axios");
var Bottleneck = require("bottleneck/es5");
const limiter = new Bottleneck({
  minTime: 100
});

// Spaceloot Address to query
const CONTRACT_ADDRESS = "terra1q7jnhm5ju8zqua47yu3007879jncevt9ev4kk6";

// Range and ids that we will query
const START_ID = 0;
const END_ID = 1999;
const IDS_PER_QUERY = 1000;

function generateQuery(id) {
  // NOTE: GraphQL does not allow using a number as the name of a query. Therefore instead of id,
  // we use `id_${id}`
  return `  
    id_${id}: WasmContractsContractAddressStore(
      ContractAddress: "${CONTRACT_ADDRESS}",
      QueryMsg: "{\\"owner_of\\":{\\"token_id\\":\\"${id}\\"}}"
    ) { 
      Result 
    }
  `;
}

function generateQueries(start, end) {
  let queries = [];
  for (let id = start; id < end; id++) {
    queries.push(generateQuery(id));
  }
  return `
    query {
      ${queries.join("\n")}
    }
  `;
}

async function fetchNFTOwners() {
  let owners = {};
  let start = START_ID;
  let end = start + IDS_PER_QUERY;

  while (start < end) {
    process.stdout.write(`querying owners of id ${start} to ${end - 1}... `);
    const response = await limiter.schedule(() => axios.post("https://mantle.terra.dev/", {
      query: generateQueries(start, end),
    }));
    console.log("success!");

    for (const [key, value] of Object.entries(response.data.data)) {
      const id = parseInt(key.slice(3));
      const ownerOfResponse = JSON.parse(value.Result);
      owners[id] = ownerOfResponse.owner;
    }

    start = end;
    end += IDS_PER_QUERY;
    if (end > END_ID) end = END_ID;
  }

  return owners;
}

(async function () {
  const owners = await fetchNFTOwners();
  const csv = Object.keys(owners).map(key => {
    return `${key},${owners[key]}`;
  });

  fs.writeFileSync("./owners.csv", csv.join("\n"));
})();