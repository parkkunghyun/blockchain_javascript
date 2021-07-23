"use strict";

//파이썬 ds와 똑같다
const CryptoJS = require("crypto-js");
const merkle = require("merkle");
const random = require("random");

const ut = require("./utils");

class BlockHeader {
    // 미친 ...  다넣었음!! 머클루트도 있네
    //이러면 블록바디정보가 블록헤더에 요약되서 암호화해서 들어가있다
    // 난이도도 조절가능인듯
    constructor(version, index, previousHash, timestamp, merkleRoot, difficulty, nonce) {
        this.version = version;
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.merkleRoot = merkleRoot;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

// 블록에 대한 정의는 걍 헤더와 바디!
class Block {
    constructor(header, data) {
        this.header = header;
        this.data = data;
    }
}

/**
 * TODO: Use database to store the data permanently.
 * A current implemetation stores blockchain in local volatile memory.
 */
var blockchain = [getGenesisBlock()];

function getBlockchain() { return blockchain; }
//그냥 블록체인 리턴과 마지막꺼 리턴하는거
function getLatestBlock() { return blockchain[blockchain.length - 1]; }

// 제네시스는 코드상에 모든정보를 하드코딩!!!
// 타임스탬프는 비트코인 따라한거!
// data는 비트코인 데이터따라한거 아무거나 넣는것도 비슷


function getGenesisBlock() {
    const version = "1.0.0";
    const index = 0;
    const previousHash = '0'.repeat(64);
    const timestamp = 1231006505; // 01/03/2009 @ 6:15pm (UTC)
    const difficulty = 0;
    const nonce = 0;
    const data = ["The Times 03/Jan/2009 Chancellor on brink of second bailout for banks"];

    const merkleTree = merkle("sha256").sync(data); //data 상당히 중요!!

    const merkleRoot = merkleTree.root() || '0'.repeat(64);

    const header = new BlockHeader(version, index, previousHash, timestamp, merkleRoot, difficulty, nonce);
    return new Block(header, data);
}

function generateNextBlock(blockData) {
    const previousBlock = getLatestBlock();
    const currentVersion = ut.getCurrentVersion();
    const nextIndex = previousBlock.header.index + 1;
    const previousHash = calculateHashForBlock(previousBlock);
    const nextTimestamp = ut.getCurrentTimestamp();
    const difficulty = getDifficulty(getBlockchain());

    const merkleTree = merkle("sha256").sync(blockData);
    const merkleRoot = merkleTree.root() || '0'.repeat(64);

    const newBlockHeader = findBlock(currentVersion, nextIndex, previousHash, nextTimestamp, merkleRoot, difficulty);
    return new Block(newBlockHeader, blockData);
}

function addBlock(newBlock) {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        return true;
    }
    return false;
}

function mineBlock(blockData) {
    const newBlock = generateNextBlock(blockData);

    if (addBlock(newBlock)) {
        const nw = require("./network");

        nw.broadcast(nw.responseLatestMsg());
        return newBlock;
    }
    else {
        return null;
    }
}

/**
 * TODO: Implement a stop mechanism.
 * A current implementation doesn't stop until finding matching block.
 */
//논스값을 찾는과정
//논스값을 1씩증가!! 문제애 조건이 맞는지 맞으면 리턴 함
//
function findBlock(currentVersion, nextIndex, previoushash, nextTimestamp, merkleRoot, difficulty) {
    var nonce = 0;
    while (true) {
        var hash = calculateHash(currentVersion, nextIndex, previoushash, nextTimestamp, merkleRoot, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new BlockHeader(currentVersion, nextIndex, previoushash, nextTimestamp, merkleRoot, difficulty, nonce);
        }
        nonce++;
    }
}
// 난이도가 올라갈수록 0이 증가!! 가변하는 난이도를 보여줌
function hashMatchesDifficulty(hash, difficulty) {
    const hashBinary = ut.hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashBinary.startsWith(requiredPrefix);
}

function calculateHash(version, index, previousHash, timestamp, merkleRoot, difficulty, nonce) {
    return CryptoJS.SHA256(version + index + previousHash + timestamp + merkleRoot + difficulty + nonce).toString().toUpperCase();
}

function calculateHashForBlock(block) {
    return calculateHash(
        block.header.version,
        block.header.index,
        block.header.previousHash,
        block.header.timestamp,
        block.header.merkleRoot,
        block.header.difficulty,
        block.header.nonce
    );
}

const BLOCK_GENERATION_INTERVAL = 10; // in seconds
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10; // in blocks

function getDifficulty(aBlockchain) {
    const latestBlock = aBlockchain[aBlockchain.length - 1];
    if (latestBlock.header.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.header.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    }
    return latestBlock.header.difficulty;
}

function getAdjustedDifficulty(latestBlock, aBlockchain) {
    const prevAdjustmentBlock = aBlockchain[aBlockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeTaken = latestBlock.header.timestamp - prevAdjustmentBlock.header.timestamp;
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;


    //난이도를 조절하게 끔
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.header.difficulty + 1;
    }
    else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.header.difficulty - 1;
    }
    else {
        return prevAdjustmentBlock.header.difficulty;
    }
}

