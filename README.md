# RentFun-summer

Usage
-----
### Install requirements with yarn:

```bash
yarn
```

### Compile

```bash
yarn hardhat compile
```

### test

```bash
yarn hardhat test
```

### deploy

Preparation:
- create `.env` file if it does not exist
- Set `MNEMONIC` in `.env`
- Set `INFURA_KEY` in `.env`
- Set `ETHERSCAN_API_KEY` in `.env`

For Arbitrum:
- Set `API_URL` in `.env`
- Set `PRIVATE_KEY` in `.env`


```bash
yarn hardhat --network <network> deploy
```
- network can be: ArbitrumGoerli, mainnet. add network to hardhat.config.ts if you'd like to support new network.



