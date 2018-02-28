pragma solidity ^0.4.18;


import './crowdsale/FinalizableCrowdsale.sol';
import './bancor/TokenHolder.sol';
import './math/SafeMath.sol';
import './LeadcoinSmartToken.sol';


contract LeadcoinCrowdsale is TokenHolder,FinalizableCrowdsale {

    // =================================================================================================================
    //                                      Constants
    // =================================================================================================================
    // Max amount of known addresses of which will get LDC by 'Grant' method.
    //
    // grantees addresses will be LeadcoinLabs wallets addresses.
    // these wallets will contain LDC tokens that will be used for 2 purposes only -
    // 1. LDC tokens against raised fiat money
    // 2. LDC tokens for presale bonus.
    // we set the value to 10 (and not to 2) because we want to allow some flexibility for cases like fiat money that is raised close to the crowdsale.
    // we limit the value to 10 (and not larger) to limit the run time of the function that process the grantees array.
    uint8 public constant MAX_TOKEN_GRANTEES = 10;

    //we limit the amount of tokens we can mint to a grantee so it won't be exploit.
    uint256 public constant MAX_GRANTEE_TOKENS_ALLOWED = 250000000 * 10 ** 18;    

    // LDC to ETH base rate
    uint256 public constant EXCHANGE_RATE = 15000;

    // =================================================================================================================
    //                                      Modifiers
    // =================================================================================================================

    /**
     * @dev Throws if called after crowdsale was finalized
     */
    modifier beforeFinzalized() {
        require(!isFinalized);
        _;
    }
    /**
     * @dev Throws if called before crowdsale start time
     */
    modifier notBeforeSaleStarts() {
        require(now >= startTime);
        _;
    }
   /**
     * @dev Throws if called not during the crowdsale time frame
     */
    modifier onlyWhileSale() {
        require(now >= startTime && now < endTime);
        _;
    }

    // =================================================================================================================
    //                                      Members
    // =================================================================================================================

    // wallets address for 50% of LDC allocation
    address public walletTeam;   //10% of the total number of LDC tokens will be allocated to the team
    address public walletWebydo;       //10% of the total number of LDC tokens will be allocated to Webydo Ltd.
    address public walletReserve;   //30% of the total number of LDC tokens will be allocated to Leadcoin reserves


    // Funds collected outside the crowdsale in wei
    uint256 public fiatRaisedConvertedToWei;

    //Grantees - used for non-ether and presale bonus token generation
    address[] public presaleGranteesMapKeys;
    mapping (address => uint256) public presaleGranteesMap;  //address=>wei token amount

    // Hard cap in Wei
    uint256 public hardCap;


    // =================================================================================================================
    //                                      Events
    // =================================================================================================================
    event GrantAdded(address indexed _grantee, uint256 _amount);

    event GrantUpdated(address indexed _grantee, uint256 _oldAmount, uint256 _newAmount);

    event GrantDeleted(address indexed _grantee, uint256 _hadAmount);

    event FiatRaisedUpdated(address indexed _address, uint256 _fiatRaised);

    // =================================================================================================================
    //                                      Constructors
    // =================================================================================================================

    function LeadcoinCrowdsale(uint256 _startTime,
    uint256 _endTime,
    address _wallet,
    address _walletTeam,
    address _walletWebydo,
    address _walletReserve,
    uint256 _cap,
    LeadcoinSmartToken _leadcoinSmartToken)
    public
    Crowdsale(_startTime, _endTime, EXCHANGE_RATE, _wallet, _leadcoinSmartToken) {
        require(_walletTeam != address(0));
        require(_walletWebydo != address(0));
        require(_walletReserve != address(0));
        require(_leadcoinSmartToken != address(0));
        require(_cap > 0);

        walletTeam = _walletTeam;
        walletWebydo = _walletWebydo;
        walletReserve = _walletReserve;

        token = _leadcoinSmartToken;

        hardCap = _cap;

    }


    // =================================================================================================================
    //                                      Impl FinalizableCrowdsale
    // =================================================================================================================

    //@Override
    function finalization() internal onlyOwner {
        super.finalization();

        // granting bonuses for the pre crowdsale grantees:
        for (uint256 i = 0; i < presaleGranteesMapKeys.length; i++) {
            token.issue(presaleGranteesMapKeys[i], presaleGranteesMap[presaleGranteesMapKeys[i]]);
        }

        // Adding 50% of the total token supply (50% were generated during the crowdsale)
        // 50 * 2 = 100
        uint256 newTotalSupply = token.totalSupply().mul(200).div(100);

        // 10% of the total number of LDC tokens will be allocated to the team
        token.issue(walletTeam, newTotalSupply.mul(10).div(100));

        // 10% of the total number of LDC tokens will be allocated to Webydo Ltd.
        token.issue(walletWebydo, newTotalSupply.mul(10).div(100));

        // 30% of the total number of LDC tokens will be allocated Leadcoin reserves
        token.issue(walletReserve, newTotalSupply.mul(30).div(100));

        // Re-enable transfers after the token sale.
        token.disableTransfers(false);

        // Re-enable destroy function after the token sale.
        token.setDestroyEnabled(true);

        // transfer token ownership to crowdsale owner
        token.transferOwnership(owner);

    }

    // =================================================================================================================
    //                                      Public Methods
    // =================================================================================================================
    // @return the total funds collected in wei(ETH and none ETH).
    function getTotalFundsRaised() public view returns (uint256) {
        return fiatRaisedConvertedToWei.add(weiRaised);
    }

     // overriding Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        bool capReached = getTotalFundsRaised() >= hardCap;
        return capReached || super.hasEnded();
    }

    // overriding Crowdsale#validPurchase to add extra cap logic
    // @return true if investors can buy at the moment
    function validPurchase() internal view returns (bool) {
        bool withinCap = getTotalFundsRaised() < hardCap;
        return withinCap && super.validPurchase();
    }

    // =================================================================================================================
    //                                      External Methods
    // =================================================================================================================
    // @dev Adds/Updates address and token allocation for token grants.
    // Granted tokens are allocated to non-ether, presale, buyers.
    // @param _grantee address The address of the token grantee.
    // @param _value uint256 The value of the grant in wei token.
    function addUpdateGrantee(address _grantee, uint256 _value) external onlyOwner notBeforeSaleStarts beforeFinzalized {
        require(_grantee != address(0));
        require(_value > 0 && _value <= MAX_GRANTEE_TOKENS_ALLOWED);
        
        // Adding new key if not present:
        if (presaleGranteesMap[_grantee] == 0) {
            require(presaleGranteesMapKeys.length < MAX_TOKEN_GRANTEES);
            presaleGranteesMapKeys.push(_grantee);
            GrantAdded(_grantee, _value);
        } else {
            GrantUpdated(_grantee, presaleGranteesMap[_grantee], _value);
        }

        presaleGranteesMap[_grantee] = _value;
    }

    // @dev deletes entries from the grants list.
    // @param _grantee address The address of the token grantee.
    function deleteGrantee(address _grantee) external onlyOwner notBeforeSaleStarts beforeFinzalized {
        require(_grantee != address(0));
        require(presaleGranteesMap[_grantee] != 0);

        //delete from the map:
        delete presaleGranteesMap[_grantee];

        //delete from the array (keys):
        uint256 index;
        for (uint256 i = 0; i < presaleGranteesMapKeys.length; i++) {
            if (presaleGranteesMapKeys[i] == _grantee) {
                index = i;
                break;
            }
        }
        presaleGranteesMapKeys[index] = presaleGranteesMapKeys[presaleGranteesMapKeys.length - 1];
        delete presaleGranteesMapKeys[presaleGranteesMapKeys.length - 1];
        presaleGranteesMapKeys.length--;

        GrantDeleted(_grantee, presaleGranteesMap[_grantee]);
    }

    // @dev Set funds collected outside the crowdsale in wei.
    //  note: we not to use accumulator to allow flexibility in case of humane mistakes.
    // funds are converted to wei using the market conversion rate of USD\ETH on the day on the purchase.
    // @param _fiatRaisedConvertedToWei number of none eth raised.
    function setFiatRaisedConvertedToWei(uint256 _fiatRaisedConvertedToWei) external onlyOwner onlyWhileSale {
        fiatRaisedConvertedToWei = _fiatRaisedConvertedToWei;
        FiatRaisedUpdated(msg.sender, fiatRaisedConvertedToWei);
    }


    /// @dev Accepts new ownership on behalf of the LeadcoinCrowdsale contract. This can be used, by the token sale
    /// contract itself to claim back ownership of the LeadcoinSmartToken contract.
    function claimTokenOwnership() external onlyOwner {
        token.claimOwnership();
    }

}
