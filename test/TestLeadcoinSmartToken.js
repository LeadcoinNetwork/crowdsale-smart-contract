const LeadcoinSmartToken = artifacts.require('../contracts/LeadcoinSmartToken.sol');
const utils = require('./helpers/Utils');

contract('LeadcoinSmartToken', (accounts) => {
    let token;
    let owner = accounts[0];

    beforeEach(async () => {
        token = await LeadcoinSmartToken.new();
    });

    describe('construction', async () => {
        it('should be ownable', async () => {
            assert.equal(await token.owner(), owner);
        });

        it('should return correct name after construction', async () => {
            assert.equal(await token.name(), "LEADCOIN");
        });

        it('should return correct symbol after construction', async () => {
            assert.equal(await token.symbol(), 'LDC');
        });

        it('should return correct decimal points after construction', async () => {
            assert.equal(await token.decimals(), 18);
        });

        it('should be initialized as not transferable', async () => {
            assert.equal(await token.transfersEnabled(), false);
        });

        it('should throw when attempting to transfer by default', async () => {
            let token = await LeadcoinSmartToken.new();
            await token.issue(accounts[0], 1000);
            let balance = await token.balanceOf.call(accounts[0]);
            assert.equal(balance, 1000);

            try {
                await token.transfer(accounts[1], 100);
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        });
    });
});
