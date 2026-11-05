#!/usr/bin/env node

const DIFF_TOLERANCE = 0.0001;

const assert = require('assert');
const fs = require('fs').promises;

async function readPCFile(filename) {
    const buffer = await fs.readFile(filename);
    
    if (buffer.length < 42) {
        throw new Error('File is too small to contain header');
    }
    
    // Validate header
    const id = buffer.toString('ascii', 0, 2);
    if (id !== 'PC') throw new Error('Invalid file ID');
    
    const ver = buffer.toString('ascii', 2, 3);
    const subVer = buffer.toString('ascii', 3, 4);
    if (ver !== '1' || subVer !== '1') {
//		console.warn("Invalid version/subversion", ver, subVer,
//			"(must be 1, 1)");
    }

    const hLen = buffer.readUInt16LE(4);
    if (hLen !== 42) {
//		console.warn("Invalid header len", hLen, "(must be 42)");
	}
    
    const reserved = buffer.readUInt8(41);
  //  if (reserved !== 0) 
	//	console.warn('Reserved field not zero', reserved);
    
    // Read sample metadata
    const samplNum = buffer.readUInt32LE(34);
    const samplType = buffer.readUInt16LE(38);

	const scale = buffer.readDoubleLE(14);
	const rate = buffer.readInt32LE(32);
    
    // Determine element size and validate type
    let elementSize;
    switch (samplType) {
        case 0x0002: // int16
        case 0x0102: // uint16
            elementSize = 2;
            break;
        case 0x0004: // int32
        case 0x1004: // float
            elementSize = 4;
            break;
        case 0x1008: // double
            elementSize = 8;
            break;
        default:
            throw new Error(`Unsupported sample type: 0x${samplType.toString(16)}`);
    }
    
    // Validate file size
    const expectedSize = 42 + samplNum * elementSize;
    if (buffer.length !== expectedSize) {
        throw new Error(`File size mismatch (expected ${expectedSize}, got ${buffer.length})`);
    }
    
    // Read data array
    const data = [];
    let offset = 42;
    for (let i = 0; i < samplNum; i++) {
        let value;
        switch (samplType) {
            case 0x0002:
                value = buffer.readInt16LE(offset);
                break;
            case 0x0102:
                value = buffer.readUInt16LE(offset);
                break;
            case 0x0004:
                value = buffer.readInt32LE(offset);
                break;
            case 0x1004:
                value = Math.round(buffer.readFloatLE(offset));
                break;
            case 0x1008:
                value = Math.round(buffer.readDoubleLE(offset));
                break;
        }
        data.push(value);
        offset += elementSize;
    }
    
    return {
		scale,
		count: samplNum,
		rate,
		type: samplType,
		data
	}
}

async function main() {
    const files = process.argv.slice(2);
    if (files.length !== 2) {
        console.error('Usage: node script.js <file1> <file2>');
        process.exit(1);
    }
    
    try {
        const [data1, data2] = await Promise.all(files.map(readPCFile));
		var sum=0, diff=0;
		for (var i=0; i<data1.data.length; i++) {
			var d1 = data1.data[i] * data1.scale;
			var d2 = data2.data[i] * data2.scale;
			var avg = (d1+d2) / 2.0;
			sum += avg * avg;
			var dif = (d1-d2);
			diff += dif * dif;
		}
		var difference = Math.sqrt(diff) / Math.sqrt(sum);
		if (difference > DIFF_TOLERANCE)
			throw Error(`traces are different: ${difference}`);
		assert(difference >= 0 && difference <= 1);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
