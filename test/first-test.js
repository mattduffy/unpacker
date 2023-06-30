import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import Debug from 'debug'
import { Unpacker } from '../src/index.js'

const cmd = promisify(exec)
const debug = Debug('unpacker:test')
const __dirname = path.resolve(path.dirname('.'))
const tinyZip = `${__dirname}/test/tiny.zip`
const gz = `${__dirname}/test/singleton.jpg.gz`
const tar = `${__dirname}/test/marquetry.tar`
const tarGz = `${__dirname}/test/marquetry.tar.gz`
const tarball = `${__dirname}/test/marquetry.tgz`
const badPath = `${__dirname}/test/missingfile.tar.gz`
const destination = `${__dirname}/test/static/albums`
const renamedDest = '_0000000001'

before('before tests, setup', () => {
  debug('before tests, setup')
})

after('after tests, teardown', () => {

})

describe('Testing the creation and use of the Unpacker class.', { timeout: 5000 }, () => {
  it('should create an instance of Unpacker', async () => {
    debug('Unpacker constructor test')
    const unpacker = new Unpacker()
    assert.strictEqual(unpacker instanceof Unpacker, true, 'unpacker type error')
    assert.strictEqual(unpacker instanceof EventEmitter, true, 'unpacker type error')
  })
})

describe('setting the path', { timeout: 5000 }, () => {
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

  it('should fail if path to the file is invalid', async () => {
    const unpacker = new Unpacker()
    try {
      await unpacker.setPath(badPath)
    } catch (e) {
      debug(e)
      assert.strictEqual(e instanceof Error, true)
    }
  })

  it('should correctly identify the mime type of a tar archive', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tar)
    debug(`${tar}: ${unpacker.getMimetype()}`)
    assert.strictEqual(unpacker.getMimetype(), 'application/x-tar')
  })

  it('should correctly identify the mimetype of a gzip compressed archive', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarball)
    assert.strictEqual(unpacker.getMimetype(), 'application/gzip')
  })

  it('should correctly identify the mimetype of a zip compressed archive', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tinyZip)
    assert.strictEqual(unpacker.getMimetype(), 'application/zip')
  })
})

describe('checking for tar and gzip', { timeout: 5000 }, () => {
  it('should find a usable version of tar', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarball)
    const hasTar = await unpacker.checkCommands()
    assert.strictEqual(/tar/.test(hasTar.tar.path), true)
  })

  it('should find a usable verion of gzip', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarball)
    const hasGzip = await unpacker.checkCommands()
    assert.strictEqual(/gzip/.test(hasGzip.gzip.path), true)
  })

  it('should find a usable verion of unzip', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tinyZip)
    const hasUnzip = await unpacker.checkCommands()
    assert.strictEqual(/unzip/.test(hasUnzip.unzip.path), true)
  })
})

describe('get the file extension of the archive file', { timeout: 5000 }, async () => {
  it('should correctly extract the file extension from a .tar file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tar)
    assert.ok(unpacker._fileExt === '.tar')
    assert.ok(unpacker.getExtension() === '.tar')
  })

  it('should correctly extract the file extension from a .tar.gz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarGz)
    assert.ok(unpacker._fileExt === '.tar.gz')
    assert.ok(unpacker.getExtension() === '.tar.gz')
  })

  it('should correctly extract the file extension from a .tgz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarball)
    assert.ok(unpacker._fileExt === '.tgz')
    assert.ok(unpacker.getExtension() === '.tgz')
  })

  it('should correctly extract the file extension from a .gz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(gz)
    assert.ok(unpacker._fileExt === '.gz')
    assert.ok(unpacker.getExtension() === '.gz')
  })

  it('should correctly extract the file extension from a .zip file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tinyZip)
    assert.ok(unpacker._fileExt === '.zip')
    assert.ok(unpacker.getExtension() === '.zip')
  })
})

describe('successfully list the contents of the archive file', { timeout: 5000 }, async () => {
  it('should correctly list the contents of a .tar file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tar)
    const { list } = await unpacker.list()
    assert.ok(list.length > 1)
  })

  it('should correctly list the contents of a .tar.gz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarGz)
    const { list } = await unpacker.list()
    assert.ok(list.length > 1)
  })

  it('should correctly list the contents of a .tgz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarGz)
    const { list } = await unpacker.list()
    assert.ok(list.length > 1)
  })

  it('should correctly list the contents of a .zip file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tinyZip)
    const { list } = await unpacker.list()
    assert.ok(list.length > 1)
  })

  it('should correctly list the contents of a .gz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(gz)
    const { list } = await unpacker.list()
    assert.ok(list.length === 1)
  })
})

describe('successfully unpack some archives', { timeout: 5000 }, () => {
  before(async () => {
    try {
      const result = await fs.stat(destination)
      if (!result.isDirectory()) {
        await cmd(`mkdir -p ${destination}`)
      }
    } catch (e) {
      debug(`Missing the test destination dir: ${destination}`)
    }
    debug('end of before method.')
  })

  after(async () => {
    if (process.platform === 'darwin') {
      const rm = `rm -rf ${destination}/*`
      debug(rm)
      await cmd(rm)
    }
    debug('end of after method.')
  })

  it('should unpack and move a .tar.gz file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarGz)
    const result = await unpacker.unpack(destination)
    debug(`destination: ${destination}`)
    debug(`result.destination: ${result.destination}`)
    const re = new RegExp(`${destination}`)
    assert.match(result.destination, re)
  })

  it('should unpack and move a single gunzipped file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(gz)
    const result = await unpacker.unpack(destination)
    const re = new RegExp(`${destination}`)
    assert.match(result.destination, re)
  })

  it('should unpack and move a .zip file', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tinyZip)
    const re = new RegExp(`${destination}`)
    const result = await unpacker.unpack(destination)
    assert.match(result.destination, re)
  })

  it('rename the final destination directory of the unpacked archive.', async () => {
    const unpacker = new Unpacker()
    await unpacker.setPath(tarball)
    const re = new RegExp(`${renamedDest}`)
    const result = await unpacker.unpack(destination, {}, { rename: true, newName: renamedDest })
    assert.match(result.finalPath, re)
  })
})
