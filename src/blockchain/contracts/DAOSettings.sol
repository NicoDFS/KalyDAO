// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract DAOSettings is AccessControl {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    
    // Generic parameter storage
    mapping(bytes32 => string) public stringParameters;
    mapping(bytes32 => uint256) public numericParameters;
    mapping(bytes32 => bool) public boolParameters;
    
    event ParameterSet(string indexed category, string key, string value);
    event NumericParameterSet(string indexed category, string key, uint256 value);
    event BoolParameterSet(string indexed category, string key, bool value);
    
    constructor(address timelock) {
        _grantRole(TIMELOCK_ROLE, timelock);
    }
    
    // Set string parameters (for Community/Documentation)
    function setStringParameter(
        string calldata category,
        string calldata key, 
        string calldata value
    ) external {
        require(hasRole(TIMELOCK_ROLE, msg.sender), "Caller is not timelock");
        bytes32 paramKey = keccak256(abi.encodePacked(category, key));
        stringParameters[paramKey] = value;
        emit ParameterSet(category, key, value);
    }
    
    // Set numeric parameters (for Technical/Protocol)
    function setNumericParameter(
        string calldata category,
        string calldata key, 
        uint256 value
    ) external {
        require(hasRole(TIMELOCK_ROLE, msg.sender), "Caller is not timelock");
        bytes32 paramKey = keccak256(abi.encodePacked(category, key));
        numericParameters[paramKey] = value;
        emit NumericParameterSet(category, key, value);
    }
    
    // Set boolean parameters (for feature toggles)
    function setBoolParameter(
        string calldata category,
        string calldata key, 
        bool value
    ) external {
        require(hasRole(TIMELOCK_ROLE, msg.sender), "Caller is not timelock");
        bytes32 paramKey = keccak256(abi.encodePacked(category, key));
        boolParameters[paramKey] = value;
        emit BoolParameterSet(category, key, value);
    }
    
    // Getters
    function getStringParameter(string calldata category, string calldata key) 
        external view returns (string memory) 
    {
        return stringParameters[keccak256(abi.encodePacked(category, key))];
    }
    
    function getNumericParameter(string calldata category, string calldata key) 
        external view returns (uint256) 
    {
        return numericParameters[keccak256(abi.encodePacked(category, key))];
    }
    
    function getBoolParameter(string calldata category, string calldata key) 
        external view returns (bool) 
    {
        return boolParameters[keccak256(abi.encodePacked(category, key))];
    }
}