// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 1: Cross-Chain OFT
// Wraps native ETH on Hedera as an HTS token
// ============================================

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { HTSConnector } from "./hts/HTSConnector.sol";

contract MyHTSConnector is Ownable, HTSConnector {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) payable HTSConnector(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
