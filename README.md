# Node security design patterns

This project provides an NPM module that enables a variety of security
design patterns in Node.js code.

[![Build Status](https://travis-ci.org/mikesamuel/node-sec-patterns.svg?branch=master)](https://travis-ci.org/mikesamuel/node-sec-patterns)
[![Dependencies Status](https://david-dm.org/mikesamuel/node-sec-patterns/status.svg)](https://david-dm.org/mikesamuel/node-sec-patterns)
[![npm](https://img.shields.io/npm/v/node-sec-patterns.svg)](https://www.npmjs.com/package/node-sec-patterns)
[![Install Size](https://packagephobia.now.sh/badge?p=safesql)](https://packagephobia.now.sh/result?p=node-sec-patterns)
[![Known Vulnerabilities](https://snyk.io/test/github/mikesamuel/node-sec-patterns/badge.svg?targetFile=package.json)](https://snyk.io/test/github/mikesamuel/node-sec-patterns?targetFile=package.json)

## Table of Contents

*  [Installation](#installation)
*  [Goal](#goal)
*  [Glossary](#glossary)
*  [Getting Started](#getting-started)
   * [`.authorize(config, projectRoot)`](#authorizeconfig-projectroot)
*  [Configuration](#configuration)
   * [Suggesting grants](#suggesting-grants)
*  [Defining a Mintable Type](#defining-a-mintable-type)
*  [Example](#example)
*  [Creating Mintable values](#creating-mintable-values)
*  [Degrading gracefully](#degrading-gracefully)
*  [Verifying values](#verifying-values)
*  [Workflow](#workflow---making-security-critical-deep-dependencies-apparent)

## Installation

```bash
$ npm install node-sec-patterns
```

## Goal
Make it easier for project teams to produce code that preserves
important security properties.

This module attempts to further that goal by enabling and encouraging
development practices that make it transparent what code has to
function correctly for a security property to hold.

## Glossary

*  **Mutual Suspicion** - Two modules are mutually suspicious when
   they attempt to preserve their security properties without
   trusting that the other module functions correctly.
*  **Security Design Pattern** - Design patterns that make
   it easier to express and preserve correctness properties
   that are relevant to security.
*  **Minter** - A function that produces a value.
*  **Verifier** - A function that verifies that its input has
   a certain property.
*  **Restricted minter/verifier design pattern** - A design
   pattern where we restrict access to a minter to code that
   has been carefully reviewed.  If the review correctly concludes
   that all modules with access to the minter preserve a property,
   then verifying that a value has the property is as simple as
   a runtime type check.
*  **Security Transparency** - When a developer can check whether a
   security property holds without reading the vast majority of the
   project code, then the codebase is transparent with respect to that
   security property.  The first step towards security transparency is
   typically eliminating deep transitive dependencies from the code
   that might cause a failure.

## Getting Started
We assume that the app main file does something like the below
before any malicious code can run:
```js
require('node-sec-patterns').authorize(require('./package.json'), '.')
```

The code below assumes that `package.json` contains the configuration
but it is the call to `authorize` that determines which configuration
is used.

Ideally this would be the first line in the main file.

Library code authors should not call `authorize`.  It should only
be called by the main module that integrates a production system
or by test code that tests a module's function under
various configurations.

### `.authorize(config, projectRoot)`

An application's main module should call the `authorize` function
before loading modules that need to create mintable types.

It takes two parameters:

*  A configuration object with a property named `"mintable"`.
   See [Configuration](#configuration).
*  A path to the project root.  Relative paths in the configuration
   objects resolve relative to this path.
   Defaults to the `__dirname` of the module that loaded `.authorize`.

## Configuration
If you `authorize`d the package as above, then configuration happens
via a `"mintable"` propery in your `package.json` like the below:

```json
{
  "name": "my-project",
  "...": "...",
  "mintable": {
    "mode": "enforce",
    "grants": {
      "contract-key-foo": [
        "foo",
        "./lib/bar.js"
      ],
    }
  }
}
```

That configuration grants module `"foo"` access to the minter for any
mintable types whose contract key is `"contract-key-foo"`.
Minters convey the authority to create values of the mintable type
that pass the corresponding verifier.

If `"mintable": {...}` is not present, then it defaults to
`{ "mode": "permissive", "grants": {} }` so projects that do not
opt-into whitelisting will allow any code access to the minter.

If `"mintable"` is present but `"mode": ...` is not present,
it defaults to `"enforce"`.

If `"mode"` is `"permissive"` then all accesses are allowed.

If `"mode"` is `"report-only"` then all accesses are allowed.

### Suggesting grants

Library code may also suggest grants.  It may **self nominate** for
certain privileges, and then an application may **second** those
privileges.

For example, if a library's package.json includes

```json
{
  ...
  "mintable": {
    "selfNominate": [
      "contractKey0",
      "contractKey1"
    ]
  }
}
```

and an application's package.json includes

```json
{
  ...
  "mintable": {
    "second": [
      "path/to/library"
    ]
  }
}
```

then `Mintable.minterFor` will behave as if the application's
package.json had done

```json
{
  ...
  "mintable": {
    "grants": {
      "contractKey0": [ "path/to/library" ],
      "contractKey1": [ "path/to/library" ]
    }
  }
}
```

Application maintainers can run the below to see what effect self nominations have,
but keep in mind that a package might change its self nominations in future versions so
seconding self-nominated grants for a module is placing trust in that module's future
development practices.

```sh
$ node -e 'for (const second of require(`./package.json`).mintable.second) {
  const config = /[.]json$/.test(second) ? second : `${ second }/package.json`;
  console.group(second);
  console.log(JSON.stringify(require(config).mintable.selfNominate, null, 2));
  console.groupEnd();
}'
```

Seconded nominations are resolved using the following algorithm:

1. for (targetConfigPath of configuration.mintable.second)
   1.  Make sure we're loading a configuration file:
       1.  if targetConfigPath does not end with `.json` then targetConfigPath += '/package.json'
   1.  Infer the target package name from the configuration path file:
       1.  let targetPackage = require.resolve(targetConfigPath)
       1.  targetPackage = targetPackage.split('/')
       1.  targetPackage = targetPackage.slice(targetPackage.indexOf('node_modules') + 1)
       1.  targetPackage = targetPackage.slice(0, targetPackage\[0\]\[0\] === '@' ? 2 : 1)
       1.  targetPackage = targetPackage.join('/')
   1.  Fetch the target configuration
       1.  let targetConfig = require(targetConfigPath)
   1.  Incorporate any self nominations into the application's grants
       1.  let selfNominations = (targetConfig.mintable || {}).selfNominate || \[\]
       1.  for (selfNomination of selfNominations)
           1.  grants[selfNomination] = grants[selfNomination] || \[\]
           1.  grants[selfNomination].push(


If a self nomination path ends in `.json` then `/package.json` is not appended to the
config file.

Internal package directories are stripped when figuring out to whom access is granted.


## Defining a Mintable Type
Mintable types are subclasses of `class Mintable` exported by this module.
Mintable types must have a static property that specifies their contract
key.  This property should be const.

A simple way to do this is

```js
const { Mintable } = require('node-sec-patterns')

class FooContractType extends Mintable {
  constructor () {
    super()
  }
}
Object.defineProperty(
  FooContractType,
  'contractKey',
  {
    value: 'contract-key-foo',
    configurable: false,
    writable: false
  })
```

## Example
If, for example, we wanted to reify the guarantee that a string of
HTML is safe to load into an HTML document in the organization's origin,
we might create a string wrapper like [safe contract types][].

```js
class SafeHtml extends Mintable {
  constructor (stringContent) {
    this.content = '' + stringContent
    Object.freeze(this)
  }
}
Object.defineProperty(
  SafeHtml,
  'contentKey',
  {
    value: 'goog.html.SafeHtml',
    configurable: false,
    writable: false
  })
```

## Creating Mintable values
Instead of using `new` just pass the same arguments to the minter.

```js
// The minter may be fetched once.
const fooMinter = require.keys.unboxStrict(Mintable.minterFor(FooContractType))

const newInstance =
  // instead of (new FooContractType(x, y))
  fooMinter(x, y)
```

Minters are [boxed][box], so you have to unbox a minter before using it.

## Degrading gracefully
Library code may want to mint a value when it has authority to do so
or degrade gracefully when it does not.

Trying to unbox `Mintable.minterFor(`*T*`)` when you do not have the
authority to mint values of type *T* will `throw` but you may pass a
fallback function to [`unbox`][unbox] to return when you are not
authorized.  Either way, users of your library who have not
whitelisted it will get a log warning to prompt them to consider
granting authority to your library.

```js
const fooMinter = require.keys.unbox(
  Mintable.minterFor(FooContractType),
  () => true,
  fallbackValueMaker)
```

Values created by the fallback function will not pass the verifier.

## Verifying values
`Object.create` can forge values that pass `instanceof` checks, so
be sure to use the verifier to check whether a value was created
by the minter.

```js
const isFoo = Mintable.verifierFor(FooContractType)
```

## Workflow - making security critical deep dependencies apparent
A package may allow some modules access to the minter but not others.
This enables workflows like:
1. A developer is using an API that grants special privileges to values
   that pass a mintable type's verifier.
2. They add a third-party dependency that either produces that type
   via a minter or has a dependency that does.
3. The developer adds a unit test which fails because no grant
   provides the third-party dependency access to the minter.
4. The developer adds a whitelist entry to the `package.json` for their
   project granting access.
5. Later, they issue a pull request to pull their changes into master,
   and/or when a push master builds a release candidate, they review
   changes to `package.json` and see that the added dependency is
   security critical.

This allows a development team, collectively, to reify some security
guarantees in JavaScript objects and ensure that only a small,
checkable core of code can produce those values.

This module provides a mechanism by which:
*  A code reviewer who wants to check creation of a reified security
   guarantee can ignore the project's dependencies' dependencies'
   dependencies, etc.
*  Consumers of a reified security guarantee can efficiently verify
   that an approved creators created the object.
*  Project's can decide on a case-by-case basis which code can
   create which reified security guarantee.
*  A security specialist who wants to monitor changes to that policy
   over time needs to track `package.json` and the main file.

[safe contract types]: https://github.com/google/safe-html-types/blob/master/doc/safehtml-types.md#types
[per module keys]: https://gist.github.com/mikesamuel/bd653e9f69595f7b9d7dd4381a154e02
[box]: https://npmjs.org/package/module-keys#box
[unbox]: https://npmjs.org/package/module-keys#unbox
