// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GovernanceToken is ERC20Votes {
  event Deposit(address indexed dst, uint256 amount);
  event Withdrawal(address indexed src, uint256 amount);

  constructor() ERC20("Governance Kaly Coin", "gKLC") ERC20Permit("Governance Kaly Coin") {}

  receive() external payable {
    deposit();
  }

  function deposit() public payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) public {
    require(balanceOf(msg.sender) >= amount, "gKLC: insufficient balance");
    _burn(msg.sender, amount);
    payable(msg.sender).transfer(amount);
    emit Withdrawal(msg.sender, amount);
  }

  function totalSupply() public view override returns (uint256) {
    return address(this).balance;
  }

  // The functions below are overrides required by Solidity.
  function _afterTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20Votes) {
    super._afterTokenTransfer(from, to, amount);
  }

  function _mint(address to, uint256 amount) internal override(ERC20Votes) {
    super._mint(to, amount);
  }

  function _burn(address account, uint256 amount) internal override(ERC20Votes) {
    super._burn(account, amount);
  }
}
