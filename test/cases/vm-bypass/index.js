const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')

authorize(require('./package.json'))

const myMinter = require.keys.unboxStrict(
  Mintable.minterFor(MyMintable), () => true)
console.log('I Got My minter')

const myInstance = myMinter()
console.log(`I Minted My ${myInstance instanceof MyMintable}`)

const myVerifier = Mintable.verifierFor(MyMintable)
console.log(`I Verified My ${myVerifier(myInstance)}`)

require('./bypass')
