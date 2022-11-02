import assert from 'node:assert/strict'
import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import { Unpacker } from '../index.js'
import { EventEmitter } from 'node:events'
import Debug from 'debug'

const debug = Debug('unpacker:test')

describe('Testining the creation and use of the Unpacker class.', () => {
  it('should create an instance of Unpacker', () => {
    const unpacker = new Unpacker()
    assert.strictEqual(unpacker instanceof Unpacker, true, `unpacker type error`)
    assert.strictEqual(unpacker instanceof EventEmitter, true, `unpacker type error`)
  })
})


