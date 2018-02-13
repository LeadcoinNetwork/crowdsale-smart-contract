pragma solidity ^0.4.18;


import '../../contracts/crowdsale/Crowdsale.sol';


contract CrowdsaleMock is Crowdsale {

  	function CrowdsaleMock(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, LeadcoinSmartToken _token) public
  		Crowdsale(_startTime, _endTime, _rate, _wallet, _token)
  	{
  	}

  	/// @dev Accepts new ownership on behalf of the LeadcoinCrowdsale contract. This can be used, by the token sale
  	/// contract itself to claim back ownership of the LeadcoinSmartToken contract.
  	function claimTokenOwnership() external {
    	token.claimOwnership();
	}
}
