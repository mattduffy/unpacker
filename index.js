/**
 * @module @mattduffy/unpacker
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file index.js The Unpacker class definition file.
 */
import nodePath from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import Debug from 'debug'

const __filename = fileURLToPath(import.meta.url)
const __dirname = nodePath.dirname(__filename)
const cmd = promisify(exec)
const debug = Debug('unpacker:class')
const TAR = 'application/x-tar'
const ZIP = 'application/zip'
const GZIP = 'application/gzip'
const OCTET = 'application/octet-stream'
const DIRECTORY = 'inode/directory'

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
    this._path = pathToArchiveFile || null
    this._mimetype = null
    this._tar = null
    this._gzip = null
  }

  /**
   * Return the string value of the file system path to the archive.
   * @summary Return the string value of the file system path to the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { string } The file system path to the archive.
   */
  getPath() {
    return this._path
  }

  /**
   * Set the value of path to the file system location of the archive.
   * @summary Set the value of the path to the file system location of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } filePath - String value of a file system path to the archive.
   * @throws { Error } Throws an error if the file path is invalid.
   * @return { undefind|Error } Throws an error if path argument is not provided or if path is not valid.
   */
  async setPath(filePath) {
    if (!filePath) {
      throw new Error('Missing required path argument.')
    }
    try {
      if (this._tar === null) {
        await this.whichTar()
      }
      if (this._gzip === null) {
        await this.whichGzip()
      }
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        throw new Error(`Not a file: ${filePath}`)
      } else {
        this._path = nodePath.resolve(filePath)
        await this.setMimetype(this._path)
        return
      }
    } catch (e) {
      throw new Error(`Not a valid file path: ${filePath}`)
    }
  }

  /**
   * Return the string value of mime type of the archive.
   * @summary Return the string value of the mime type of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { string } The archive file mime type.
   */
  getMimetype() {
    return this._mimetype
  }

  /**
   * Record the mime type of the archive file.
   * @summary Record the mime type of the archive file.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { string } file - A file sytem path to the file.
   * @throws { Error } Throws an error if the file path is invalid.
   * @return { undefined }
   */
  async setMimetype(file) {
    try {
      const result = await cmd(`file --mime-type --brief '${file}'`)
      const mime = result.stdout.trim()
      debug(result)
      debug(`${file}: ${mime}`)
      switch (result.stdout.trim()) {
        case TAR:
          this._mimetype = TAR
          break
        case ZIP:
          this._mimetype = ZIP
          break
        case GZIP:
          this._mimetype = GZIP
          break
        case DIRECTORY:
          this._mimetype = DIRECTORY
          break
        default:
          this._mimetype = OCTET
      }
    } catch (e) {
      throw new Error(`File not found: ${file}`)
    }
  }

  /**
   * Find the location of the tar executable.
   * @summary Find the location of the tar executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @thows { Error } Throws an error if search for tar fails.
   * @return { undefined }
   */
  async whichTar() {
    try {
      let path = await cmd('which tar')
      path = path.stdout.trim()
      if (!/tar/.test(path)) {
        this._tar = false
        return
      }
      this._tar = path
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
   * Find the location of the gzip executable.
   * @summary Find the location of the gzip executable.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @thows { Error } Throws an error if search for gzip fails.
   * @return { undefined }
   */
  async whichGzip() {
    try {
      let path = await cmd('which gzip')
      path = path.stdout.trim()
      if (!/gzip/.test(path)) {
        this._gzip = false
        return
      }
      this._gzip = path
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
   * Check for the presence of usable versions of tar and gzip.
   * @summary Check for the presence of usuable versions of tar and gzip.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { Object } An object literal with success or error messages.
   */
  checkCommands() {
    if (this._tar === null) {
      this.whichTar()
    }
    if (this._gzip === null) {
      this.whichGzip()
    }
    return { tar: this._tar, gzip: this._gzip }
  }

  /**
   * Unpack the archive file.  The archive file may be one of these file formats: .tar, .tar.gz, .tgz, .zip, or .gzip.
   * The contents of the archive are extracted into a folder, named after the archive, in its current directory.
   * @summary Extract the contents of the archive into a directory, with the name of the archive.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws { Error } Throws an error if the archive could not be unpacked.
   * @return { Object } An object literal with success or error messages.
   */
  async unpack() {
    
  }
}
