import ether from './helpers/ether'
import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
import EVMThrow from './helpers/EVMThrow'

const utils = require('./helpers/Utils');

const BigNumber = web3.BigNumber

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

//const LeadcoinCrowdsale = artifacts.require('LeadcoinCrowdsale')
const LeadcoinCrowdsale = artifacts.require('../contracts/LeadcoinCrowdsale')
const LeadcoinSmartToken = artifacts.require('LeadcoinSmartToken.sol')

contract('LeadcoinCrowdsale', function([_, investor, owner, wallet, walletTeam, walletWebydo, walletReserve]) {

    const value = ether(1)

    before(async function() {
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock()
    })
    beforeEach(async function() {
        this.startTime = latestTime() + duration.weeks(1);
        this.endTime = this.startTime + duration.weeks(1)
        this.afterEndTime = this.endTime + duration.seconds(1)
        this.hardCap = 8000000000000000000;
        this.token = await LeadcoinSmartToken.new({from: owner});

        this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
            this.endTime,
            wallet,
            walletTeam,
            walletWebydo,
            walletReserve,
            this.hardCap,
            this.token.address,
            {
                from: owner
            })

        await this.token.transferOwnership(this.crowdsale.address, {from: owner});

        await this.crowdsale.claimTokenOwnership({from: owner})

    })


    describe('Token destroy', function() {

        it('should not allow destroy before after finalize', async function() {

            await increaseTimeTo(this.startTime)
            await this.crowdsale.sendTransaction({
                value: value,
                from: investor
            })

            try {
                await this.token.destroy(investor, 20, {from: investor});
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should allow destroy after finalize', async function() {

            await increaseTimeTo(this.startTime)
            await this.crowdsale.sendTransaction({
                value: value,
                from: investor
            })

            await increaseTimeTo(this.afterEndTime)
            await this.crowdsale.finalize({
                from: owner
            })

            await this.token.destroy(investor, 20, {from: investor});
        })
    })

    describe('Token transfer', function() {

        it('should not allow transfer before after finalize', async function() {

            await increaseTimeTo(this.startTime)
            await this.crowdsale.sendTransaction({
                value: value,
                from: investor
            })

            try {
                await this.token.transfer(walletWebydo, 1, {
                    from: investor
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

                                it('should allow transfer after finalize', async function() {

                                    await increaseTimeTo(this.startTime)
                                    await this.crowdsale.sendTransaction({
                                        value: value,
                                        from: investor
                                    })

                                    await increaseTimeTo(this.afterEndTime)
                                    await this.crowdsale.finalize({
                                        from: owner
                                    })

                                    await this.token.transfer(walletWebydo, 1, {
                                        from: walletReserve
                                    });
                                })
    })

    describe('Finalize allocation', function() {

        beforeEach(async function() {
            await increaseTimeTo(this.startTime)
            await this.crowdsale.sendTransaction({
                value: value,
                from: investor
            })

            await increaseTimeTo(this.afterEndTime)
            await this.crowdsale.finalize({
                from: owner
            })

            this.totalSupply = await this.token.totalSupply()
        })

        it('Allocate Team token amount as 10% of the total supply', async function() {
            const expectedTeamTokenAmount = this.totalSupply.mul(0.1);
            let walletTeamBalance = await this.token.balanceOf(walletTeam);

            walletTeamBalance.should.be.bignumber.equal(expectedTeamTokenAmount);
        })

        it('Allocate WEBYDO token amount as 10% of the total supply', async function() {
            const expectedOEMTokenAmount = this.totalSupply.mul(0.1);
            let walletWebydoBalance = await this.token.balanceOf(walletWebydo);

            walletWebydoBalance.should.be.bignumber.equal(expectedOEMTokenAmount);
        })


        it('Allocate Reserve token amount as 30% of the total supply', async function() {
            const expectedReserveTokenAmount = this.totalSupply.mul(0.30);
            let walletReserveBalance = await this.token.balanceOf(walletReserve);

            walletReserveBalance.should.be.bignumber.equal(expectedReserveTokenAmount);
        })

        it('should set finalized true value', async function() {
            assert.equal(await this.crowdsale.isFinalized(), true);
        })

        it('should set token owner to crowdsale owner', async function() {

            await this.token.claimOwnership({
                from: owner
            })

            let tokenOwner = await this.token.owner();
            assert.equal(tokenOwner, owner);
        })

    })

    describe('Grant tokens', function() {

        it('should grant by owner', async function() {
            await increaseTimeTo(this.startTime)
            await this.crowdsale.addUpdateGrantee(investor, 100, {
                from: owner
            })
            let total = await this.crowdsale.presaleGranteesMap(investor)
            assert(total == 100, "grant has failed");
        })

        it('should not grant by none-owner', async function() {
            try {
                await increaseTimeTo(this.startTime)
                await this.crowdsale.addUpdateGrantee(investor, 100, {
                    from: investor
                });
                assert(false, "a none owner granted successfully");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should not be before crowdsale starts', async function() {
            try {
                await this.crowdsale.addUpdateGrantee(investor, 100, {
                    from: owner
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should not be after crowdsale finalized', async function() {
            try {
                await increaseTimeTo(this.afterEndTime)
                await this.crowdsale.finalize({
                    from: owner
                })
                await this.crowdsale.addUpdateGrantee(investor, 100, {
                    from: owner
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should not grant to address \'0x0\'', async function() {
            try {
                await increaseTimeTo(this.startTime)
                await this.crowdsale.addUpdateGrantee('0x0', 100, {
                    from: owner
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should not grant value \'0\'', async function() {
            try {
                await increaseTimeTo(this.startTime)
                await this.crowdsale.addUpdateGrantee(investor, 0, {
                    from: owner
                });
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should not grant to more than MAX_GRANTEE', async function() {
            try {
                let max_grantees = await this.crowdsale.MAX_TOKEN_GRANTEES()
                await increaseTimeTo(this.startTime)
                for (let i = 0; i <= max_grantees; i++) {
                    let address = "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750" + i
                    await this.crowdsale.addUpdateGrantee(address, 100, {
                        from: owner
                    });
                }
                assert(false, "didn't throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should update a grantee', async function() {
            await increaseTimeTo(this.startTime)
            await this.crowdsale.addUpdateGrantee(investor, 100, {
                from: owner
            })
            await this.crowdsale.addUpdateGrantee(investor, 50, {
                from: owner
            })
            let total = await this.crowdsale.presaleGranteesMap(investor);
            assert(total == 50, "update has failed");
        })

        it('should remove a grantee by owner', async function() {
            await increaseTimeTo(this.startTime)
            await this.crowdsale.addUpdateGrantee(investor, 100, {
                from: owner
            })
            await this.crowdsale.deleteGrantee(investor, {
                from: owner
            });
            let total = await this.crowdsale.presaleGranteesMap(investor);
            assert(total == 0, "failed to delete grantee by owner");

        })

        it('should not remove a grantee by none-owner', async function() {
            try {
                await increaseTimeTo(this.startTime)
                await this.crowdsale.addUpdateGrantee(investor, 100, {
                    from: owner
                })
                await this.crowdsale.deleteGrantee(investor, {
                    from: investor
                });
                let total = await this.crowdsale.presaleGranteesMap(investor);
                assert(false, "didnt throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should not remove address 0x0', async function() {
            try {
                await increaseTimeTo(this.startTime)
                await this.crowdsale.addUpdateGrantee(investor, 100, {
                    from: owner
                })
                await this.crowdsale.deleteGrantee("0x0", {
                    from: owner
                });
                assert(total == 0, "didnt throw");
            } catch (error) {
                return utils.ensureException(error);
            }
        })

        it('should create remove event', async function() {owner
            await increaseTimeTo(this.startTime)
            await this.crowdsale.addUpdateGrantee(investor, 100, {
                from: owner
            })
            const {
                logs
            } = await this.crowdsale.deleteGrantee(investor, {
                from: owner
            })
            const event = logs.find(e => e.event === "GrantDeleted")
            should.exist(event)
        })

        it('should create an add event', async function() {
            await increaseTimeTo(this.startTime)
            const {
                logs
            } = await this.crowdsale.addUpdateGrantee(investor, 100, {
                from: owner
            });
            const event = logs.find(e => e.event === "GrantAdded")
            should.exist(event)
        })

        it('should create an update event', async function() {
            await increaseTimeTo(this.startTime)
            await this.crowdsale.addUpdateGrantee(investor, 100, {
                from: owner
            });
            const {
                logs
            } = await this.crowdsale.addUpdateGrantee(investor, 50, {
                from: owner
            });
            const event = logs.find(e => e.event === "GrantUpdated")
            should.exist(event)
        })

        it('should allocate token as expected', async function() {
            await increaseTimeTo(this.startTime)
            let max_grantees = await this.crowdsale.MAX_TOKEN_GRANTEES()
            for (let i = 0; i < max_grantees; i++) {
                let address = "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750" + i
                await this.crowdsale.addUpdateGrantee(address, 100, {
                    from: owner
                });
            }

            await increaseTimeTo(this.afterEndTime)
            await this.crowdsale.finalize({
                from: owner
            })
            for (let i = 0; i < max_grantees; i++) {
                let grantee = await this.crowdsale.presaleGranteesMapKeys(i);
                let granteeVolume = await this.crowdsale.presaleGranteesMap(grantee);
                let granteeBalance = await this.token.balanceOf(grantee);
                assert.equal(granteeVolume + "", granteeBalance + "", "failed to allocate")
            }
        })
    })

     describe('Total Found', function() {

                 it('should start with 0', async function() {
                     let total = await this.crowdsale.getTotalFundsRaised();

                     assert.equal(total, 0);
                 })

                 it('should total amount be equeal to 2', async function() {
                     await increaseTimeTo(this.startTime)
                     await this.crowdsale.sendTransaction({
                         value: ether(2),
                         from: investor
                     })

                    let total = await this.crowdsale.getTotalFundsRaised();
                    total.should.be.bignumber.equal(ether(2));
                 })
                 it('should allow only owner account to call setFiatRaisedConvertedToWei', async function() {
                    await increaseTimeTo(this.startTime)
                    const {
                        logs
                    } = await this.crowdsale.setFiatRaisedConvertedToWei(1, {
                        from: owner
                    });
       
                    const event = logs.find(e => e.event === "FiatRaisedUpdated")
                    should.exist(event)
                })
        
                it('should not allow non-owner account to call setFiatRaisedConvertedToWei', async function() {
                    try {
                        await increaseTimeTo(this.startTime)
                        await this.crowdsale.setFiatRaisedConvertedToWei(1, {
                            from: investor
                        });
                        assert(false, "didn't throw");
                    } catch (error) {
                        return utils.ensureException(error);
                    }
                })
        
       
                it('should not be at after crowdsale ended', async function() {
                    try {
                        await increaseTimeTo(this.afterEndTime)
                        
                        await this.crowdsale.setFiatRaisedConvertedToWei(1, {
                            from: owner
                        });
                        assert(false, "didn't throw");
                    } catch (error) {
                        return utils.ensureException(error);
                    }
                })
             })

             describe ('Force Hardcap', function() {
                it('should allow to get tokens even if the price tops hardcap', async function() {
                    await increaseTimeTo(this.startTime)
                    
                    await this.crowdsale.sendTransaction({
                        value: ether(9),
                        from: investor
                    });
        
                    let total = await this.crowdsale.getTotalFundsRaised();
                    
                    total.should.be.bignumber.equal(ether(9));
        
                })
        
                it('should not allow to get tokens after hard cap reached', async function() {
                    await increaseTimeTo(this.startTime)
                    await this.crowdsale.sendTransaction({
                        value: ether(9),
                        from: investor
                    })
                    let total = await this.crowdsale.getTotalFundsRaised();
        
                    total.should.be.bignumber.equal(ether(9));
        
                    try {
                        await this.crowdsale.sendTransaction({
                            value: ether(1),
                            from: investor
                        })
                    } catch (error) {
                        return utils.ensureException(error);
                    }
                })
        
                it('should allow to call finalized after hard cap reached (before end time)', async function() {
                    await increaseTimeTo(this.startTime)
                    await this.crowdsale.sendTransaction({
                        value: ether(9),
                        from: investor
                    })
                    let total = await this.crowdsale.getTotalFundsRaised();
        
                    total.should.be.bignumber.equal(ether(9));
        
                    const {
                        logs
                    } = await this.crowdsale.finalize({
                        from: owner
                    })
        
                    const event = logs.find(e => e.event === "Finalized")
                    should.exist(event)
        
                })
            })         

    describe('Constructor Parameters', function() {
        it('should initilaized with a valid walletTeam adderss', async function() {
            try {
                this.token = await LeadcoinSmartToken.new({from: owner});

                this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
                    this.endTime,
                    wallet,
                    0x0,
                    walletWebydo,
                    walletReserve,
                    this.hardCap,
                    this.token.address,

                    {
                        from: owner
                    })

                await this.token.transferOwnership(this.crowdsale.address, {from: owner});

                await this.crowdsale.claimTokenOwnership({from: owner})
            } catch (error) {
                return utils.ensureException(error);
            }

            assert(false, "did not throw with invalid walletTeam address")
        })

        it('should initilaized with a valid walletWebydo adderss', async function() {
            try {
                this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
                    this.endTime,
                    wallet,
                    walletTeam,
                    0x0,
                    walletReserve,
                    this.hardCap,
                    this.token.address,

                    {
                        from: owner
                    })

                await this.token.transferOwnership(this.crowdsale.address, {from: owner});


                await this.crowdsale.claimTokenOwnership({from: owner})

            } catch (error) {
                return utils.ensureException(error);
            }

            assert(false, "did not throw with invalid walletWebydo address")
        })



        it('should initilaized with a valid walletReserve adderss', async function() {
            try {
                this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
                    this.endTime,
                    wallet,
                    walletTeam,
                    walletWebydo,
                    0x0,
                    this.hardCap,
                    this.token.address,

                    {
                        from: owner
                    })

                await this.token.transferOwnership(this.crowdsale.address, {from: owner});


                await this.crowdsale.claimTokenOwnership({from: owner})

            } catch (error) {
                return utils.ensureException(error);
            }

            assert(false, "did not throw with invalid walletReserve address")
        })

        it('should initilaized with a valid hard cap', async function() {
            try {
                this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
                    this.endTime,
                    wallet,
                    walletTeam,
                    walletWebydo,
                    walletReserve,
                    0,
                    this.token.address,

                    {
                        from: owner
                    })

                await this.token.transferOwnership(this.crowdsale.address, {from: owner});


                await this.crowdsale.claimTokenOwnership({from: owner})

            } catch (error) {
                return utils.ensureException(error);
            }

            assert(false, "did not throw with invalid hard cap")
        })

                it('should initilaized with a valid token adderss', async function() {
            try {
                this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
                    this.endTime,
                    wallet,
                    walletTeam,
                    walletWebydo,
                    walletReserve,
                    this.hardCap,
                    0x0,

                    {
                        from: owner
                    })

                await this.token.transferOwnership(this.crowdsale.address, {from: owner});


                await this.crowdsale.claimTokenOwnership({from: owner})

            } catch (error) {
                return utils.ensureException(error);
            }

            assert(false, "did not throw with invalid walletReserve address")
        })



        it('should initilaized with a valid parameters', async function() {
            this.crowdsale = await LeadcoinCrowdsale.new(this.startTime,
                this.endTime,
                wallet,
                walletTeam,
                walletWebydo,
                walletReserve,
                this.hardCap,
                this.token.address,
                {
                    from: owner
                })

            await this.token.transferOwnership(this.crowdsale.address, {from: owner});


            await this.crowdsale.claimTokenOwnership({from: owner})

        })
    })
})
