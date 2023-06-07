import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import {HardhatUserConfig, HttpNetworkUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import dotenv from "dotenv";
import yargs from "yargs";

const argv = yargs
    .option("network", {
        type: "string",
        default: "hardhat",
    })
    .help(false)
    .version(false).argv;

dotenv.config();
const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, API_URL, PRIVATE_KEY, PK} = process.env;

const DEFAULT_MNEMONIC =
    "garlic path pool various surface pitch put near dutch strong whisper letter";

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
    sharedNetworkConfig.accounts = [PK];
} else {
    sharedNetworkConfig.accounts = {
        mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
    };
}

if (["mainnet", "rinkeby", "kovan", "goerli"].includes(argv.network) && INFURA_KEY === undefined) {
    throw new Error(
        `Could not find Infura key in env, unable to connect to network ${argv.network}`,
    );
}

const userConfig: HardhatUserConfig = {
    solidity: {
        compilers: [
            {version: "0.7.6"},
            {version: "0.8.4"}
        ],
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000,
            }
        }
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
        },
        mainnet: {
            ...sharedNetworkConfig,
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
        },
        ArbitrumGoerli: {
            url: API_URL,
            accounts: [`0x${PRIVATE_KEY}`],
            gasPrice: 700000000,
            gas: 400000000,
        }
    },
    namedAccounts: {
        deployer: 0,
    },
    paths: {
        sources: 'contracts',
        deploy: 'src/deploy',
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
};
export default userConfig
