/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const TokenHolder = artifacts.require('../contracts/bancor/TokenHolder.sol');
const LeadcoinToken = artifacts.require('../contracts/LeadcoinSmartToken.sol');
const utils = require('./helpers/Utils');

let holder;
let holderAddress;
let leadcoinToken;
let leadcoinTokenAddress;

beforeEach(async function() {
    holder = await TokenHolder.new();
    holderAddress = holder.address;
    leadcoinToken = await LeadcoinToken.new();
    leadcoinTokenAddress = leadcoinToken.address;
    await leadcoinToken.issue(holderAddress, 1000);
    await leadcoinToken.disableTransfers(false);
    
});

contract('TokenHolder', (accounts) => {
    it('verifies that the owner can withdraw tokens', async () => {
        let prevBalance = await leadcoinToken.balanceOf.call(accounts[2]);
        await holder.withdrawTokens(leadcoinTokenAddress, accounts[2], 100);
        let balance = await leadcoinToken.balanceOf.call(accounts[2]);
        assert.equal(balance.toNumber(), prevBalance.plus(100).toNumber());
    });

    it('should throw when a non owner attempts to withdraw tokens', async () => {
        try {
            await holder.withdrawTokens(leadcoinTokenAddress, accounts[2], 100, { from: accounts[3] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw tokens from an invalid ERC20 token address', async () => {
        try {
            await holder.withdrawTokens('0x0', accounts[2], 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw tokens to an invalid account address', async () => {
        try {
            await holder.withdrawTokens(leadcoinTokenAddress, '0x0', 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw tokens to the holder address', async () => {
        try {
            await holder.withdrawTokens(leadcoinTokenAddress, holderAddress, 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw an amount greater than the holder balance', async () => {
        try {
            await holder.withdrawTokens(leadcoinTokenAddress, accounts[2], 5000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
