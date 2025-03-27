// contracts/TreasuryVault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryVault is Ownable {
  using SafeERC20 for IERC20;

  // Events
  event NativeTokenReceived(address indexed sender, uint256 amount);
  event NativeTokenSent(address indexed recipient, uint256 amount);
  event ERC20TokenSent(address indexed token, address indexed recipient, uint256 amount);
  event ValueChanged(uint256 newValue);

  // Legacy storage variable
  uint256 private value;

  // Allow the treasury to receive native tokens
  receive() external payable {
    emit NativeTokenReceived(msg.sender, msg.value);
  }

  // Sends native tokens to a recipient (only callable by the DAO)
  function sendNativeToken(address payable recipient, uint256 amount) external onlyOwner {
    require(address(this).balance >= amount, "Insufficient native token balance");
    recipient.transfer(amount);
    emit NativeTokenSent(recipient, amount);
  }

  // Sends ERC20 tokens to a recipient (only callable by the DAO)
  function sendERC20Token(address token, address recipient, uint256 amount) external onlyOwner {
    require(token != address(0), "Invalid token address");
    require(recipient != address(0), "Invalid recipient address");
    
    IERC20 tokenContract = IERC20(token);
    require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient token balance");
    
    SafeERC20.safeTransfer(tokenContract, recipient, amount);
    emit ERC20TokenSent(token, recipient, amount);
  }

  // Batch send ERC20 tokens to multiple recipients (only callable by the DAO)
  function batchSendERC20Token(
    address token,
    address[] calldata recipients,
    uint256[] calldata amounts
  ) external onlyOwner {
    require(token != address(0), "Invalid token address");
    require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
    
    IERC20 tokenContract = IERC20(token);
    
    for (uint256 i = 0; i < recipients.length; i++) {
      require(recipients[i] != address(0), "Invalid recipient address");
      require(tokenContract.balanceOf(address(this)) >= amounts[i], "Insufficient token balance");
      
      SafeERC20.safeTransfer(tokenContract, recipients[i], amounts[i]);
      emit ERC20TokenSent(token, recipients[i], amounts[i]);
    }
  }

  // Returns the native token balance of the treasury
  function getNativeTokenBalance() external view returns (uint256) {
    return address(this).balance;
  }

  // Returns the ERC20 token balance of the treasury
  function getERC20TokenBalance(address token) external view returns (uint256) {
    return IERC20(token).balanceOf(address(this));
  }

  // Legacy functions for backward compatibility
  function store(uint256 newValue) public onlyOwner {
    value = newValue;
    emit ValueChanged(newValue);
  }

  function retrieve() public view returns (uint256) {
    return value;
  }
}
