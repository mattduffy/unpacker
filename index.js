/**
 * @module @mattduffy/unpacker
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file index.js The Unpacker class definition file.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import Debug from 'debug'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cmd = promisify(exec)
const debug = Debug('unpacker:class')

/**
 * A utility class to unpack (unzip, untar, etc.) uploaded archive files.
 * @summary A utility class to upack (unzip, untar, etc.) uploaded archive files.
 * @class Unpacker
 * @extends EventEmitter
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
export class Unpacker extends EventEmitter {
  /**
   * Create an instance of Unpacker.
   * @param { string } pathToArchiveFile - String value of a file system path to an uploaded archive to unpack.
   */
  constructor(pathToArchiveFile) {
    super()
    this.path = pathToArchiveFile || null
  }
}
