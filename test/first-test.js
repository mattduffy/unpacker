/* eslint-disable object-curly-newline */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import Debug from 'debug'
import { Unpacker } from '../index.js'

const debug = Debug('unpacker:test')
const __dirname = path.resolve(path.dirname('.'))
const tinyZip = `${__dirname}/test/tiny.zip`
const tarball = `${__dirname}/test/marquetry.tgz`
const badPath = `${__dirname}/test/missingfile.tar.gz`

before('before tests, setup', () => {
  debug('before tests, setup')
  // throw new Error('before test setup')
})

after('after tests, teardown', () => {

})

describe('Testing the creation and use of the Unpacker class.', () => {
  it('should create an instance of Unpacker', async () => {
    debug('Unpacker constructor test')
    const unpacker = new Unpacker()
    assert.strictEqual(unpacker instanceof Unpacker, true, 'unpacker type error')
    assert.strictEqual(unpacker instanceof EventEmitter, true, 'unpacker type error')
  })
})

describe('setting the path', () => {
  it('should be able to set a valid file system path to an archive file', async () => {
    debug('getter/setter: path property')
    const unpacker = new Unpacker()
    await unpacker.setPath(tinyZip)
    const value = unpacker.getPath()
    debug(`value: ${value}`)
    assert.strictEqual(value, tinyZip, 'unexpected value for path')
  })

  it('should fail if path is empty \'\'', async () => {
    const unpacker = new Unpacker()
    debug('value: \'\'')
    try {
      await unpacker.setPath()
    } catch (e) {
      debug(e)
      assert.strictEqual(e instanceof Error, true)
    }
  })

  it('should set the correct mimetype for the archive file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarball)
    assert.strictEqual(unpacker.getMimetype(), 'application/gzip')
  })
})