function isValidBlockStructure(block) {
    return typeof(block.header.version) === 'string'
        && typeof(block.header.index) === 'number'
        && typeof(block.header.previousHash) === 'string'
        && typeof(block.header.timestamp) === 'number'
        && typeof(block.header.merkleRoot) === 'string'
        && typeof(block.header.difficulty) === 'number'
        && typeof(block.header.nonce) === 'number'
        && typeof(block.data) === 'object';
}

function isValidTimestamp(newBlock, previousBlock) {
    return (previousBlock.header.timestamp - 60 < newBlock.header.timestamp)
        && newBlock.header.timestamp - 60 < ut.getCurrentTimestamp();
}

function isValidNewBlock(newBlock, previousBlock) {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    else if (previousBlock.header.index + 1 !== newBlock.header.index) {
        console.log("Invalid index");
        return false;
    }
    else if (calculateHashForBlock(previousBlock) !== newBlock.header.previousHash) {
        console.log("Invalid previousHash");
        return false;
    }
    else if (
        (newBlock.data.length !== 0 && (merkle("sha256").sync(newBlock.data).root() !== newBlock.header.merkleRoot))
        || (newBlock.data.length === 0 && ('0'.repeat(64) !== newBlock.header.merkleRoot))
    ) {
        console.log("Invalid merkleRoot");
        return false;
    }
    else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    }
    else if (!hashMatchesDifficulty(calculateHashForBlock(newBlock), newBlock.header.difficulty)) {
        console.log("Invalid hash: " + calculateHashForBlock(newBlock));
        return false;
    }
    return true;
}

function isValidChain(blockchainToValidate) {
    if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(getGenesisBlock())) {
        return false;
    }
    var tempBlocks = [blockchainToValidate[0]];
    for (var i = 1; i < blockchainToValidate.length; i++) {
        if (isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
            tempBlocks.push(blockchainToValidate[i]);
        }
        else { return false; }
    }
    return true;
}

function replaceChain(newBlocks) {
    if (
        isValidChain(newBlocks)
        && (newBlocks.length > blockchain.length || (newBlocks.length === blockchain.length) && random.boolean())
    ) {
        const nw = require("./network");

        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newBlocks;
        nw.broadcast(nw.responseLatestMsg());
    }
    else { console.log("Received blockchain invalid"); }
}

function getBlockVersion(index) {
    return blockchain[index].header.version;
}

module.exports = {
    getBlockchain,
    getLatestBlock,
    addBlock,
    mineBlock,
    calculateHashForBlock,
    replaceChain,
    getBlockVersion
};
