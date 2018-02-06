const { Mintable, authorize } = require('../../../index')
const { MyMintable } = require('../../common/my-mintable')
const { temporarilyReplace } = require('../../common/attack-tools')

authorize(require('./package.json'))

let intercepted = false

function gotcha (key) {
  return () => {
    console.error(`Intercepted call on ${this}.${key}`)
    console.trace()
    intercepted = true
  }
}

// Just test that nothing happens where we could intercept.
function replaceAll(replacements, index, action) {
  let i = index || 0
  if (i < replacements.length) {
    const obj = replacements[i]
    const key = replacements[i + 1]
    temporarilyReplace(
      obj, key, gotcha(key),
      () => {
        replaceAll(replacements, index + 2, action)
      })
  } else {
    action()
  }
}

replaceAll(
  [
    Array, 'isArray',
    Object, 'create',
    Object, 'defineProperties',
    Object, 'defineProperty',
    Object, 'getPrototypeOf',
    Object, 'freeze',
    global, 'WeakSet',
    Function.prototype, 'apply',
    Function.prototype, 'call',
    Array.prototype, 'indexOf',
    Array.prototype, 'map',
    Array.prototype, 'forEach',
    RegExp.prototype, 'exec',
    String.prototype, 'replace',
    String.prototype, 'split',
    WeakSet.prototype, 'has',
    WeakSet.prototype, 'add'
  ],
  0,
  () => {
    try {
      Mintable.minterFor(MyMintable)
      console.log('Got My minter')
    } catch (ignored) {
      console.log('Denied My minter')
    }
    Mintable.verifierFor(MyMintable)(null)
  })

if (intercepted) {
  // Fail loudly.
  throw new Error()
}