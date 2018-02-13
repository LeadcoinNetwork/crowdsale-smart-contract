pragma solidity ^0.4.18;


import './bancor/LimitedTransferBancorSmartToken.sol';
import './bancor/TokenHolder.sol';


/**
  A Token which is 'Bancor' compatible and can mint new tokens and pause token-transfer functionality
*/
contract LeadcoinSmartToken is TokenHolder, LimitedTransferBancorSmartToken {

    // =================================================================================================================
    //                                         Members
    // =================================================================================================================

    string public name = "LEADCOIN";

    string public symbol = "LDC";

    uint8 public decimals = 18;

    // =================================================================================================================
    //                                         Constructor
    // =================================================================================================================

    function LeadcoinSmartToken() public {
        //Apart of 'Bancor' computability - triggered when a smart token is deployed
        NewSmartToken(address(this));
    }
}
